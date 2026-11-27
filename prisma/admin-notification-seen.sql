-- When each admin last opened the header's notification bell and Messages (docs/admin-panel.md,
-- "Header numbers"): the header numbers count only what came in after. One row per admin.
-- Additive and idempotent: running it again changes nothing, and no existing table or row is
-- changed.

CREATE TABLE IF NOT EXISTS "zion_admin_notification_seen" (
    "userId" TEXT NOT NULL,
    "bellSeenAt" TIMESTAMP(3),
    "messagesSeenAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "zion_admin_notification_seen_pkey" PRIMARY KEY ("userId")
);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'zion_admin_notification_seen_userId_fkey'
  ) THEN
    ALTER TABLE "zion_admin_notification_seen" ADD CONSTRAINT "zion_admin_notification_seen_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Private: never readable through Supabase's public Data API.
ALTER TABLE "zion_admin_notification_seen" ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL ON zion_admin_notification_seen FROM %I', role_name);
    END IF;
  END LOOP;
END $$;
