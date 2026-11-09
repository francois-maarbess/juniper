ALTER TABLE study_requests
  ADD COLUMN IF NOT EXISTS instruction_language text;
