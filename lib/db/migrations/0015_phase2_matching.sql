DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'teaching_style') THEN
    CREATE TYPE teaching_style AS ENUM ('socratic', 'direct', 'demo', 'hybrid');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'slot_status') THEN
    CREATE TYPE slot_status AS ENUM ('open', 'held', 'booked', 'cancelled');
  END IF;
END $$;

ALTER TABLE tutor_profiles ADD COLUMN IF NOT EXISTS teaching_style teaching_style DEFAULT 'hybrid';
ALTER TABLE tutor_profiles ADD COLUMN IF NOT EXISTS max_students INTEGER DEFAULT 1;
ALTER TABLE tutor_profiles ADD COLUMN IF NOT EXISTS video_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE tutor_profiles ADD COLUMN IF NOT EXISTS group_enabled BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS tutor_availability_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id UUID NOT NULL REFERENCES tutor_profiles(user_id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  is_recurring BOOLEAN NOT NULL DEFAULT true,
  exception_date TIMESTAMPTZ,
  exception_start TEXT,
  exception_end TEXT
);

CREATE INDEX IF NOT EXISTS tutor_avail_tutor_day_idx ON tutor_availability_windows (tutor_id, day_of_week);

CREATE TABLE IF NOT EXISTS booking_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id UUID NOT NULL REFERENCES tutor_profiles(user_id) ON DELETE CASCADE,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  price_cents INTEGER NOT NULL DEFAULT 0,
  status slot_status NOT NULL DEFAULT 'open',
  booked_by UUID REFERENCES users(id) ON DELETE SET NULL,
  booked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS booking_slots_tutor_start_idx ON booking_slots (tutor_id, start_at);
CREATE INDEX IF NOT EXISTS booking_slots_status_idx ON booking_slots (status, start_at);

CREATE TABLE IF NOT EXISTS tutor_review_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  skill_tag TEXT NOT NULL,
  rating INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS tutor_review_skills_review_idx ON tutor_review_skills (review_id);

CREATE TABLE IF NOT EXISTS waitlist_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id UUID NOT NULL REFERENCES tutor_profiles(user_id) ON DELETE CASCADE,
  learner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tutor_id, learner_id)
);