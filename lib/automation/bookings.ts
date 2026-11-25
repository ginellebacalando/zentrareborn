import 'server-only';

import { BRAND } from '@/config/brand';
import { bookingEmail } from '@/lib/admin/domain';
import { isEmailAddress } from '@/lib/email-address';
import { automationJobLabel, STAFF_RECIPIENT_LIMITS } from './catalog';
import { paymentPageUrl } from '@/lib/payment-link';
import { applicationUrl } from './config';
import { buildCalendarInvite, type CalendarInvite, type CalendarMethod } from './ics';
import { enqueueJobs, type NewAutomationJob, type OutboxDb } from './outbox';
import { resolveStaffRecipients } from './recipients';
import {
  renderPlainNotice,
  staffCalendarNotice,
  VENUE_LOCATION,
  type StaffCalendarNoticeKind,
} from './templates';

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
  /** Payment deadline while an approved request holds its date (booking automation). */
  holdExpiresAt?: Date | null;
};

/** The booking fields the staff copy of its calendar event needs. */
export type StaffCalendarSource = Pick<
  BookingNoticeSource,
  | 'id'
  | 'reference'
  | 'clientName'
  | 'email'
  | 'phone'
  | 'eventType'
  | 'packageName'
  | 'guests'
  | 'startsAt'
  | 'endsAt'
  | 'revision'
>;

/**
 * How a booking change affects its event in the staff calendars. A request appears as a pending
 * event as soon as it arrives; confirming it turns that same event into the reservation, and
 * declining, cancelling or a missed payment deadline removes it.
 */
export type StaffCalendarChange = 'PENDING' | 'CONFIRMED' | 'DECLINED' | 'CANCELLED' | 'EXPIRED';

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

/** Notices that ask the client to pay, so they link to the private payment page. */
const PAYMENT_LINK_EVENTS = new Set(['REQUEST_APPROVED', 'HOLD_EXTENDED', 'PAYMENT_REJECTED']);

const STAFF_CALENDAR_EVENTS = {
  PENDING: 'STAFF_CALENDAR_PENDING',
  REQUEST: 'STAFF_CALENDAR_REQUEST',
  CANCEL: 'STAFF_CALENDAR_CANCEL',
} as const;

/** The last line of the staff event's description: what the event is now. */
const STAFF_EVENT_STATUS: Record<StaffCalendarNoticeKind, string> = {
  PENDING: 'Booking request awaiting review. The date is not reserved until staff confirm it.',
  CONFIRMED: 'This reservation is confirmed.',
  CONFIRMED_CANCELLED: 'This reservation was cancelled.',
  REQUEST_DECLINED: 'This booking request was declined.',
  REQUEST_CANCELLED: 'This booking request was cancelled.',
  REQUEST_EXPIRED: 'The payment deadline passed, so the date was released.',
};

/** The Bookings view each staff email links to, matching the dashboard status cards. */
const STAFF_BOOKINGS_VIEW: Record<StaffCalendarNoticeKind, string> = {
  PENDING: 'request',
  CONFIRMED: 'confirmed',
  CONFIRMED_CANCELLED: 'cancelled',
  REQUEST_DECLINED: 'cancelled',
  REQUEST_CANCELLED: 'cancelled',
  REQUEST_EXPIRED: 'cancelled',
};

/** Unsent staff calendar emails that a newer change replaces, and the reason shown for each. */
const SUPERSEDED_STAFF_EMAILS: Record<StaffCalendarChange, { events: string[]; reason: string }> = {
  PENDING: {
    events: [STAFF_CALENDAR_EVENTS.PENDING],
    reason: 'Not sent: a newer version of this pending calendar event replaced it.',
  },
  CONFIRMED: {
    events: [STAFF_CALENDAR_EVENTS.PENDING],
    reason: 'Not sent: the request was confirmed before its pending calendar event went out.',
  },
  DECLINED: {
    events: [STAFF_CALENDAR_EVENTS.PENDING, STAFF_CALENDAR_EVENTS.REQUEST],
    reason: 'Not sent: the request was declined before this message went out.',
  },
  CANCELLED: {
    events: [STAFF_CALENDAR_EVENTS.PENDING, STAFF_CALENDAR_EVENTS.REQUEST],
    reason: 'Not sent: the reservation was cancelled before this message went out.',
  },
  EXPIRED: {
    events: [STAFF_CALENDAR_EVENTS.PENDING, STAFF_CALENDAR_EVENTS.REQUEST],
    reason: 'Not sent: the payment deadline passed before this message went out.',
  },
};

function removesEvent(kind: StaffCalendarNoticeKind) {
  return (
    kind === 'CONFIRMED_CANCELLED' ||
    kind === 'REQUEST_DECLINED' ||
    kind === 'REQUEST_CANCELLED' ||
    kind === 'REQUEST_EXPIRED'
  );
}

function staffEventFor(change: StaffCalendarChange) {
  if (change === 'PENDING') return STAFF_CALENDAR_EVENTS.PENDING;
  return change === 'CONFIRMED' ? STAFF_CALENDAR_EVENTS.REQUEST : STAFF_CALENDAR_EVENTS.CANCEL;
}

function staffCalendarKey(booking: { id: string; revision: number }, event: string) {
  return `booking:${booking.id}:${event}:r${booking.revision}`;
}

/** The client's and the staff copies describe the same event: same UID, SEQUENCE and organizer. */
function bookingCalendar(
  booking: Pick<BookingNoticeSource, 'id' | 'revision' | 'startsAt' | 'endsAt'>,
  method: CalendarMethod,
  stamp: Date,
  content: Pick<CalendarInvite, 'summary' | 'description' | 'attendees' | 'status'>,
) {
  return buildCalendarInvite({
    method,
    uid: bookingCalendarUid(booking.id),
    // The booking revision increases with every staff action, so each update or cancellation
    // carries a higher SEQUENCE than the version of the event it replaces.
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

/**
 * The staff copy names the client, because every event in a staff calendar is at the venue. A
 * pending request is TENTATIVE, does not show the time as busy, and its title starts with
 * "[Pending]" so it stands apart from confirmed reservations.
 */
export function staffBookingCalendarInvite(
  booking: StaffCalendarSource,
  kind: StaffCalendarNoticeKind,
  stamp: Date,
  staffEmails: readonly string[],
) {
  const pending = kind === 'PENDING';
  const reserved = kind === 'CONFIRMED' || kind === 'CONFIRMED_CANCELLED';
  return bookingCalendar(booking, removesEvent(kind) ? 'CANCEL' : 'REQUEST', stamp, {
    summary: `${pending ? '[Pending] ' : ''}${booking.eventType}: ${booking.clientName} (${booking.reference})`,
    description: [
      `${reserved ? 'Reservation' : 'Booking request'} ${booking.reference}`,
      `Client: ${booking.clientName}`,
      `Contact: ${booking.email}, ${booking.phone}`,
      `Package: ${booking.packageName}`,
      `Guests: ${booking.guests}`,
      STAFF_EVENT_STATUS[kind],
    ].join('\n'),
    attendees: staffEmails.map((email) => ({ name: email, email })),
    status: pending ? 'TENTATIVE' : 'CONFIRMED',
  });
}

/** Staff inboxes in order, without duplicates, within the outbox's 255-character recipient column. */
function staffRecipientList(addresses: readonly string[]) {
  const list: string[] = [];
  for (const address of addresses) {
    const email = address.trim().toLowerCase();
    if (!isEmailAddress(email) || list.includes(email)) continue;
    if ([...list, email].join(', ').length > STAFF_RECIPIENT_LIMITS.listLength) continue;
    list.push(email);
  }
  return list;
}

type HeldStaffEvent = { state: 'PENDING' | 'CONFIRMED'; emails: string[] };

/**
 * What the staff calendars hold for this booking, read from its latest staff calendar email that
 * was not skipped: a pending or confirmed event and the inboxes it went to, or nothing once a
 * cancellation was prepared.
 */
async function heldStaffEvent(db: OutboxDb, bookingId: string): Promise<HeldStaffEvent | null> {
  const latest = await db.adminOutbox.findFirst({
    where: {
      bookingId,
      event: { in: Object.values(STAFF_CALENDAR_EVENTS) },
      status: { not: 'EXPIRED' },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { event: true, recipient: true },
  });
  if (!latest || latest.event === STAFF_CALENDAR_EVENTS.CANCEL) return null;
  const emails = staffRecipientList(latest.recipient.split(','));
  if (!emails.length) return null;
  return {
    state: latest.event === STAFF_CALENDAR_EVENTS.PENDING ? 'PENDING' : 'CONFIRMED',
    emails,
  };
}

function staffNoticeKind(
  change: StaffCalendarChange,
  held: HeldStaffEvent | null,
): StaffCalendarNoticeKind {
  if (change === 'PENDING' || change === 'CONFIRMED') return change;
  if (held?.state === 'PENDING')
    return change === 'DECLINED'
      ? 'REQUEST_DECLINED'
      : change === 'EXPIRED'
        ? 'REQUEST_EXPIRED'
        : 'REQUEST_CANCELLED';
  return 'CONFIRMED_CANCELLED';
}

/**
 * The staff copy of a calendar change, or null when no staff inbox should receive one. A pending
 * or confirmed event goes to the staff inboxes of this moment and to every inbox whose calendar
 * already holds the event, so the event there is updated in place; the inboxes are fixed in its
 * ATTENDEE lines. A removal goes only to the inboxes whose calendars hold the event, even if
 * Settings changed since.
 */
async function staffCalendarJob(
  db: OutboxDb,
  booking: StaffCalendarSource,
  change: StaffCalendarChange,
  now: Date,
): Promise<NewAutomationJob | null> {
  const held = await heldStaffEvent(db, booking.id);
  const removal = change === 'DECLINED' || change === 'CANCELLED' || change === 'EXPIRED';
  const emails = removal
    ? (held?.emails ?? [])
    : staffRecipientList([...(await resolveStaffRecipients(db)).emails, ...(held?.emails ?? [])]);
  if (!emails.length) return null;
  const kind = staffNoticeKind(change, held);
  const event = staffEventFor(change);
  const appUrl = applicationUrl();
  return {
    idempotencyKey: staffCalendarKey(booking, event),
    event,
    recipient: emails.join(', '),
    replyTo: booking.email,
    bookingId: booking.id,
    ...staffCalendarNotice(
      booking,
      kind,
      appUrl ? `${appUrl}/admin/bookings?status=${STAFF_BOOKINGS_VIEW[kind]}` : null,
    ),
    calendar: {
      method: removal ? 'CANCEL' : 'REQUEST',
      content: staffBookingCalendarInvite(booking, kind, now, emails),
    },
  };
}

/**
 * The staff calendar email for a booking change, or null when no staff inbox should receive one.
 * Unsent staff calendar emails that the change replaces are skipped first, so they are never sent
 * late and do not count as calendars that hold the event. Call it inside the change's transaction.
 */
export async function staffCalendarUpdate(
  db: OutboxDb,
  booking: StaffCalendarSource,
  change: StaffCalendarChange,
  now = new Date(),
) {
  const superseded = SUPERSEDED_STAFF_EMAILS[change];
  await db.adminOutbox.updateMany({
    where: {
      bookingId: booking.id,
      status: 'QUEUED',
      event: { in: superseded.events },
      // A repeated call for the same revision keeps its own email (idempotent enqueue).
      NOT: { idempotencyKey: staffCalendarKey(booking, staffEventFor(change)) },
    },
    data: { status: 'EXPIRED', lastError: superseded.reason },
  });
  return staffCalendarJob(db, booking, change, now);
}

/** Enqueues only the staff calendar email of a change, such as an edited request. */
export async function enqueueStaffCalendarUpdate(
  db: OutboxDb,
  booking: StaffCalendarSource,
  change: StaffCalendarChange,
  now = new Date(),
) {
  const job = await staffCalendarUpdate(db, booking, change, now);
  return job ? enqueueJobs(db, [job], now) : [];
}

/**
 * Enqueues the standard client notice for an admin booking decision inside its transaction, plus
 * the staff calendar email when the decision changes the staff calendars. The client row doubles
 * as the business event record that analytics reads, so it is always written. Returns the ids of
 * the jobs ready for immediate delivery.
 */
export async function enqueueBookingNotice(
  db: OutboxDb,
  input: {
    booking: BookingNoticeSource;
    event: string;
    paid: number;
    instructions: string;
    /** The client's calendar update: an invitation on confirmation, a cancellation after one. */
    calendar?: CalendarMethod;
    /** The staff calendar change; by default it follows the client's calendar update. */
    staffCalendar?: StaffCalendarChange;
    /** Event-specific detail for the client, such as why a payment screenshot was not accepted. */
    note?: string;
    now?: Date;
  },
) {
  const now = input.now ?? new Date();
  const { booking, event, calendar } = input;
  const staffCalendar =
    input.staffCalendar ??
    (calendar === 'REQUEST' ? 'CONFIRMED' : calendar === 'CANCEL' ? 'CANCELLED' : undefined);
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
  const notice = bookingEmail(booking, input.paid, input.instructions, event, input.note);
  const waitingForPayment = booking.reservation === 'REQUESTED' && booking.approval === 'APPROVED';
  const paymentUrl =
    waitingForPayment && PAYMENT_LINK_EVENTS.has(event) ? paymentPageUrl(booking.id) : null;
  const rendered = renderPlainNotice({
    subject: notice.subject,
    heading: automationJobLabel(event),
    body: notice.body,
    extra: calendar ? [CALENDAR_NOTES[calendar]] : [],
    action: paymentUrl
      ? { label: 'See how to pay or upload your payment', href: paymentUrl }
      : undefined,
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
  const staffCopy = staffCalendar
    ? await staffCalendarUpdate(db, booking, staffCalendar, now)
    : null;
  return enqueueJobs(db, staffCopy ? [clientNotice, staffCopy] : [clientNotice], now);
}
