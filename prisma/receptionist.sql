-- Additive, idempotent Zeni (receptionist) tables. No account, staff booking or payment authority.
-- Safe to run more than once: existing tables and rows are kept.
BEGIN;

-- Encrypted, short-lived conversation memory for anonymous visitors.
CREATE TABLE IF NOT EXISTS zion_receptionist_conversations (
  id uuid PRIMARY KEY,
  token_hash varchar(64) NOT NULL UNIQUE,
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  processing_turn_id uuid,
  processing_token uuid,
  processing_until timestamptz,
  processing_fingerprint varchar(64),
  encrypted_pending text,
  encrypted_state text NOT NULL CHECK (length(encrypted_state) <= 160000),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS zion_receptionist_expiry ON zion_receptionist_conversations(expires_at);

-- Unanswered questions for staff review. Questions are redacted before they are stored and are
-- deleted after 180 days. The earlier zion_receptionist_requests booking ledger is no longer
-- used; existing copies are left untouched and can be dropped after review.
CREATE TABLE IF NOT EXISTS zion_zeni_gaps (
  id uuid PRIMARY KEY,
  question varchar(300) NOT NULL,
  question_hash varchar(64) NOT NULL,
  topic varchar(40) NOT NULL DEFAULT 'other',
  language varchar(10) NOT NULL DEFAULT 'en' CHECK (language IN ('en','fil','taglish')),
  reason varchar(20) NOT NULL CHECK (reason IN ('no_source','low_confidence','handoff','conflict')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by varchar(180)
);
CREATE INDEX IF NOT EXISTS zion_zeni_gaps_open ON zion_zeni_gaps(question_hash) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS zion_zeni_gaps_created ON zion_zeni_gaps(created_at);

ALTER TABLE zion_receptionist_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE zion_zeni_gaps ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON zion_receptionist_conversations, zion_zeni_gaps FROM PUBLIC;
DO $$
DECLARE role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
      EXECUTE format('REVOKE ALL ON zion_receptionist_conversations, zion_zeni_gaps FROM %I', role_name);
    END IF;
  END LOOP;
END $$;
COMMIT;
