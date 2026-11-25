import 'server-only';

import { paymentPageUrl } from '@/lib/payment-link';
import { staffCalendarUpdate } from './bookings';
import { AUTOMATION_POLICY, applicationUrl } from './config';
import { enqueueJobs, type OutboxDb } from './outbox';
import { resolveStaffRecipients } from './recipients';
import {
  bookingRequestAcknowledgement,
  bookingRequestStaffAlert,
  type BookingRequestEmailSource,
  type BookingRequestOutcome,
} from './templates';

const ONE_DAY_MS = 24 * 60 * 60_000;

/**
 * Enqueues the staff alert, the client acknowledgement and the pending event for the staff
 * calendars for a booking request sent from the public booking page. Call it inside the
 * transaction that creates the booking, so no request is saved without its notifications;
 * repeated calls are harmless (idempotency keys). The client row uses the REQUEST_RECEIVED event
 * that staff-entered requests also use, so analytics and the Activity log treat both alike. A
 * request the system approved (holdExpiresAt set) tells the client what to pay and by when; one
 * that needs review says why. Returns the ids of jobs ready for immediate delivery.
 */
export async function enqueueWebsiteBookingRequest(
  db: OutboxDb,
  booking: BookingRequestEmailSource & {
    id: string;
    revision: number;
    paymentRule?: string;
    holdExpiresAt?: Date | null;
  },
  now = new Date(),
  decision: { reviewReasons: string[]; paymentInstructions: string } = {
    reviewReasons: [],
    paymentInstructions: '',
  },
) {
  const outcome: BookingRequestOutcome = {
    holdExpiresAt: booking.holdExpiresAt ?? null,
    amountDueCents:
      booking.paymentRule === 'FULL_PAYMENT_REQUIRED' ? booking.totalCents : booking.depositCents,
    paymentUrl: booking.holdExpiresAt ? paymentPageUrl(booking.id) : null,
    ...decision,
  };
  const email = booking.email.trim().toLowerCase();
  const since = new Date(now.getTime() - ONE_DAY_MS);
  const [alertsToday, acknowledgementsToRecipient, staff] = await Promise.all([
    db.adminOutbox.count({
      where: {
        event: 'BOOKING_REQUEST_STAFF_ALERT',
        status: { not: 'EXPIRED' },
        createdAt: { gte: since },
      },
    }),
    db.adminOutbox.count({
      where: {
        event: 'REQUEST_RECEIVED',
        status: { not: 'EXPIRED' },
        recipient: email,
        createdAt: { gte: since },
      },
    }),
    resolveStaffRecipients(db),
  ]);
  const appUrl = applicationUrl();
  const alertLimitReached = alertsToday >= AUTOMATION_POLICY.staffAlertsPerDay;
  const pendingEvent = await staffCalendarUpdate(db, booking, 'PENDING', now);
  return enqueueJobs(
    db,
    [
      {
        idempotencyKey: `booking:${booking.id}:BOOKING_REQUEST_STAFF_ALERT`,
        event: 'BOOKING_REQUEST_STAFF_ALERT',
        recipient: staff.list,
        replyTo: email,
        bookingId: booking.id,
        ...bookingRequestStaffAlert({
          ...booking,
          bookingsUrl: appUrl
            ? `${appUrl}/admin/bookings?status=${outcome.holdExpiresAt ? 'pending' : 'request'}`
            : null,
          outcome,
        }),
        skipReason: alertLimitReached
          ? 'Not sent individually: the daily limit for booking request alerts was reached. The request is in Bookings and the daily digest.'
          : undefined,
      },
      {
        idempotencyKey: `booking:${booking.id}:REQUEST_RECEIVED:r${booking.revision}`,
        event: 'REQUEST_RECEIVED',
        recipient: email,
        bookingId: booking.id,
        ...bookingRequestAcknowledgement(booking, outcome),
        expiresAt: new Date(now.getTime() + AUTOMATION_POLICY.acknowledgementTtlMs),
        skipReason:
          acknowledgementsToRecipient >= AUTOMATION_POLICY.acknowledgementsPerRecipientPerDay
            ? 'Not sent: this address already received the maximum number of acknowledgements today.'
            : undefined,
      },
      // The pending calendar event follows the daily limit of the alert it accompanies.
      ...(pendingEvent
        ? [
            {
              ...pendingEvent,
              skipReason: alertLimitReached
                ? 'Not sent: the daily limit for booking request alerts was reached. The request appears in staff calendars once it is confirmed.'
                : undefined,
            },
          ]
        : []),
    ],
    now,
  );
}
