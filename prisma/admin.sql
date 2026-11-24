-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "zion_admin_bookings" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "clientName" VARCHAR(180) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(40) NOT NULL,
    "eventType" VARCHAR(100) NOT NULL,
    "packageName" VARCHAR(180) NOT NULL,
    "venue" VARCHAR(100) NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "guests" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "depositCents" INTEGER NOT NULL,
    "paymentRule" VARCHAR(30) NOT NULL,
    "approval" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "reservation" VARCHAR(20) NOT NULL DEFAULT 'REQUESTED',
    "verification" VARCHAR(20) NOT NULL DEFAULT 'UNREVIEWED',
    "verificationNote" TEXT NOT NULL DEFAULT '',
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "notes" TEXT NOT NULL DEFAULT '',
    "decisionReason" TEXT NOT NULL DEFAULT '',
    "policyVersion" INTEGER NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "zion_admin_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zion_admin_cash_payments" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "receiptNumber" VARCHAR(80) NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "recordedBy" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "voidedAt" TIMESTAMP(3),
    "voidedBy" TEXT,
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "zion_admin_cash_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zion_admin_contracts" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "bookingRevision" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "createdBy" TEXT NOT NULL,
    "finalizedBy" TEXT,
    "signedBy" TEXT,
    "signedAt" TIMESTAMP(3),
    "signedReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "zion_admin_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zion_admin_policy" (
    "id" TEXT NOT NULL DEFAULT 'venue',
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "paymentRule" VARCHAR(30) NOT NULL DEFAULT 'DEPOSIT_REQUIRED',
    "cashInstructions" TEXT NOT NULL DEFAULT 'Pay cash at Zion Events Place after staff approval. Ask staff to confirm the amount and payment deadline before paying.',
    "contractTerms" TEXT NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "zion_admin_policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zion_admin_outbox" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "event" VARCHAR(40) NOT NULL,
    "recipient" VARCHAR(255) NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "zion_admin_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zion_admin_rate_limits" (
    "key" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "windowAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "zion_admin_rate_limits_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "zion_admin_bookings_reference_key" ON "zion_admin_bookings"("reference");

-- CreateIndex
CREATE INDEX "zion_admin_bookings_startsAt_reservation_idx" ON "zion_admin_bookings"("startsAt", "reservation");

-- CreateIndex
CREATE INDEX "zion_admin_bookings_approval_createdAt_idx" ON "zion_admin_bookings"("approval", "createdAt");

-- CreateIndex
CREATE INDEX "zion_admin_bookings_email_idx" ON "zion_admin_bookings"("email");

-- CreateIndex
CREATE UNIQUE INDEX "zion_admin_cash_payments_receiptNumber_key" ON "zion_admin_cash_payments"("receiptNumber");

-- CreateIndex
CREATE INDEX "zion_admin_cash_payments_bookingId_receivedAt_idx" ON "zion_admin_cash_payments"("bookingId", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "zion_admin_contracts_bookingId_version_key" ON "zion_admin_contracts"("bookingId", "version");

-- CreateIndex
CREATE INDEX "zion_admin_outbox_status_nextAttemptAt_idx" ON "zion_admin_outbox"("status", "nextAttemptAt");

-- AddForeignKey
ALTER TABLE "zion_admin_cash_payments" ADD CONSTRAINT "zion_admin_cash_payments_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "zion_admin_bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zion_admin_contracts" ADD CONSTRAINT "zion_admin_contracts_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "zion_admin_bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Admin-only data must never be readable through Supabase's public Data API.
ALTER TABLE zion_admin_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE zion_admin_cash_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE zion_admin_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE zion_admin_policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE zion_admin_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE zion_admin_rate_limits ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL ON zion_admin_bookings, zion_admin_cash_payments, zion_admin_contracts, zion_admin_policy, zion_admin_outbox, zion_admin_rate_limits FROM %I', role_name);
    END IF;
  END LOOP;
END $$;
ALTER TABLE zion_admin_bookings ADD CONSTRAINT admin_booking_amounts CHECK ("totalCents" > 0 AND "depositCents" >= 0 AND "depositCents" <= "totalCents" AND guests > 0 AND "endsAt" > "startsAt");
ALTER TABLE zion_admin_bookings ADD CONSTRAINT admin_booking_states CHECK (approval IN ('PENDING','APPROVED','REJECTED') AND reservation IN ('REQUESTED','CONFIRMED','CANCELLED','COMPLETED') AND verification IN ('UNREVIEWED','VERIFIED','FLAGGED') AND "paymentRule" IN ('DEPOSIT_REQUIRED','FULL_PAYMENT_REQUIRED','NO_PAYMENT_REQUIRED'));
ALTER TABLE zion_admin_cash_payments ADD CONSTRAINT admin_positive_cash CHECK ("amountCents" > 0);
ALTER TABLE zion_admin_contracts ADD CONSTRAINT admin_contract_states CHECK (status IN ('DRAFT','ISSUED','SIGNED'));
