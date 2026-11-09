DO $$ BEGIN
  CREATE TYPE tutor_approval AS ENUM ('draft', 'pending', 'approved', 'rejected', 'suspended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE one_time_token_purpose AS ENUM ('verify_email', 'reset_password');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE request_status AS ENUM ('open', 'matched', 'in_progress', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE booking_status AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  email_verified_at timestamptz,
  password_hash text NOT NULL,
  first_name text NOT NULL,
  last_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  disabled_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (email);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash text NOT NULL,
  device_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS auth_sessions_refresh_hash_unique ON auth_sessions (refresh_token_hash);
CREATE INDEX IF NOT EXISTS auth_sessions_user_active_idx ON auth_sessions (user_id, expires_at);

CREATE TABLE IF NOT EXISTS one_time_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  purpose one_time_token_purpose NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS one_time_tokens_hash_unique ON one_time_tokens (token_hash);
CREATE INDEX IF NOT EXISTS one_time_tokens_user_purpose_idx ON one_time_tokens (user_id, purpose);

CREATE TABLE IF NOT EXISTS learner_profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  grade_level text,
  timezone text NOT NULL DEFAULT 'UTC',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS tutor_profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  headline text,
  biography text,
  hourly_rate_cents integer NOT NULL DEFAULT 0 CHECK (hourly_rate_cents >= 0),
  availability text[] NOT NULL DEFAULT '{}',
  approval tutor_approval NOT NULL DEFAULT 'draft',
  years_experience integer,
  response_time_minutes integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tutor_profiles_approval_idx ON tutor_profiles (approval);
ALTER TABLE tutor_profiles ADD COLUMN IF NOT EXISTS availability text[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  category text NOT NULL,
  active boolean NOT NULL DEFAULT true
);
CREATE UNIQUE INDEX IF NOT EXISTS subjects_slug_unique ON subjects (slug);
INSERT INTO subjects (name, slug, category) VALUES
  ('Mathematics', 'mathematics', 'STEM'),
  ('Physics', 'physics', 'STEM'),
  ('Writing', 'writing', 'Humanities'),
  ('Chemistry', 'chemistry', 'STEM'),
  ('Statistics', 'statistics', 'STEM'),
  ('Computer science', 'computer-science', 'STEM'),
  ('Biology', 'biology', 'STEM'),
  ('Economics', 'economics', 'Social sciences'),
  ('Languages', 'languages', 'Languages'),
  ('History', 'history', 'Humanities')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, active = true;

CREATE TABLE IF NOT EXISTS tutor_subjects (
  tutor_id uuid NOT NULL REFERENCES tutor_profiles(user_id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  level text NOT NULL DEFAULT 'all',
  CONSTRAINT tutor_subjects_pk PRIMARY KEY (tutor_id, subject_id)
);
CREATE TABLE IF NOT EXISTS study_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (char_length(title) BETWEEN 5 AND 120),
  details text NOT NULL CHECK (char_length(details) BETWEEN 10 AND 5000),
  level text,
  deadline timestamptz NOT NULL,
  budget_cents integer NOT NULL CHECK (budget_cents > 0),
  currency text NOT NULL DEFAULT 'USD',
  status request_status NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS study_requests_board_idx ON study_requests (status, subject_id, deadline);
CREATE INDEX IF NOT EXISTS study_requests_learner_idx ON study_requests (learner_id, created_at DESC);
CREATE TABLE IF NOT EXISTS request_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES study_requests(id) ON DELETE CASCADE,
  storage_key text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes integer NOT NULL CHECK (size_bytes > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS request_attachments_request_idx ON request_attachments (request_id);
CREATE TABLE IF NOT EXISTS offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES study_requests(id) ON DELETE CASCADE,
  tutor_id uuid NOT NULL REFERENCES tutor_profiles(user_id) ON DELETE RESTRICT,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL DEFAULT 'USD',
  note text NOT NULL,
  estimated_minutes integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT offers_request_tutor_unique UNIQUE (request_id, tutor_id)
);
CREATE INDEX IF NOT EXISTS offers_request_created_idx ON offers (request_id, created_at);
CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES study_requests(id) ON DELETE RESTRICT,
  offer_id uuid NOT NULL REFERENCES offers(id) ON DELETE RESTRICT,
  learner_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  tutor_id uuid NOT NULL REFERENCES tutor_profiles(user_id) ON DELETE RESTRICT,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL DEFAULT 'USD',
  scheduled_at timestamptz,
  status booking_status NOT NULL DEFAULT 'scheduled',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bookings_request_unique UNIQUE (request_id)
);
CREATE INDEX IF NOT EXISTS bookings_learner_idx ON bookings (learner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS bookings_tutor_idx ON bookings (tutor_id, created_at DESC);
CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT conversations_booking_unique UNIQUE (booking_id)
);
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  text text NOT NULL CHECK (char_length(text) BETWEEN 1 AND 5000),
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);
CREATE INDEX IF NOT EXISTS messages_conversation_created_idx ON messages (conversation_id, created_at);
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  tutor_id uuid NOT NULL REFERENCES tutor_profiles(user_id) ON DELETE RESTRICT,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reviews_booking_reviewer_unique UNIQUE (booking_id, reviewer_id)
);
CREATE INDEX IF NOT EXISTS reviews_tutor_created_idx ON reviews (tutor_id, created_at DESC);

CREATE TABLE IF NOT EXISTS juniper_schema_migrations (
  name text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO juniper_schema_migrations (name) VALUES ('0001_juniper_marketplace.sql') ON CONFLICT DO NOTHING;
