-- Ocular visits (docs/visits.md): a client's scheduled time to see the venue, made on the public
-- visit page, through Zeni or by staff at the front desk. Additive and idempotent: running it
-- again changes nothing.

CREATE TABLE IF NOT EXISTS "zion_visits" (
    "id" TEXT NOT NULL,
    "reference" VARCHAR(30) NOT NULL,
    "clientName" VARCHAR(180) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(40) NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED',
    "source" VARCHAR(20) NOT NULL DEFAULT 'WEBSITE',
    "eventType" VARCHAR(100) NOT NULL DEFAULT '',
    "eventDate" DATE,
    "guests" INTEGER,
    "message" TEXT NOT NULL DEFAULT '',
    "staffNotes" TEXT NOT NULL DEFAULT '',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "consentAt" TIMESTAMP(3),
    "checkedInAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT NOT NULL DEFAULT '',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "zion_visits_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "zion_visits_reference_key" ON "zion_visits"("reference");
CREATE INDEX IF NOT EXISTS "zion_visits_startsAt_idx" ON "zion_visits"("startsAt");
CREATE INDEX IF NOT EXISTS "zion_visits_status_startsAt_idx" ON "zion_visits"("status", "startsAt");
CREATE INDEX IF NOT EXISTS "zion_visits_email_idx" ON "zion_visits"("email");
ALTER TABLE "zion_visits" DROP CONSTRAINT IF EXISTS visit_rules;
ALTER TABLE "zion_visits" ADD CONSTRAINT visit_rules CHECK (
  status IN ('SCHEDULED','CHECKED_IN','COMPLETED','NO_SHOW','CANCELLED')
  AND source IN ('WEBSITE','ZENI','STAFF')
  AND "endsAt" > "startsAt"
  AND (guests IS NULL OR guests BETWEEN 1 AND 10000)
);

-- Visitors' contact details are private: never readable through Supabase's public Data API.
ALTER TABLE "zion_visits" ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL ON zion_visits FROM %I', role_name);
    END IF;
  END LOOP;
END $$;
