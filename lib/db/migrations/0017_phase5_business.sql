DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'calendar_event_type') THEN
    CREATE TYPE calendar_event_type AS ENUM ('session', 'group_class', 'office_hours', 'blocked');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_status') THEN
    CREATE TYPE invoice_status AS ENUM ('draft', 'sent', 'paid', 'overdue', 'cancelled');
  END IF;
END $$;

ALTER TABLE tutor_vault_items ADD COLUMN IF NOT EXISTS download_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tutor_vault_items ADD COLUMN IF NOT EXISTS rating INTEGER;
ALTER TABLE tutor_vault_items ADD COLUMN IF NOT EXISTS refund_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE tutor_profiles ADD COLUMN IF NOT EXISTS business_name TEXT;
ALTER TABLE tutor_profiles ADD COLUMN IF NOT EXISTS tax_id TEXT;
ALTER TABLE tutor_profiles ADD COLUMN IF NOT EXISTS stripe_connect_account_id TEXT;

CREATE TABLE IF NOT EXISTS tutor_calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id UUID NOT NULL REFERENCES tutor_profiles(user_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type calendar_event_type NOT NULL DEFAULT 'session',
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  student_id UUID REFERENCES users(id) ON DELETE SET NULL,
  class_id UUID REFERENCES group_classes(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tutor_calendar_tutor_start_idx ON tutor_calendar_events (tutor_id, start_at);

CREATE TABLE IF NOT EXISTS tutor_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id UUID NOT NULL REFERENCES tutor_profiles(user_id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  description TEXT NOT NULL,
  status invoice_status NOT NULL DEFAULT 'draft',
  due_date TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tutor_invoices_tutor_idx ON tutor_invoices (tutor_id, created_at);
CREATE INDEX IF NOT EXISTS tutor_invoices_student_idx ON tutor_invoices (student_id);