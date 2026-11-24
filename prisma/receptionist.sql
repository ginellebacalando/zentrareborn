-- Additive anonymous receptionist memory. No account, staff booking or payment authority.
BEGIN;
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
CREATE TABLE IF NOT EXISTS zion_receptionist_requests (
  request_id varchar(150) PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES zion_receptionist_conversations(id) ON DELETE CASCADE,
  state_revision integer NOT NULL,
  fingerprint varchar(64) NOT NULL,
  status varchar(20) NOT NULL CHECK (status IN ('prepared','processing','completed','failed')),
  lease_until timestamptz NOT NULL,
  lease_token varchar(64) NOT NULL DEFAULT '',
  encrypted_request text NOT NULL,
  encrypted_result text,
  retry_at timestamptz,
  attempts integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS zion_receptionist_request_owner ON zion_receptionist_requests(conversation_id);
ALTER TABLE zion_receptionist_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE zion_receptionist_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON zion_receptionist_conversations, zion_receptionist_requests FROM PUBLIC;
DO $$
DECLARE role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
      EXECUTE format('REVOKE ALL ON zion_receptionist_conversations, zion_receptionist_requests FROM %I', role_name);
    END IF;
  END LOOP;
END $$;
COMMIT;
