-- Optional client photos (docs/client-photos.md): one private photo per client email address,
-- so staff recognize clients when they arrive, and the Front desk's record of when a client
-- arrived for their event. Additive and idempotent: running it again changes nothing, and no
-- existing table or row is changed.

CREATE TABLE IF NOT EXISTS "zion_client_photos" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "clientName" VARCHAR(180) NOT NULL,
    "data" BYTEA NOT NULL,
    "contentType" VARCHAR(20) NOT NULL DEFAULT 'image/jpeg',
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" VARCHAR(64) NOT NULL,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "consentVersion" VARCHAR(40) NOT NULL,
    "source" VARCHAR(20) NOT NULL,
    "review" VARCHAR(20) NOT NULL DEFAULT 'UNREVIEWED',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "zion_client_photos_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "zion_client_photos_email_key" ON "zion_client_photos"("email");
ALTER TABLE "zion_client_photos" DROP CONSTRAINT IF EXISTS client_photo_rules;
ALTER TABLE "zion_client_photos" ADD CONSTRAINT client_photo_rules CHECK (
  source IN ('WEBSITE','STAFF')
  AND review IN ('UNREVIEWED','OK','RETAKE')
  AND "contentType" = 'image/jpeg'
  AND "sizeBytes" > 0 AND "sizeBytes" <= 2097152
  AND width BETWEEN 1 AND 800 AND height BETWEEN 1 AND 800
  AND email = lower(btrim(email))
);

CREATE TABLE IF NOT EXISTS "zion_event_arrivals" (
    "bookingId" TEXT NOT NULL,
    "checkedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkedInBy" TEXT NOT NULL,

    CONSTRAINT "zion_event_arrivals_pkey" PRIMARY KEY ("bookingId")
);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'zion_event_arrivals_bookingId_fkey') THEN
    ALTER TABLE "zion_event_arrivals" ADD CONSTRAINT "zion_event_arrivals_bookingId_fkey"
      FOREIGN KEY ("bookingId") REFERENCES "zion_admin_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Photos and arrivals are private: never readable through Supabase's public Data API.
ALTER TABLE "zion_client_photos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "zion_event_arrivals" ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL ON zion_client_photos, zion_event_arrivals FROM %I', role_name);
    END IF;
  END LOOP;
END $$;
