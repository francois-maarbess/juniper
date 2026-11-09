DO $$ BEGIN
  CREATE TYPE payment_method AS ENUM ('cash', 'whish', 'omt');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('pending', 'reported_paid_by_learner', 'confirmed_by_tutor');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE tutor_approval ADD VALUE IF NOT EXISTS 'suspended_pending_subscription';

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS payment_method_agreed payment_method,
  ADD COLUMN IF NOT EXISTS payment_status payment_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS payment_receipt_storage_key text,
  ADD COLUMN IF NOT EXISTS payment_receipt_file_name text,
  ADD COLUMN IF NOT EXISTS payment_receipt_mime_type text,
  ADD COLUMN IF NOT EXISTS payment_receipt_size_bytes integer,
  ADD COLUMN IF NOT EXISTS payment_reported_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_confirmed_at timestamptz;

ALTER TABLE tutor_profiles
  ADD COLUMN IF NOT EXISTS subscription_paid boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS free_period_ends_at timestamptz;

UPDATE tutor_profiles
SET free_period_ends_at = created_at + interval '30 days'
WHERE free_period_ends_at IS NULL;

ALTER TABLE tutor_profiles
  ALTER COLUMN free_period_ends_at SET DEFAULT now() + interval '30 days',
  ALTER COLUMN free_period_ends_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS tutor_profiles_subscription_idx
  ON tutor_profiles (approval, subscription_paid, free_period_ends_at);
