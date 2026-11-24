-- Additive, idempotent schema for built-in email automation. Apply after prisma/admin.sql with
-- `npm run db:automation:check -- --apply` (add --allow-remote for a hosted database).
-- Re-running is safe: nothing is dropped and existing outbox rows keep their data and meaning.
BEGIN;

-- The existing admin outbox becomes the single durable outbox for every notification.
ALTER TABLE "zion_admin_outbox" ALTER COLUMN "bookingId" DROP NOT NULL;
ALTER TABLE "zion_admin_outbox" ADD COLUMN IF NOT EXISTS "replyTo" VARCHAR(255);
ALTER TABLE "zion_admin_outbox" ADD COLUMN IF NOT EXISTS "html" TEXT;
ALTER TABLE "zion_admin_outbox" ADD COLUMN IF NOT EXISTS "calendar" TEXT;
ALTER TABLE "zion_admin_outbox" ADD COLUMN IF NOT EXISTS "calendarMethod" VARCHAR(10);
ALTER TABLE "zion_admin_outbox" ADD COLUMN IF NOT EXISTS "idempotencyKey" VARCHAR(200);
ALTER TABLE "zion_admin_outbox" ADD COLUMN IF NOT EXISTS "maxAttempts" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "zion_admin_outbox" ADD COLUMN IF NOT EXISTS "claimedAt" TIMESTAMP(3);
ALTER TABLE "zion_admin_outbox" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);
-- Legacy rows keep a NULL key; PostgreSQL unique indexes allow any number of NULLs.
CREATE UNIQUE INDEX IF NOT EXISTS "zion_admin_outbox_idempotencyKey_key" ON "zion_admin_outbox"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "zion_admin_outbox_status_nextAttemptAt_idx" ON "zion_admin_outbox"("status", "nextAttemptAt");

-- NOT VALID: enforce for new writes without failing on unexpected historical rows.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'zion_admin_outbox_automation_states'
      AND conrelid = 'zion_admin_outbox'::regclass
  ) THEN
    ALTER TABLE "zion_admin_outbox" ADD CONSTRAINT zion_admin_outbox_automation_states CHECK (
      status IN ('QUEUED', 'PROCESSING', 'ACCEPTED', 'REVIEW_REQUIRED', 'EXPIRED')
      AND ("calendarMethod" IS NULL OR "calendarMethod" IN ('REQUEST', 'CANCEL'))
      AND attempts >= 0
      AND "maxAttempts" >= 1
    ) NOT VALID;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "zion_automation_state" (
    "key" VARCHAR(60) NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "detail" JSONB,

    CONSTRAINT "zion_automation_state_pkey" PRIMARY KEY ("key")
);

-- Inquiries created before this installation are never emailed retroactively. Prisma stores UTC.
INSERT INTO "zion_automation_state" ("key", "at")
VALUES ('inquiry-sweep-since', (now() AT TIME ZONE 'UTC'))
ON CONFLICT ("key") DO NOTHING;

-- Private server data: never readable through Supabase's public Data API.
ALTER TABLE "zion_admin_outbox" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "zion_automation_state" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "zion_admin_outbox", "zion_automation_state" FROM PUBLIC;
DO $$
DECLARE role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL ON "zion_admin_outbox", "zion_automation_state" FROM %I', role_name);
    END IF;
  END LOOP;
END $$;

COMMIT;
