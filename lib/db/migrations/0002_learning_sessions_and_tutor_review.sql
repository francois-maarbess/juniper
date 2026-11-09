ALTER TABLE tutor_profiles
  ADD COLUMN IF NOT EXISTS education_summary text,
  ADD COLUMN IF NOT EXISTS levels text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS review_note text;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS active_role text NOT NULL DEFAULT 'student';
DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT users_active_role_check CHECK (active_role IN ('student', 'tutor'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE study_requests
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS preferred_times text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS session_duration_minutes integer NOT NULL DEFAULT 60;

ALTER TABLE offers
  ADD COLUMN IF NOT EXISTS proposed_at timestamptz;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS duration_minutes integer NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS learning_recap text,
  ADD COLUMN IF NOT EXISTS next_steps text,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

CREATE INDEX IF NOT EXISTS tutor_profiles_review_queue_idx
  ON tutor_profiles (approval, created_at);
CREATE INDEX IF NOT EXISTS bookings_schedule_idx
  ON bookings (scheduled_at, status);

CREATE TABLE IF NOT EXISTS user_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  target_path text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_notifications_inbox_idx
  ON user_notifications (user_id, created_at DESC);
