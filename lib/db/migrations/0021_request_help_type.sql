ALTER TABLE study_requests
  ADD COLUMN IF NOT EXISTS help_type text NOT NULL DEFAULT 'tutoring';

UPDATE study_requests
SET help_type = CASE
  WHEN service_type = 'exam_prep' THEN 'exam_prep'
  WHEN service_type = 'assignment_project' THEN 'homework'
  ELSE 'tutoring'
END
WHERE help_type = 'tutoring';
