import 'server-only';

import { BRAND } from '@/config/brand';
import { bookingEmail } from '@/lib/admin/domain';
import { isEmailAddress } from '@/lib/email-address';
import { automationJobLabel } from './catalog';
import { applicationUrl } from './config';
import { buildCalendarInvite, type CalendarInvite, type CalendarMethod } from './ics';
import { enqueueJobs, type NewAutomationJob, type OutboxDb } from './outbox';
import { resolveStaffRecipients } from './recipients';
import { renderPlainNotice, staffCalendarNotice, VENUE_LOCATION } from './templates';

export type BookingNoticeSource = {
  id: string;
  reference: string;
  clientName: string;
  email: string;
  phone: string;
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

const STAFF_CALENDAR_EVENTS: Record<CalendarMethod, string> = {
  REQUEST: 'STAFF_CALENDAR_REQUEST',
  CANCEL: 'STAFF_CALENDAR_CANCEL',
};

/** The client's and the staff copies describe the same event: same UID, SEQUENCE and organizer. */
function bookingCalendar(
  booking: BookingNoticeSource,
  method: CalendarMethod,
  stamp: Date,
  content: Pick<CalendarInvite, 'summary' | 'description' | 'attendees'>,
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
    location: VENUE_LOCATION,
    organizer: { name: BRAND.legalName, email: BRAND.contact.email },
    ...content,
  });
}

export function bookingCalendarInvite(
  booking: BookingNoticeSource,
  method: CalendarMethod,
  stamp: Date,
) {
  return bookingCalendar(booking, method, stamp, {
    summary: `${booking.eventType} at ${BRAND.legalName}`,
    description: [
      `Reservation ${booking.reference}`,
      `Package: ${booking.packageName}`,
      `Guests: ${booking.guests}`,
      method === 'CANCEL' ? 'This reservation was cancelled.' : 'This reservation is confirmed.',
      `Questions: ${BRAND.contact.phone} or ${BRAND.contact.email}`,
    ].join('\n'),
    attendees: [{ name: booking.clientName, email: booking.email }],
  });
}

/** The staff copy names the client, because every event in a staff calendar is at the venue. */
export function staffBookingCalendarInvite(
  booking: BookingNoticeSource,
  method: CalendarMethod,
  stamp: Date,
  staffEmails: readonly string[],
) {
  return bookingCalendar(booking, method, stamp, {
    summary: `${booking.eventType}: ${booking.clientName} (${booking.reference})`,
    description: [
      `Reservation ${booking.reference}`,
      `Client: ${booking.clientName}`,
      `Contact: ${booking.email}, ${booking.phone}`,
      `Package: ${booking.packageName}`,
      `Guests: ${booking.guests}`,
      method === 'CANCEL' ? 'This reservation was cancelled.' : 'This reservation is confirmed.',
    ].join('\n'),
    attendees: staffEmails.map((email) => ({ name: email, email })),
  });
}

/** The inboxes whose calendars hold the event: the latest staff invitation not superseded. */
async function invitedStaffEmails(db: OutboxDb, bookingId: string) {
  const invitation = await db.adminOutbox.findFirst({
    where: { bookingId, event: STAFF_CALENDAR_EVENTS.REQUEST, status: { not: 'EXPIRED' } },
    orderBy: { createdAt: 'desc' },
    select: { recipient: true },
  });
  return (invitation?.recipient ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(isEmailAddress);
}

/**
 * The staff copy of a calendar change, or null when no staff inbox should receive one. An
 * invitation goes to the staff inboxes of this moment, fixed in its ATTENDEE lines; its
 * cancellation goes to the inboxes that were invited, even if Settings changed since.
 */
async function staffCalendarJob(
  db: OutboxDb,
  booking: BookingNoticeSource,
  method: CalendarMethod,
  now: Date,
): Promise<NewAutomationJob | null> {
  const emails =
    method === 'REQUEST'
      ? (await resolveStaffRecipients(db)).emails
      : await invitedStaffEmails(db, booking.id);
  if (!emails.length) return null;
  const event = STAFF_CALENDAR_EVENTS[method];
  const appUrl = applicationUrl();
  return {
    idempotencyKey: `booking:${booking.id}:${event}:r${booking.revision}`,
    event,
    recipient: emails.join(', '),
    replyTo: booking.email,
    bookingId: booking.id,
    ...staffCalendarNotice(
      booking,
      method,
      appUrl
        ? `${appUrl}/admin/bookings?status=${method === 'CANCEL' ? 'cancelled' : 'confirmed'}`
        : null,
    ),
    calendar: { method, content: staffBookingCalendarInvite(booking, method, now, emails) },
  };
}

/**
 * Enqueues the standard client notice for an admin booking decision inside its transaction, plus
 * the staff calendar copy when the decision changes the calendar. The client row doubles as the
 * business event record that analytics reads, so it is always written. Returns the ids of the
 * jobs ready for immediate delivery.
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
    // A cancellation supersedes unsent confirmation, reminder and staff invitation emails for
    // this booking; a staff invitation that never went out needs no staff cancellation.
    await db.adminOutbox.updateMany({
      where: {
        bookingId: booking.id,
        status: 'QUEUED',
        event: {
          in: [
            'RESERVATION_CONFIRMED',
            'EVENT_REMINDER_7D',
            'EVENT_REMINDER_1D',
            STAFF_CALENDAR_EVENTS.REQUEST,
          ],
        },
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
  const clientNotice: NewAutomationJob = {
    idempotencyKey: `booking:${booking.id}:${event}:r${booking.revision}`,
    event,
    recipient: booking.email,
    bookingId: booking.id,
    ...rendered,
    calendar: calendar
      ? { method: calendar, content: bookingCalendarInvite(booking, calendar, now) }
      : null,
  };
  const staffCopy = calendar ? await staffCalendarJob(db, booking, calendar, now) : null;
  return enqueueJobs(db, staffCopy ? [clientNotice, staffCopy] : [clientNotice], now);
}
