-- Migration: Add is_admin column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS users_is_admin_idx ON users (is_admin) WHERE is_admin = true;
