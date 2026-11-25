import 'server-only';

import { AUTOMATION_POLICY, applicationUrl } from './config';
import { enqueueJobs, type OutboxDb } from './outbox';
import { resolveStaffRecipients } from './recipients';
import {
  bookingRequestAcknowledgement,
  bookingRequestStaffAlert,
  type BookingRequestEmailSource,
} from './templates';

const ONE_DAY_MS = 24 * 60 * 60_000;

/**
 * Enqueues the staff alert and the client acknowledgement for a booking request sent from the
 * public booking page. Call it inside the transaction that creates the booking, so no request is
 * saved without its notifications; repeated calls are harmless (idempotency keys). The client
 * row uses the REQUEST_RECEIVED event that staff-entered requests also use, so analytics and
 * the Activity log treat both alike. Returns the ids of jobs ready for immediate delivery.
 */
export async function enqueueWebsiteBookingRequest(
  db: OutboxDb,
  booking: BookingRequestEmailSource & { id: string; revision: number },
  now = new Date(),
) {
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
          bookingsUrl: appUrl ? `${appUrl}/admin/bookings` : null,
        }),
        skipReason:
          alertsToday >= AUTOMATION_POLICY.staffAlertsPerDay
            ? 'Not sent individually: the daily limit for booking request alerts was reached. The request is in Bookings and the daily digest.'
            : undefined,
      },
      {
        idempotencyKey: `booking:${booking.id}:REQUEST_RECEIVED:r${booking.revision}`,
        event: 'REQUEST_RECEIVED',
        recipient: email,
        bookingId: booking.id,
        ...bookingRequestAcknowledgement(booking),
        expiresAt: new Date(now.getTime() + AUTOMATION_POLICY.acknowledgementTtlMs),
        skipReason:
          acknowledgementsToRecipient >= AUTOMATION_POLICY.acknowledgementsPerRecipientPerDay
            ? 'Not sent: this address already received the maximum number of acknowledgements today.'
            : undefined,
      },
    ],
    now,
  );
}
