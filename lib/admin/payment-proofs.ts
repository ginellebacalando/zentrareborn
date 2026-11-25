import 'server-only';
import type { Prisma } from '@prisma/client';
import { transferReceiptNumber } from './payment-accounts';

type Db = Prisma.TransactionClient;

/** Everything staff see about a payment screenshot except the file, which has its own route. */
const PROOF_SUMMARY = {
  id: true,
  bookingId: true,
  method: true,
  referenceNumber: true,
  amountCents: true,
  paidOn: true,
  fileName: true,
  contentType: true,
  sizeBytes: true,
  sha256: true,
  status: true,
  reviewReason: true,
  reviewedAt: true,
  createdAt: true,
} satisfies Prisma.AdminPaymentProofSelect;

type ProofRow = Prisma.AdminPaymentProofGetPayload<{ select: typeof PROOF_SUMMARY }>;

/**
 * Signs that a screenshot waiting for review may not be a new payment: the same reference on
 * another booking or already verified, the reference already recorded as a payment, or the same
 * image sent before. They are prompts to check Zion's own records, not decisions.
 */
async function proofWarnings(db: Db, proof: ProofRow) {
  const reference = proof.referenceNumber;
  const [sameReference, sameImage, recorded] = await Promise.all([
    db.adminPaymentProof.findMany({
      where: {
        id: { not: proof.id },
        referenceNumber: reference,
        status: { not: 'REPLACED' },
        OR: [{ bookingId: { not: proof.bookingId } }, { status: 'VERIFIED' }],
      },
      select: { status: true, booking: { select: { reference: true } } },
      take: 3,
    }),
    db.adminPaymentProof.findMany({
      where: {
        id: { not: proof.id },
        sha256: proof.sha256,
        status: { not: 'REPLACED' },
      },
      select: { bookingId: true, status: true, booking: { select: { reference: true } } },
      take: 3,
    }),
    db.adminCashPayment.findMany({
      where: {
        receiptNumber: {
          in: [
            transferReceiptNumber('GCASH', reference),
            transferReceiptNumber('BANK_TRANSFER', reference),
          ],
        },
      },
      select: { receiptNumber: true, voidedAt: true, booking: { select: { reference: true } } },
    }),
  ]);
  const warnings: string[] = [];
  for (const other of sameReference)
    warnings.push(
      other.status === 'VERIFIED'
        ? `This reference number was already verified for ${other.booking.reference}.`
        : `The same reference number was sent for ${other.booking.reference}.`,
    );
  for (const payment of recorded)
    warnings.push(
      payment.voidedAt
        ? `This reference was recorded as ${payment.receiptNumber} for ${payment.booking.reference} and later voided.`
        : `This reference is already recorded as payment ${payment.receiptNumber} for ${payment.booking.reference}.`,
    );
  for (const other of sameImage)
    warnings.push(
      other.bookingId === proof.bookingId
        ? `This is the same image as an earlier ${other.status.toLowerCase()} screenshot for this booking.`
        : `The same image was sent for ${other.booking.reference}.`,
    );
  return [...new Set(warnings)];
}

/**
 * A booking's payment screenshots for staff, newest first; a screenshot the client replaced with
 * a newer one is left out. Only the one waiting for review carries warnings.
 */
export async function readBookingProofs(db: Db, bookingId: string) {
  const proofs = await db.adminPaymentProof.findMany({
    where: { bookingId, status: { not: 'REPLACED' } },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: PROOF_SUMMARY,
  });
  // The file hash stays on the server; it is only used to spot a reused image.
  return Promise.all(
    proofs.map(async (proof) => ({
      id: proof.id,
      method: proof.method,
      referenceNumber: proof.referenceNumber,
      amountCents: proof.amountCents,
      paidOn: proof.paidOn.toISOString().slice(0, 10),
      fileName: proof.fileName,
      contentType: proof.contentType,
      sizeBytes: proof.sizeBytes,
      status: proof.status,
      reviewReason: proof.reviewReason,
      reviewedAt: proof.reviewedAt,
      createdAt: proof.createdAt,
      warnings: proof.status === 'SUBMITTED' ? await proofWarnings(db, proof) : [],
    })),
  );
}
