DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'whiteboard_element_type') THEN
    CREATE TYPE whiteboard_element_type AS ENUM ('stroke', 'shape', 'text', 'math', 'image', 'sticky');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'recording_status') THEN
    CREATE TYPE recording_status AS ENUM ('recording', 'processing', 'ready', 'failed');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS workroom_whiteboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  elements JSONB NOT NULL DEFAULT '[]'::jsonb,
  version INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS workroom_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  url TEXT,
  duration_seconds INTEGER,
  status recording_status NOT NULL DEFAULT 'recording',
  started_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS workroom_recordings_booking_idx ON workroom_recordings (booking_id, created_at);