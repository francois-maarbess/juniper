CREATE TABLE IF NOT EXISTS tutor_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id UUID NOT NULL REFERENCES tutor_profiles(user_id) ON DELETE CASCADE,
  tag_string TEXT NOT NULL,
  endorsement_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tutor_id, tag_string)
);

CREATE INDEX IF NOT EXISTS tutor_tags_tutor_count_idx ON tutor_tags (tutor_id, endorsement_count);