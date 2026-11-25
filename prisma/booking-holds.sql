-- Booking automation, phase 1 (docs/booking-automation.md). Additive and idempotent: running it
-- again changes nothing, and existing rows keep their values.

-- The payment deadline of an approved request that holds its date while the client pays.
ALTER TABLE "zion_admin_bookings" ADD COLUMN IF NOT EXISTS "holdExpiresAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "zion_admin_bookings_holdExpiresAt_idx" ON "zion_admin_bookings"("holdExpiresAt");

-- A custom proposal from the website has no price (total 0) until staff quote it, so the total
-- may be zero; the other amount rules are unchanged.
ALTER TABLE "zion_admin_bookings" DROP CONSTRAINT IF EXISTS admin_booking_amounts;
ALTER TABLE "zion_admin_bookings" ADD CONSTRAINT admin_booking_amounts CHECK ("totalCents" >= 0 AND "depositCents" >= 0 AND "depositCents" <= "totalCents" AND guests > 0 AND "endsAt" > "startsAt");
