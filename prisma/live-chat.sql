-- Live chat between website visitors and Zion staff. Zeni opens a chat when a visitor asks for a
-- person ("Talk to staff") while a staff member is available; staff take it from the admin
-- Live chat page and hand the visitor back to Zeni when they are done. Additive and idempotent:
-- `npm run db:live-chat:check -- --apply` (add --allow-remote for a hosted database).

CREATE TABLE IF NOT EXISTS zion_live_chats (
    id TEXT NOT NULL,
    conversation_id TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'WAITING',
    visitor_name VARCHAR(100) NOT NULL DEFAULT '',
    language VARCHAR(10) NOT NULL DEFAULT 'en',
    summary TEXT NOT NULL DEFAULT '',
    staff_user_id TEXT,
    staff_name VARCHAR(100),
    outcome TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
    claimed_at TIMESTAMPTZ(3),
    ended_at TIMESTAMPTZ(3),
    last_message_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
    CONSTRAINT zion_live_chats_pkey PRIMARY KEY (id),
    CONSTRAINT zion_live_chats_status CHECK (
      status IN ('WAITING', 'ACTIVE', 'RETURNED', 'CLOSED', 'MISSED')
    )
);
CREATE INDEX IF NOT EXISTS zion_live_chats_status_created
  ON zion_live_chats (status, created_at);
CREATE INDEX IF NOT EXISTS zion_live_chats_conversation
  ON zion_live_chats (conversation_id, created_at DESC);
-- A conversation has at most one chat waiting for or talking with staff.
CREATE UNIQUE INDEX IF NOT EXISTS zion_live_chats_one_open
  ON zion_live_chats (conversation_id) WHERE status IN ('WAITING', 'ACTIVE');

CREATE TABLE IF NOT EXISTS zion_live_chat_messages (
    id BIGSERIAL NOT NULL,
    chat_id TEXT NOT NULL REFERENCES zion_live_chats (id) ON DELETE CASCADE,
    sender VARCHAR(10) NOT NULL,
    author VARCHAR(100) NOT NULL DEFAULT '',
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
    CONSTRAINT zion_live_chat_messages_pkey PRIMARY KEY (id),
    CONSTRAINT zion_live_chat_messages_sender CHECK (sender IN ('VISITOR', 'STAFF', 'SYSTEM'))
);
CREATE INDEX IF NOT EXISTS zion_live_chat_messages_chat
  ON zion_live_chat_messages (chat_id, id);

-- Staff who switched on "Available for live chat"; the admin page refreshes last_seen_at.
CREATE TABLE IF NOT EXISTS zion_live_chat_staff (
    user_id TEXT NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    available BOOLEAN NOT NULL DEFAULT false,
    last_seen_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
    CONSTRAINT zion_live_chat_staff_pkey PRIMARY KEY (user_id)
);

-- Live chats must never be readable through Supabase's public Data API.
DO $$
DECLARE
  live_table text;
  role_name text;
BEGIN
  FOREACH live_table IN ARRAY ARRAY['zion_live_chats', 'zion_live_chat_messages', 'zion_live_chat_staff'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', live_table);
    EXECUTE format('REVOKE ALL ON TABLE %I FROM PUBLIC', live_table);
    FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
        EXECUTE format('REVOKE ALL ON TABLE %I FROM %I', live_table, role_name);
      END IF;
    END LOOP;
  END LOOP;
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL ON SEQUENCE zion_live_chat_messages_id_seq FROM %I', role_name);
    END IF;
  END LOOP;
END $$;
