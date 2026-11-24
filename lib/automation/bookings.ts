import 'server-only';

import { BRAND } from '@/config/brand';
import { bookingEmail } from '@/lib/admin/domain';
import { automationJobLabel } from './catalog';
import { buildCalendarInvite, type CalendarMethod } from './ics';
import { enqueueJobs, type OutboxDb } from './outbox';
import { renderPlainNotice, VENUE_LOCATION } from './templates';

export type BookingNoticeSource = {
  id: string;
  reference: string;
  clientName: string;
  email: string;
  eventType: string;
  packageName: string;
  guests: number;
  startsAt: Date;
  endsAt: Date;
  revision: number;
  approval: string;
  reservation: string;
  totalCents: number;
  depositCents: number;
  paymentRule: string;
};

/** One event per booking in every calendar: updates and cancellations reuse this UID. */
export function bookingCalendarUid(bookingId: string) {
  return `booking-${bookingId}@zion-events-place`;
}

const CALENDAR_NOTES: Record<CalendarMethod, string> = {
  REQUEST:
    'A calendar invitation (invite.ics) is attached so you can add this confirmed event to your calendar.',
  CANCEL:
    'The calendar invitation for this event is cancelled. Your calendar app can remove it using the attached update.',
};

export function bookingCalendarInvite(
  booking: BookingNoticeSource,
  method: CalendarMethod,
  stamp: Date,
) {
  return buildCalendarInvite({
    method,
    uid: bookingCalendarUid(booking.id),
    // The booking revision increases with every staff action, so a cancellation always
    // carries a higher SEQUENCE than the confirmation it replaces.
    sequence: booking.revision,
    stamp,
    start: booking.startsAt,
    end: booking.endsAt,
    summary: `${booking.eventType} at ${BRAND.legalName}`,
    description: [
      `Reservation ${booking.reference}`,
      `Package: ${booking.packageName}`,
      `Guests: ${booking.guests}`,
      method === 'CANCEL' ? 'This reservation was cancelled.' : 'This reservation is confirmed.',
      `Questions: ${BRAND.contact.phone} or ${BRAND.contact.email}`,
    ].join('\n'),
    location: VENUE_LOCATION,
    organizer: { name: BRAND.legalName, email: BRAND.contact.email },
    attendees: [{ name: booking.clientName, email: booking.email }],
  });
}

/**
 * Enqueues the standard client notice for an admin booking decision inside its transaction.
 * The row doubles as the business event record that analytics reads, so it is always written.
 */
export async function enqueueBookingNotice(
  db: OutboxDb,
  input: {
    booking: BookingNoticeSource;
    event: string;
    paid: number;
    instructions: string;
    calendar?: CalendarMethod;
    now?: Date;
  },
) {
  const now = input.now ?? new Date();
  const { booking, event, calendar } = input;
  if (calendar === 'CANCEL')
    // A cancellation supersedes unsent confirmation and reminder emails for this booking.
    await db.adminOutbox.updateMany({
      where: {
        bookingId: booking.id,
        status: 'QUEUED',
        event: { in: ['RESERVATION_CONFIRMED', 'EVENT_REMINDER_7D', 'EVENT_REMINDER_1D'] },
      },
      data: {
        status: 'EXPIRED',
        lastError: 'Not sent: the reservation was cancelled before this message went out.',
      },
    });
  const notice = bookingEmail(booking, input.paid, input.instructions, event);
  const rendered = renderPlainNotice({
    subject: notice.subject,
    heading: automationJobLabel(event),
    body: notice.body,
    extra: calendar ? [CALENDAR_NOTES[calendar]] : [],
  });
  const [id] = await enqueueJobs(
    db,
    [
      {
        idempotencyKey: `booking:${booking.id}:${event}:r${booking.revision}`,
        event,
        recipient: booking.email,
        bookingId: booking.id,
        ...rendered,
        calendar: calendar
          ? { method: calendar, content: bookingCalendarInvite(booking, calendar, now) }
          : null,
      },
    ],
    now,
  );
  return id ?? null;
}
