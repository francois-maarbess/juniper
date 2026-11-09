DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bounty_status') THEN
    CREATE TYPE bounty_status AS ENUM ('open', 'claimed', 'solved');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS micro_bounties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_tag TEXT NOT NULL,
  description TEXT NOT NULL,
  image_url TEXT,
  bounty_amount_cents INTEGER NOT NULL,
  status bounty_status NOT NULL DEFAULT 'open',
  claimed_by_tutor_id UUID REFERENCES tutor_profiles(user_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  solved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS micro_bounties_status_idx ON micro_bounties (status, created_at);
CREATE INDEX IF NOT EXISTS micro_bounties_learner_idx ON micro_bounties (learner_id, created_at);

CREATE TABLE IF NOT EXISTS bounty_solutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bounty_id UUID NOT NULL REFERENCES micro_bounties(id) ON DELETE CASCADE,
  tutor_id UUID NOT NULL REFERENCES tutor_profiles(user_id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  image_url TEXT,
  voice_note_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bounty_solutions_bounty_idx ON bounty_solutions (bounty_id, created_at);