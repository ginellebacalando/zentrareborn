-- Booking automation, phase 3 (docs/booking-automation.md): an acknowledgment number for every
-- recorded payment, printed on its acknowledgment receipt (ACK-<year>-<number>). Additive and
-- idempotent: running it again changes nothing. Payments recorded before this file are numbered
-- once, in the order they were recorded; no other value changes.

ALTER TABLE "zion_admin_cash_payments" ADD COLUMN IF NOT EXISTS "acknowledgmentNumber" VARCHAR(30);
CREATE UNIQUE INDEX IF NOT EXISTS "zion_admin_cash_payments_acknowledgmentNumber_key" ON "zion_admin_cash_payments"("acknowledgmentNumber");
CREATE SEQUENCE IF NOT EXISTS zion_acknowledgment_number_seq;

DO $$
DECLARE payment RECORD;
BEGIN
  FOR payment IN
    SELECT id, "receivedAt" FROM "zion_admin_cash_payments"
    WHERE "acknowledgmentNumber" IS NULL
    ORDER BY "createdAt", id
  LOOP
    -- The year is the Manila year the money was received (UTC+8, no daylight saving time).
    UPDATE "zion_admin_cash_payments"
    SET "acknowledgmentNumber" = 'ACK-' || to_char(payment."receivedAt" + interval '8 hours', 'YYYY')
      || '-' || lpad(nextval('zion_acknowledgment_number_seq')::text, 6, '0')
    WHERE id = payment.id;
  END LOOP;
END $$;

-- The counter is private, like the admin tables: never usable through Supabase's public Data API.
DO $$
DECLARE role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL ON SEQUENCE zion_acknowledgment_number_seq FROM %I', role_name);
    END IF;
  END LOOP;
END $$;
