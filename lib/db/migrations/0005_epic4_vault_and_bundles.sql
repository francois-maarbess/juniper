-- Migration: 0005_epic4_vault_and_bundles.sql
-- Epic 4: Elite Tutor Economics (Tutor Knowledge Vault & Multi-Session Bundles)

CREATE TABLE IF NOT EXISTS tutor_vault_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  is_public BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tutor_vault_items_tutor_user_id ON tutor_vault_items (tutor_user_id);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'offers') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'offers' AND column_name = 'offer_type') THEN
      ALTER TABLE offers ADD COLUMN offer_type TEXT NOT NULL DEFAULT 'hourly';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'offers' AND column_name = 'package_session_count') THEN
      ALTER TABLE offers ADD COLUMN package_session_count INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'offers' AND column_name = 'package_description') THEN
      ALTER TABLE offers ADD COLUMN package_description TEXT;
    END IF;
  END IF;
END $$;
