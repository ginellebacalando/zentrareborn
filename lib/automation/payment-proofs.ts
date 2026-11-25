import 'server-only';

import {
  onlinePaymentMethods,
  PAYMENT_METHOD_LABELS,
  type OnlinePaymentMethod,
} from '@/lib/admin/payment-accounts';
import { readPaymentAccounts } from '@/lib/admin/preferences';
import { paymentPageUrl } from '@/lib/payment-link';
import { applicationUrl } from './config';
import { enqueueJobs, type OutboxDb } from './outbox';
import { resolveStaffRecipients } from './recipients';
import { paymentProofReceived, paymentProofStaffAlert } from './templates';

/** Whether clients can pay online now: a GCash or bank account is set up in Settings. */
export async function onlinePaymentsOffered(db: OutboxDb) {
  return onlinePaymentMethods(await readPaymentAccounts(db)).length > 0;
}

/**
 * The payment page button for a client email, or null when the link cannot be built. It offers
 * uploading only when a GCash or bank account is set up; otherwise the page shows how to pay in
 * cash, so the button says only that.
 */
export function paymentPageAction(bookingId: string, online: boolean) {
  const href = paymentPageUrl(bookingId);
  if (!href) return null;
  return { label: online ? 'See how to pay or upload your payment' : 'See how to pay', href };
}

/**
 * Enqueues the client's "screenshot received" email and the staff request to verify it, inside
 * the transaction that stores the screenshot (booking automation phase 2). The staff email
 * resolves its inboxes again at delivery, like the other staff alerts. Returns the ids of jobs
 * ready for immediate delivery.
 */
export async function enqueuePaymentProofReceived(
  db: OutboxDb,
  booking: {
    id: string;
    reference: string;
    clientName: string;
    email: string;
    phone: string;
    eventType: string;
    startsAt: Date;
    holdExpiresAt: Date | null;
  },
  proof: {
    id: string;
    method: OnlinePaymentMethod;
    amountCents: number;
    referenceNumber: string;
    paidOn: string;
  },
  now = new Date(),
) {
  const staff = await resolveStaffRecipients(db);
  const appUrl = applicationUrl();
  const source = {
    ...booking,
    methodLabel: PAYMENT_METHOD_LABELS[proof.method],
    amountCents: proof.amountCents,
    referenceNumber: proof.referenceNumber,
    paidOn: proof.paidOn,
    deadline: booking.holdExpiresAt,
  };
  return enqueueJobs(
    db,
    [
      {
        idempotencyKey: `payment-proof:${proof.id}:client`,
        event: 'PAYMENT_PROOF_RECEIVED',
        recipient: booking.email,
        bookingId: booking.id,
        ...paymentProofReceived(source),
      },
      {
        idempotencyKey: `payment-proof:${proof.id}:staff`,
        event: 'PAYMENT_PROOF_STAFF_ALERT',
        recipient: staff.list,
        replyTo: booking.email,
        bookingId: booking.id,
        ...paymentProofStaffAlert({
          ...source,
          bookingsUrl: appUrl ? `${appUrl}/admin/bookings?status=pending` : null,
        }),
      },
    ],
    now,
  );
}
