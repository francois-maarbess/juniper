-- Existing databases may have received 0007 before the clean-install schema
-- gaps were discovered. Keep this alignment idempotent for every upgrade path.
ALTER TABLE study_requests
  ADD COLUMN IF NOT EXISTS service_type text NOT NULL DEFAULT 'assignment_project',
  ADD COLUMN IF NOT EXISTS target_grade text NOT NULL DEFAULT 'not_specified',
  ADD COLUMN IF NOT EXISTS grade_guarantee boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS target_tutor_id uuid REFERENCES tutor_profiles(user_id) ON DELETE SET NULL;

ALTER TABLE offers
  ADD COLUMN IF NOT EXISTS turnaround_hours integer,
  ADD COLUMN IF NOT EXISTS includes_walkthrough boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS grade_commitment text;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS service_type text NOT NULL DEFAULT 'assignment_project',
  ADD COLUMN IF NOT EXISTS target_grade text NOT NULL DEFAULT 'not_specified',
  ADD COLUMN IF NOT EXISTS grade_guarantee boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS solution_summary text,
  ADD COLUMN IF NOT EXISTS explanation_walkthrough text,
  ADD COLUMN IF NOT EXISTS deliverables jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS escrow_status text NOT NULL DEFAULT 'not_configured',
  ADD COLUMN IF NOT EXISTS revision_notes text,
  ADD COLUMN IF NOT EXISTS revision_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS released_at timestamptz;

CREATE INDEX IF NOT EXISTS study_requests_target_tutor_idx ON study_requests (target_tutor_id, status);

ALTER TABLE study_requests ALTER COLUMN target_grade SET DEFAULT 'not_specified';
ALTER TABLE study_requests ALTER COLUMN grade_guarantee SET DEFAULT false;
UPDATE study_requests SET grade_guarantee = false;
ALTER TABLE offers ALTER COLUMN grade_commitment DROP DEFAULT;
UPDATE offers SET grade_commitment = NULL;
ALTER TABLE bookings ALTER COLUMN target_grade SET DEFAULT 'not_specified';
ALTER TABLE bookings ALTER COLUMN grade_guarantee SET DEFAULT false;
UPDATE bookings SET grade_guarantee = false;

CREATE INDEX IF NOT EXISTS message_attachments_staged_created_idx
  ON message_attachments (created_at) WHERE message_id IS NULL;
