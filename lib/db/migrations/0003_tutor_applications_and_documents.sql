ALTER TABLE users
  ADD COLUMN IF NOT EXISTS signup_role text NOT NULL DEFAULT 'student';

ALTER TABLE users
  ADD CONSTRAINT users_signup_role_check CHECK (signup_role IN ('student', 'tutor'));

CREATE TYPE tutor_application_status AS ENUM (
  'draft', 'submitted', 'in_review', 'needs_info', 'approved', 'rejected', 'suspended'
);
CREATE TYPE tutor_document_category AS ENUM (
  'transcript', 'degree_certificate', 'teaching_certificate', 'cv', 'portfolio_evidence', 'other'
);
CREATE TYPE tutor_document_review_status AS ENUM ('pending', 'verified', 'replace_requested');

CREATE TABLE tutor_applications (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  legal_name text NOT NULL DEFAULT '',
  country text,
  degree_level text,
  institution text,
  field_of_study text,
  graduation_year integer CHECK (graduation_year IS NULL OR graduation_year BETWEEN 1950 AND 2100),
  grade_value text,
  grade_scale text,
  years_experience integer CHECK (years_experience IS NULL OR years_experience BETWEEN 0 AND 80),
  languages text[] NOT NULL DEFAULT '{}',
  status tutor_application_status NOT NULL DEFAULT 'draft',
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  applicant_message text,
  internal_review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tutor_applications_status_created_idx ON tutor_applications(status, created_at);

CREATE TABLE tutor_application_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES tutor_applications(user_id) ON DELETE CASCADE,
  category tutor_document_category NOT NULL,
  storage_key text NOT NULL UNIQUE,
  file_name text NOT NULL,
  mime_type text NOT NULL CHECK (mime_type IN ('application/pdf', 'image/jpeg', 'image/png')),
  size_bytes integer NOT NULL CHECK (size_bytes BETWEEN 1 AND 10485760),
  review_status tutor_document_review_status NOT NULL DEFAULT 'pending',
  reviewer_note text,
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tutor_application_documents_user_idx ON tutor_application_documents(user_id, created_at);

CREATE TABLE tutor_application_review_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES tutor_applications(user_id) ON DELETE CASCADE,
  reviewer_id uuid REFERENCES users(id) ON DELETE SET NULL,
  event text NOT NULL,
  applicant_message text,
  internal_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tutor_application_review_events_user_idx ON tutor_application_review_events(user_id, created_at);

-- Existing tutor records have no uploaded evidence in Juniper. Require a fresh
-- document review instead of silently treating the old checkbox as verification.
INSERT INTO tutor_applications (user_id, legal_name, status, applicant_message, created_at, updated_at)
SELECT
  p.user_id,
  concat_ws(' ', nullif(u.first_name, ''), nullif(u.last_name, '')),
  CASE
    WHEN p.approval = 'rejected' THEN 'rejected'::tutor_application_status
    WHEN p.approval = 'suspended' THEN 'suspended'::tutor_application_status
    WHEN p.approval = 'draft' THEN 'draft'::tutor_application_status
    ELSE 'needs_info'::tutor_application_status
  END,
  CASE WHEN p.approval IN ('approved', 'pending')
    THEN 'Please add your degree proof and transcripts so Juniper can complete document review.'
    ELSE p.review_note END,
  p.created_at,
  now()
FROM tutor_profiles p
JOIN users u ON u.id = p.user_id
ON CONFLICT (user_id) DO NOTHING;

UPDATE users SET signup_role = 'tutor'
WHERE id IN (SELECT user_id FROM tutor_profiles);

UPDATE tutor_profiles SET
  approval = 'pending',
  reviewed_at = NULL,
  reviewed_by = NULL,
  review_note = 'Degree proof and transcripts are required for Juniper document review.'
WHERE approval = 'approved';

INSERT INTO tutor_application_review_events (user_id, event, applicant_message)
SELECT user_id, 'legacy_reverification_required', applicant_message
FROM tutor_applications WHERE status = 'needs_info';
