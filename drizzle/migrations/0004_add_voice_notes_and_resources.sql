-- Migration: 0004_add_voice_notes_and_resources
-- Epic 3: Voice Notes & Shared Resources Zone

-- Voice notes table
CREATE TABLE IF NOT EXISTS voice_notes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id       UUID NOT NULL REFERENCES study_requests(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_url         TEXT NOT NULL,
  duration_seconds INT  NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_voice_notes_request_id ON voice_notes (request_id);
CREATE INDEX IF NOT EXISTS idx_voice_notes_user_id    ON voice_notes (user_id);

-- Resource files table
CREATE TABLE IF NOT EXISTS resource_files (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name      TEXT NOT NULL,
  mime_type      TEXT NOT NULL,
  size_bytes     INT  NOT NULL,
  url            TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resource_files_owner_user_id ON resource_files (owner_user_id);

-- Extend messages table with audio columns (if the table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'messages'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'messages' AND column_name = 'audio_url'
    ) THEN
      ALTER TABLE messages ADD COLUMN audio_url TEXT;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'messages' AND column_name = 'audio_duration_seconds'
    ) THEN
      ALTER TABLE messages ADD COLUMN audio_duration_seconds INT;
    END IF;
  END IF;
END $$;
