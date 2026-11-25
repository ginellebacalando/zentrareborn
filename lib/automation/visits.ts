import 'server-only';

import { BRAND } from '@/config/brand';
import { isEmailAddress } from '@/lib/email-address';
import { prisma } from '@/lib/prisma';
import { visitManageUrl } from '@/lib/visit-link';
import { STAFF_RECIPIENT_LIMITS } from './catalog';
import { AUTOMATION_POLICY, applicationUrl } from './config';
import { buildCalendarInvite, type CalendarMethod } from './ics';
import { enqueueJobs, type NewAutomationJob, type OutboxDb } from './outbox';
import { resolveStaffRecipients } from './recipients';
import { VENUE_LOCATION } from './templates';
import { addDays, daysBetween, manilaDay, manilaDayStart, manilaHour } from './time';
import {
  visitCalendarText,
  visitClientNotice,
  visitReminder,
  visitStaffNotice,
  type VisitActor,
  type VisitEmailChange,
  type VisitEmailSource,
} from './visit-emails';

/**
 * Ocular visit emails (docs/visits.md): the visitor's confirmation, new time and cancellation
 * with calendar files, reminders the day before and on the morning, and the staff copy of the
 * calendar event. Every job key starts with `visit:<id>:` and ends with the visit revision, so a
 * change can retire the unsent emails of the time it replaces.
 */

export const VISIT_EVENTS = {
  SCHEDULED: 'VISIT_SCHEDULED',
  RESCHEDULED: 'VISIT_RESCHEDULED',
  CANCELLED: 'VISIT_CANCELLED',
  REMINDER_DAY: 'VISIT_REMINDER_1D',
  REMINDER_TODAY: 'VISIT_REMINDER_TODAY',
  STAFF_CALENDAR: 'VISIT_STAFF_CALENDAR',
  STAFF_CANCEL: 'VISIT_STAFF_CANCEL',
} as const;

export type VisitNoticeSource = VisitEmailSource & { id: string; revision: number };

export const visitNoticeSelect = {
  id: true,
  reference: true,
  clientName: true,
  email: true,
  phone: true,
  startsAt: true,
  endsAt: true,
  source: true,
  eventType: true,
  eventDate: true,
  guests: true,
  message: true,
  revision: true,
} as const;

const CLIENT_EVENTS: Record<VisitEmailChange, string> = {
  SCHEDULED: VISIT_EVENTS.SCHEDULED,
  RESCHEDULED: VISIT_EVENTS.RESCHEDULED,
  CANCELLED: VISIT_EVENTS.CANCELLED,
};

const SUPERSEDED_REASONS: Record<VisitEmailChange, string> = {
  SCHEDULED: 'Not sent: a newer version of this visit email replaced it.',
  RESCHEDULED: 'Not sent: the visit moved to a new time before this message went out.',
  CANCELLED: 'Not sent: the visit was cancelled before this message went out.',
};

/** A visit reminder is not needed when the visit was booked only hours before it. */
const RECENTLY_SCHEDULED_MS = 12 * 60 * 60_000;
/** The morning reminder is only useful while the visit is at least an hour away. */
const MORNING_REMINDER_LEAD_MS = 60 * 60_000;

/** One calendar event per visit: updates and the cancellation reuse this UID. */
export function visitCalendarUid(visitId: string) {
  return `visit-${visitId}@zion-events-place`;
}

function jobKey(visit: { id: string; revision: number }, kind: string) {
  return `visit:${visit.id}:${kind}:r${visit.revision}`;
}

function jobKeyPrefix(visitId: string) {
  return `visit:${visitId}:`;
}

/** The visit and revision a visit job was written for, read from its idempotency key. */
export function parseVisitJobKey(key: string | null) {
  const match = key?.match(/^visit:([^:]+):[a-z-]+:r(\d+)$/);
  return match ? { visitId: match[1], revision: Number(match[2]) } : null;
}

function visitCalendar(
  visit: VisitNoticeSource,
  method: CalendarMethod,
  stamp: Date,
  audience: 'client' | 'staff',
  attendees: { name: string; email: string }[],
  manageUrl: string | null,
) {
  const status =
    method === 'CANCEL' ? 'This visit was cancelled.' : 'This ocular visit is scheduled.';
  return buildCalendarInvite({
    method,
    uid: visitCalendarUid(visit.id),
    // The revision increases with every new time and with the cancellation, so each update
    // carries a higher SEQUENCE than the version of the event it replaces.
    sequence: visit.revision,
    stamp,
    start: visit.startsAt,
    end: visit.endsAt,
    location: VENUE_LOCATION,
    organizer: { name: BRAND.legalName, email: BRAND.contact.email },
    attendees,
    ...visitCalendarText(visit, audience, status, manageUrl),
  });
}

/** Staff inboxes in order, without duplicates, within the outbox's recipient column. */
function staffList(addresses: readonly string[]) {
  const list: string[] = [];
  for (const address of addresses) {
    const email = address.trim().toLowerCase();
    if (!isEmailAddress(email) || list.includes(email)) continue;
    if ([...list, email].join(', ').length > STAFF_RECIPIENT_LIMITS.listLength) continue;
    list.push(email);
  }
  return list;
}

/**
 * The inboxes whose calendars hold this visit: those of its latest staff calendar email that
 * was not skipped, or none once a cancellation was prepared.
 */
async function heldStaffInboxes(db: OutboxDb, visitId: string) {
  const latest = await db.adminOutbox.findFirst({
    where: {
      idempotencyKey: { startsWith: jobKeyPrefix(visitId) },
      event: { in: [VISIT_EVENTS.STAFF_CALENDAR, VISIT_EVENTS.STAFF_CANCEL] },
      status: { not: 'EXPIRED' },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { event: true, recipient: true },
  });
  return latest && latest.event === VISIT_EVENTS.STAFF_CALENDAR
    ? staffList(latest.recipient.split(','))
    : [];
}

/**
 * Enqueues the emails of a visit change inside its transaction: the visitor's email with the
 * calendar file (when the visit has an email address) and the staff copy of the calendar event.
 * Unsent emails of earlier revisions are skipped first, so a moved or cancelled visit never
 * sends a stale time. Returns the ids of jobs ready for immediate delivery.
 */
export async function enqueueVisitChange(
  db: OutboxDb,
  input: { visit: VisitNoticeSource; change: VisitEmailChange; by: VisitActor; now?: Date },
) {
  const now = input.now ?? new Date();
  const { visit, change, by } = input;
  const clientKey = jobKey(visit, change.toLowerCase());
  const staffKey = jobKey(visit, 'staff');
  await db.adminOutbox.updateMany({
    where: {
      idempotencyKey: { startsWith: jobKeyPrefix(visit.id), notIn: [clientKey, staffKey] },
      status: 'QUEUED',
    },
    data: { status: 'EXPIRED', lastError: SUPERSEDED_REASONS[change] },
  });
  const appUrl = applicationUrl();
  const manageUrl = change === 'CANCELLED' ? null : visitManageUrl(visit.id);
  const method: CalendarMethod = change === 'CANCELLED' ? 'CANCEL' : 'REQUEST';
  const jobs: NewAutomationJob[] = [];
  const email = visit.email.trim().toLowerCase();
  if (isEmailAddress(email))
    jobs.push({
      idempotencyKey: clientKey,
      event: CLIENT_EVENTS[change],
      recipient: email,
      ...visitClientNotice(visit, change, by, {
        manage: manageUrl,
        schedule: appUrl ? `${appUrl}/visit` : null,
      }),
      calendar: {
        method,
        content: visitCalendar(
          visit,
          method,
          now,
          'client',
          [{ name: visit.clientName, email }],
          manageUrl,
        ),
      },
      // A confirmation that could not go out before the visit is no longer useful.
      expiresAt: change === 'CANCELLED' ? null : visit.startsAt,
    });
  const held = await heldStaffInboxes(db, visit.id);
  const staff =
    change === 'CANCELLED'
      ? held
      : staffList([...(await resolveStaffRecipients(db)).emails, ...held]);
  if (staff.length)
    jobs.push({
      idempotencyKey: staffKey,
      event: change === 'CANCELLED' ? VISIT_EVENTS.STAFF_CANCEL : VISIT_EVENTS.STAFF_CALENDAR,
      recipient: staff.join(', '),
      replyTo: isEmailAddress(email) ? email : null,
      ...visitStaffNotice(visit, change, by, appUrl ? `${appUrl}/admin/front-desk` : null),
      calendar: {
        method,
        content: visitCalendar(
          visit,
          method,
          now,
          'staff',
          staff.map((address) => ({ name: address, email: address })),
          null,
        ),
      },
    });
  return enqueueJobs(db, jobs, now);
}

/**
 * Prepares visit reminders from the morning onward: one for tomorrow's visits and one on the
 * morning of today's, unless the visit was booked or moved only hours before.
 */
export async function scheduleVisitReminders(now = new Date()) {
  if (manilaHour(now) < AUTOMATION_POLICY.morningHourManila) return 0;
  const today = manilaDay(now);
  const visits = await prisma.adminVisit.findMany({
    where: { status: 'SCHEDULED', startsAt: { gt: now, lt: manilaDayStart(addDays(today, 2)) } },
    orderBy: { startsAt: 'asc' },
    take: 200,
    select: { ...visitNoticeSelect, scheduledAt: true },
  });
  const jobs: NewAutomationJob[] = [];
  for (const visit of visits) {
    const email = visit.email.trim().toLowerCase();
    if (!isEmailAddress(email)) continue;
    if (visit.scheduledAt.getTime() > now.getTime() - RECENTLY_SCHEDULED_MS) continue;
    const visitDay = manilaDay(visit.startsAt);
    const lead = daysBetween(today, visitDay) === 1 ? 'day' : 'today';
    if (lead === 'today' && visit.startsAt.getTime() - now.getTime() < MORNING_REMINDER_LEAD_MS)
      continue;
    jobs.push({
      idempotencyKey: jobKey(visit, lead === 'day' ? 'reminder-day' : 'reminder-today'),
      event: lead === 'day' ? VISIT_EVENTS.REMINDER_DAY : VISIT_EVENTS.REMINDER_TODAY,
      recipient: email,
      ...visitReminder(visit, lead, visitManageUrl(visit.id)),
      // The day-before reminder gives way to the morning one; neither is useful afterwards.
      expiresAt: lead === 'day' ? manilaDayStart(visitDay) : visit.startsAt,
    });
  }
  return (await enqueueJobs(prisma, jobs, now)).length;
}

/**
 * Why a visit email should not be sent at delivery time, or null when it is still right: a
 * reminder or an invitation for a time that changed, or for a visit that was cancelled.
 * Cancellations always go out.
 */
export async function visitJobIrrelevance(
  job: { event: string; idempotencyKey: string | null },
  now: Date,
) {
  if (job.event === VISIT_EVENTS.CANCELLED || job.event === VISIT_EVENTS.STAFF_CANCEL) return null;
  const key = parseVisitJobKey(job.idempotencyKey);
  if (!key) return null;
  const visit = await prisma.adminVisit.findUnique({
    where: { id: key.visitId },
    select: { status: true, revision: true, startsAt: true },
  });
  if (!visit) return 'Not sent: the visit no longer exists.';
  const reminder =
    job.event === VISIT_EVENTS.REMINDER_DAY || job.event === VISIT_EVENTS.REMINDER_TODAY;
  if (reminder)
    return visit.status === 'SCHEDULED' && visit.revision === key.revision && visit.startsAt > now
      ? null
      : 'Not sent: the visit moved, was cancelled or has already started.';
  return visit.status !== 'CANCELLED' && visit.revision === key.revision
    ? null
    : 'Not sent: the visit changed or was cancelled before this message went out.';
}
