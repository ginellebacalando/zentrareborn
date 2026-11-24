-- Additive, independent developer control plane. Apply with developer:setup.
BEGIN;
CREATE TABLE IF NOT EXISTS zion_developer_accounts (
  id text PRIMARY KEY,
  email varchar(254) NOT NULL UNIQUE,
  name varchar(100) NOT NULL,
  password_hash text NOT NULL,
  totp_secret text NOT NULL,
  last_totp_step bigint NOT NULL DEFAULT -1,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS zion_developer_sessions (
  id text PRIMARY KEY,
  developer_id text NOT NULL REFERENCES zion_developer_accounts(id),
  token_hash text NOT NULL UNIQUE,
  csrf_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS zion_developer_session_owner ON zion_developer_sessions(developer_id);
CREATE TABLE IF NOT EXISTS zion_developer_rate_limits (
  key text PRIMARY KEY,
  attempts integer NOT NULL,
  window_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS zion_developer_audit (
  id text PRIMARY KEY,
  actor text NOT NULL,
  action varchar(60) NOT NULL,
  target varchar(180) NOT NULL,
  result varchar(20) NOT NULL CHECK (result IN ('success','denied','pending','failed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS zion_developer_audit_time ON zion_developer_audit(created_at DESC);
CREATE TABLE IF NOT EXISTS zion_developer_documents (
  id text PRIMARY KEY,
  kind varchar(20) NOT NULL DEFAULT 'knowledge' CHECK (kind IN ('knowledge','template')),
  title varchar(160) NOT NULL,
  content text NOT NULL CHECK (length(content) <= 30000),
  source varchar(500) NOT NULL DEFAULT '',
  revision integer NOT NULL DEFAULT 1,
  published_revision integer,
  archived boolean NOT NULL DEFAULT false,
  updated_by text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS zion_developer_document_revisions (
  document_id text NOT NULL REFERENCES zion_developer_documents(id),
  revision integer NOT NULL,
  title varchar(160) NOT NULL,
  content text NOT NULL,
  source varchar(500) NOT NULL,
  actor text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (document_id, revision)
);
CREATE TABLE IF NOT EXISTS zion_developer_review (
  id text PRIMARY KEY,
  fingerprint text NOT NULL UNIQUE,
  question varchar(500) NOT NULL,
  occurrences integer NOT NULL DEFAULT 1,
  resolved boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '30 days',
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Supabase/PostgREST and other non-owner roles must not expose this control plane.
-- Runtime access requires the table owner or an explicitly privileged server role.
DO $$
DECLARE developer_table text; public_role text;
BEGIN
  FOREACH developer_table IN ARRAY ARRAY[
    'zion_developer_accounts','zion_developer_sessions','zion_developer_rate_limits',
    'zion_developer_audit','zion_developer_documents','zion_developer_document_revisions',
    'zion_developer_review'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', developer_table);
    EXECUTE format('REVOKE ALL ON TABLE %I FROM PUBLIC', developer_table);
    FOREACH public_role IN ARRAY ARRAY['anon','authenticated'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = public_role) THEN
        EXECUTE format('REVOKE ALL ON TABLE %I FROM %I', developer_table, public_role);
      END IF;
    END LOOP;
  END LOOP;
END $$;
COMMIT;
