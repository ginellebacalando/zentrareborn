-- Booking automation, phase 2 (docs/booking-automation.md): GCash and bank transfer payment
-- screenshots kept privately until staff verify or reject them, and the method of each recorded
-- payment. Additive and idempotent: running it again changes nothing, and existing rows keep
-- their values (every earlier payment was cash).

ALTER TABLE "zion_admin_cash_payments" ADD COLUMN IF NOT EXISTS "method" VARCHAR(20) NOT NULL DEFAULT 'CASH';
ALTER TABLE "zion_admin_cash_payments" DROP CONSTRAINT IF EXISTS admin_payment_methods;
ALTER TABLE "zion_admin_cash_payments" ADD CONSTRAINT admin_payment_methods CHECK (method IN ('CASH','GCASH','BANK_TRANSFER'));

CREATE TABLE IF NOT EXISTS "zion_payment_proofs" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "method" VARCHAR(20) NOT NULL,
    "referenceNumber" VARCHAR(80) NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "paidOn" DATE NOT NULL,
    "fileName" VARCHAR(200) NOT NULL,
    "contentType" VARCHAR(60) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" VARCHAR(64) NOT NULL,
    "data" BYTEA NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'SUBMITTED',
    "reviewReason" TEXT NOT NULL DEFAULT '',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "paymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "zion_payment_proofs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "zion_payment_proofs_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "zion_admin_bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "zion_payment_proofs_bookingId_status_idx" ON "zion_payment_proofs"("bookingId", "status");
CREATE INDEX IF NOT EXISTS "zion_payment_proofs_referenceNumber_idx" ON "zion_payment_proofs"("referenceNumber");
ALTER TABLE "zion_payment_proofs" DROP CONSTRAINT IF EXISTS payment_proof_rules;
ALTER TABLE "zion_payment_proofs" ADD CONSTRAINT payment_proof_rules CHECK (status IN ('SUBMITTED','VERIFIED','REJECTED','REPLACED') AND method IN ('GCASH','BANK_TRANSFER') AND "amountCents" > 0 AND "sizeBytes" > 0);

-- Payment screenshots are private: never readable through Supabase's public Data API.
ALTER TABLE "zion_payment_proofs" ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL ON zion_payment_proofs FROM %I', role_name);
    END IF;
  END LOOP;
END $$;
