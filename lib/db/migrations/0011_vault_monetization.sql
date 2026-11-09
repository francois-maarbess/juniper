ALTER TABLE tutor_vault_items ADD COLUMN IF NOT EXISTS price_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tutor_vault_items ADD COLUMN IF NOT EXISTS purchase_count INTEGER NOT NULL DEFAULT 0;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vault_purchase_status') THEN
    CREATE TYPE vault_purchase_status AS ENUM ('pending', 'confirmed');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS vault_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES tutor_vault_items(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status vault_purchase_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ,
  UNIQUE (item_id, buyer_id)
);

CREATE INDEX IF NOT EXISTS vault_purchases_item_idx ON vault_purchases (item_id);
CREATE INDEX IF NOT EXISTS vault_purchases_buyer_idx ON vault_purchases (buyer_id);