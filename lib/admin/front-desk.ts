import 'server-only';

import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { scheduleAutomationDelivery } from '@/lib/automation/trigger';
import { OCCUPYING_BOOKINGS } from '@/lib/booking-occupancy';
import { prisma } from '@/lib/prisma';
import { manilaDateKey } from '@/lib/visit-rules';
import {
  VISIT_FIELD_LIMITS,
  type CalendarVisit,
  type ClientLookup,
  type FrontDeskAgenda,
  type FrontDeskSlots,
  type FrontDeskVisit,
  type VisitSource,
  type VisitStatus,
} from '@/lib/visit-types';
import {
  cancelVisit,
  createVisit,
  readVisitAvailability,
  rescheduleVisit,
  VisitError,
  type VisitAuditActor,
} from '@/lib/visits';
import type { AdminActor } from './access';
import { AdminError } from './errors';
import { readVisitRules } from './preferences';
import { createWalkInBooking, readWalkInOptions, readWalkInPrefill } from './walk-in';

/**
 * The admin Front desk (docs/visits.md): today's agenda of visits and events, upcoming visits,
 * visit outcomes and notes, visits scheduled for callers, a client lookup by email, phone or
 * name with the client's bookings and visits, and walk-in bookings (docs/walk-ins.md).
 */

const DAY_MS = 24 * 60 * 60_000;
const UPCOMING_DAYS = 14;
export const FRONT_DESK_OPERATIONS = [
  'schedule-visit',
  'reschedule-visit',
  'cancel-visit',
  'visit-outcome',
  'visit-notes',
  'walk-in-booking',
] as const;

const visitSelect = {
  id: true,
  reference: true,
  clientName: true,
  email: true,
  phone: true,
  startsAt: true,
  endsAt: true,
  status: true,
  source: true,
  eventType: true,
  eventDate: true,
  guests: true,
  message: true,
  staffNotes: true,
  revision: true,
  checkedInAt: true,
  completedAt: true,
  cancelledAt: true,
  cancelReason: true,
  createdAt: true,
} as const;

type VisitRow = Prisma.AdminVisitGetPayload<{ select: typeof visitSelect }>;

function iso(value: Date | null) {
  return value ? value.toISOString() : null;
}

function visitView(visit: VisitRow): FrontDeskVisit {
  return {
    ...visit,
    status: visit.status as VisitStatus,
    source: visit.source as VisitSource,
    startsAt: visit.startsAt.toISOString(),
    endsAt: visit.endsAt.toISOString(),
    eventDate: visit.eventDate ? visit.eventDate.toISOString().slice(0, 10) : null,
    checkedInAt: iso(visit.checkedInAt),
    completedAt: iso(visit.completedAt),
    cancelledAt: iso(visit.cancelledAt),
    createdAt: visit.createdAt.toISOString(),
  };
}

function manilaDayStart(day: string) {
  return new Date(`${day}T00:00:00+08:00`);
}

function addDays(day: string, days: number) {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Today's visits and events, the next two weeks of visits, and earlier visits left open. */
export async function readFrontDeskAgenda(now = new Date()): Promise<FrontDeskAgenda> {
  const today = manilaDateKey(now);
  const start = manilaDayStart(today);
  const tomorrow = manilaDayStart(addDays(today, 1));
  const until = manilaDayStart(addDays(today, UPCOMING_DAYS + 1));
  const [visitsToday, eventsToday, upcoming, needsOutcome, rules] = await Promise.all([
    prisma.adminVisit.findMany({
      where: { startsAt: { gte: start, lt: tomorrow } },
      orderBy: { startsAt: 'asc' },
      take: 60,
      select: visitSelect,
    }),
    prisma.adminBooking.findMany({
      where: { startsAt: { lt: tomorrow }, endsAt: { gt: start }, OR: OCCUPYING_BOOKINGS },
      orderBy: { startsAt: 'asc' },
      take: 20,
      select: {
        id: true,
        reference: true,
        clientName: true,
        eventType: true,
        packageName: true,
        guests: true,
        startsAt: true,
        endsAt: true,
        reservation: true,
      },
    }),
    prisma.adminVisit.findMany({
      where: { status: 'SCHEDULED', startsAt: { gte: tomorrow, lt: until } },
      orderBy: { startsAt: 'asc' },
      take: 60,
      select: visitSelect,
    }),
    prisma.adminVisit.findMany({
      where: { status: { in: ['SCHEDULED', 'CHECKED_IN'] }, startsAt: { lt: start } },
      orderBy: { startsAt: 'desc' },
      take: 20,
      select: visitSelect,
    }),
    readVisitRules(),
  ]);
  return {
    today,
    visitsToday: visitsToday.map(visitView),
    eventsToday: eventsToday.map((event) => ({
      id: event.id,
      reference: event.reference,
      clientName: event.clientName,
      eventType: event.eventType,
      packageName: event.packageName,
      guests: event.guests,
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt.toISOString(),
      state: event.reservation === 'CONFIRMED' ? 'CONFIRMED' : 'HELD',
    })),
    upcoming: upcoming.map(visitView),
    needsOutcome: needsOutcome.map(visitView),
    slotMinutes: rules.slotMinutes,
  };
}

/** Booking filters that say nothing about visits; while one is set the Calendar shows none. */
const BOOKING_ONLY_FILTERS = ['approval', 'reservation', 'verification', 'eventType'];

/**
 * The ocular visits of the admin Calendar's month, beside its events: every visit except the
 * cancelled ones, matched by the Calendar's search (name, email or reference). The caller has
 * already checked the `from` and `to` dates.
 */
export async function readCalendarVisits(params: URLSearchParams): Promise<CalendarVisit[]> {
  const from = params.get('from');
  const to = params.get('to');
  if (!from || !to || BOOKING_ONLY_FILTERS.some((key) => params.get(key))) return [];
  const q = (params.get('q') ?? '').trim().slice(0, 100);
  const contains = { contains: q, mode: 'insensitive' as const };
  const rows = await prisma.adminVisit.findMany({
    where: {
      status: { not: 'CANCELLED' },
      startsAt: {
        gte: new Date(`${from}T00:00:00+08:00`),
        lte: new Date(`${to}T23:59:59+08:00`),
      },
      ...(q
        ? { OR: [{ reference: contains }, { clientName: contains }, { email: contains }] }
        : {}),
    },
    orderBy: { startsAt: 'asc' },
    take: 200,
    select: {
      id: true,
      reference: true,
      clientName: true,
      startsAt: true,
      endsAt: true,
      status: true,
    },
  });
  return rows.map((visit) => ({
    ...visit,
    status: visit.status as VisitStatus,
    startsAt: visit.startsAt.toISOString(),
    endsAt: visit.endsAt.toISOString(),
  }));
}

/** Phone numbers match on their last digits, whatever spaces or country code were typed. */
async function idsByPhone(table: 'bookings' | 'visits', digits: string) {
  const tail = digits.slice(-10);
  const rows =
    table === 'bookings'
      ? await prisma.$queryRaw<{ id: string }[]>`
          SELECT id FROM zion_admin_bookings
          WHERE right(regexp_replace(phone, '[^0-9]', '', 'g'), ${tail.length}::int) = ${tail}
          ORDER BY "startsAt" DESC LIMIT 20`
      : await prisma.$queryRaw<{ id: string }[]>`
          SELECT id FROM zion_visits
          WHERE right(regexp_replace(phone, '[^0-9]', '', 'g'), ${tail.length}::int) = ${tail}
          ORDER BY "startsAt" DESC LIMIT 20`;
  return rows.map((row) => row.id);
}

/** A returning client's bookings and visits, by email, phone or part of the name. */
export async function lookupClient(raw: string): Promise<ClientLookup> {
  const query = raw.trim().replace(/\s+/g, ' ').slice(0, 120);
  if (query.length < 3)
    throw new AdminError('Enter at least 3 characters: an email, a phone number or a name.');
  const digits = query.replace(/\D/g, '');
  const byEmail = query.includes('@');
  const byPhone = !byEmail && digits.length >= 7 && /^[\d\s()+.-]+$/.test(query);
  const [bookingIds, visitIds] = byPhone
    ? await Promise.all([idsByPhone('bookings', digits), idsByPhone('visits', digits)])
    : [null, null];
  const match = (field: 'email' | 'clientName') =>
    byEmail
      ? { email: { equals: query, mode: 'insensitive' as const } }
      : { [field]: { contains: query, mode: 'insensitive' as const } };
  const [bookings, visits] = await Promise.all([
    prisma.adminBooking.findMany({
      where: bookingIds ? { id: { in: bookingIds } } : match('clientName'),
      orderBy: { startsAt: 'desc' },
      take: 20,
      select: {
        id: true,
        reference: true,
        clientName: true,
        email: true,
        phone: true,
        eventType: true,
        packageName: true,
        startsAt: true,
        approval: true,
        reservation: true,
      },
    }),
    prisma.adminVisit.findMany({
      where: visitIds ? { id: { in: visitIds } } : match('clientName'),
      orderBy: { startsAt: 'desc' },
      take: 20,
      select: visitSelect,
    }),
  ]);
  return {
    query,
    clientBookings: bookings.map((booking) => ({
      ...booking,
      startsAt: booking.startsAt.toISOString(),
    })),
    clientVisits: visits.map(visitView),
  };
}

/**
 * What the Front desk pages read: the agenda, a lookup, the open visit times for a form, or the
 * walk-in page's options and a client's details to start from (lib/admin/walk-in.ts).
 */
export async function readFrontDesk(params: URLSearchParams) {
  const walkIn = params.get('walk-in');
  if (walkIn === 'options') return readWalkInOptions();
  if (walkIn === 'prefill') return readWalkInPrefill(params);
  const lookup = params.get('lookup');
  if (lookup !== null) return lookupClient(lookup);
  if (params.has('slots')) {
    const except = params.get('except') || undefined;
    const slots: FrontDeskSlots = await readVisitAvailability({
      staff: true,
      exceptVisitId: except,
    });
    return slots;
  }
  return readFrontDeskAgenda();
}

const identifier = z.string().min(1).max(64);
const instant = z.iso.datetime({ offset: true, error: 'Choose a visit time.' });

const scheduleSchema = z
  .object({
    op: z.literal('schedule-visit'),
    visit: z
      .object({
        clientName: z.string().trim().min(2, 'Enter the client name.').max(VISIT_FIELD_LIMITS.name),
        email: z.preprocess(
          (value) => (typeof value === 'string' ? value.trim().toLowerCase() : value),
          z.union([
            z.literal(''),
            z.email('Enter a valid email address.').max(VISIT_FIELD_LIMITS.email),
          ]),
        ),
        phone: z
          .string()
          .trim()
          .regex(/^\+?[\d\s()-]{7,30}$/, 'Enter a valid phone number.'),
        startsAt: instant,
        eventType: z.string().trim().max(VISIT_FIELD_LIMITS.eventType).default(''),
        eventDate: z.union([z.literal(''), z.iso.date('Enter a valid event date.')]).default(''),
        guests: z
          .number()
          .int()
          .min(VISIT_FIELD_LIMITS.guests.min)
          .max(VISIT_FIELD_LIMITS.guests.max)
          .nullable()
          .default(null),
        message: z.string().trim().max(VISIT_FIELD_LIMITS.message).default(''),
        staffNotes: z.string().trim().max(VISIT_FIELD_LIMITS.staffNotes).default(''),
      })
      .strict(),
    consent: z.literal(true, {
      error: 'Confirm that the client agreed to share these details for the visit.',
    }),
  })
  .strict();

const rescheduleSchema = z
  .object({
    op: z.literal('reschedule-visit'),
    id: identifier,
    revision: z.number().int().min(1),
    startsAt: instant,
  })
  .strict();

const cancelSchema = z
  .object({
    op: z.literal('cancel-visit'),
    id: identifier,
    revision: z.number().int().min(1),
    reason: z
      .string()
      .trim()
      .min(3, 'Enter the reason for cancelling.')
      .max(VISIT_FIELD_LIMITS.cancelReason),
  })
  .strict();

const outcomeSchema = z
  .object({
    op: z.literal('visit-outcome'),
    id: identifier,
    outcome: z.enum(['CHECK_IN', 'COMPLETE', 'NO_SHOW']),
  })
  .strict();

const notesSchema = z
  .object({
    op: z.literal('visit-notes'),
    id: identifier,
    staffNotes: z.string().trim().max(VISIT_FIELD_LIMITS.staffNotes),
  })
  .strict();

function auditActor(actor: AdminActor): VisitAuditActor {
  return {
    userId: actor.id,
    userName: actor.fullName || actor.username,
    userRole: actor.role,
  };
}

async function audit(actor: AdminActor, description: string, visitId: string) {
  await prisma.auditLog.create({
    data: {
      ...auditActor(actor),
      action: 'UPDATE',
      module: 'Front desk',
      description,
      status: 'SUCCESS',
      source: 'zion-admin',
      metadata: { visitId },
    },
  });
}

const OUTCOMES = {
  CHECK_IN: { from: ['SCHEDULED'], to: 'CHECKED_IN', label: 'checked in' },
  COMPLETE: { from: ['SCHEDULED', 'CHECKED_IN'], to: 'COMPLETED', label: 'marked completed' },
  NO_SHOW: { from: ['SCHEDULED'], to: 'NO_SHOW', label: 'marked as a no-show' },
} as const;

/** Check in, complete or mark a no-show: one step forward, never back to an earlier state. */
async function recordOutcome(input: z.infer<typeof outcomeSchema>, actor: AdminActor) {
  const now = new Date();
  const visit = await prisma.adminVisit.findUnique({
    where: { id: input.id },
    select: { reference: true, status: true, startsAt: true },
  });
  if (!visit) throw new AdminError('Visit not found.', 404);
  const rule = OUTCOMES[input.outcome];
  if (!(rule.from as readonly string[]).includes(visit.status))
    throw new AdminError('This visit was already updated. Reload the front desk.', 409);
  if (input.outcome === 'CHECK_IN' && manilaDateKey(now) !== manilaDateKey(visit.startsAt))
    throw new AdminError('Check-in is only possible on the day of the visit.', 409);
  if (input.outcome !== 'CHECK_IN' && visit.status === 'SCHEDULED' && visit.startsAt > now)
    throw new AdminError(
      input.outcome === 'NO_SHOW'
        ? 'A visit can be marked as a no-show once its time has started.'
        : 'Check the visitor in first, or wait until the visit time has started.',
      409,
    );
  const updated = await prisma.adminVisit.updateMany({
    where: { id: input.id, status: { in: [...rule.from] } },
    data: {
      status: rule.to,
      ...(input.outcome === 'CHECK_IN' ? { checkedInAt: now } : {}),
      ...(input.outcome === 'COMPLETE' ? { completedAt: now } : {}),
    },
  });
  if (!updated.count)
    throw new AdminError('This visit was already updated. Reload the front desk.', 409);
  await audit(actor, `Ocular visit ${visit.reference} ${rule.label}.`, input.id);
  return { id: input.id, status: rule.to };
}

/** The Front desk operations; visit rule errors become admin errors with the same status. */
export async function frontDeskMutate(raw: unknown, actor: AdminActor) {
  try {
    const op = z.object({ op: z.enum(FRONT_DESK_OPERATIONS) }).parse(raw).op;
    if (op === 'schedule-visit') {
      const input = scheduleSchema.parse(raw).visit;
      const now = new Date();
      const { visit, notificationIds } = await createVisit(
        {
          clientName: input.clientName,
          email: input.email,
          phone: input.phone,
          startsAt: new Date(input.startsAt),
          source: 'STAFF',
          eventType: input.eventType,
          eventDate: input.eventDate ? new Date(`${input.eventDate}T00:00:00Z`) : null,
          guests: input.guests,
          message: input.message,
          staffNotes: input.staffNotes,
          consentAt: now,
          createdBy: actor.id,
        },
        { staff: true, actor: auditActor(actor), now },
      );
      scheduleAutomationDelivery(notificationIds);
      return { id: visit.id, reference: visit.reference, emailed: Boolean(input.email) };
    }
    if (op === 'reschedule-visit') {
      const input = rescheduleSchema.parse(raw);
      const { visit, notificationIds } = await rescheduleVisit(input.id, new Date(input.startsAt), {
        by: 'STAFF',
        actor: auditActor(actor),
        expectedRevision: input.revision,
      });
      scheduleAutomationDelivery(notificationIds);
      return { id: visit.id, startsAt: visit.startsAt.toISOString() };
    }
    if (op === 'cancel-visit') {
      const input = cancelSchema.parse(raw);
      const { visit, notificationIds } = await cancelVisit(input.id, {
        by: 'STAFF',
        actor: auditActor(actor),
        reason: input.reason,
        expectedRevision: input.revision,
      });
      scheduleAutomationDelivery(notificationIds);
      return { id: visit.id, status: 'CANCELLED' };
    }
    if (op === 'visit-outcome') return recordOutcome(outcomeSchema.parse(raw), actor);
    if (op === 'walk-in-booking') return createWalkInBooking(raw, actor);
    const input = notesSchema.parse(raw);
    const visit = await prisma.adminVisit.findUnique({
      where: { id: input.id },
      select: { reference: true },
    });
    if (!visit) throw new AdminError('Visit not found.', 404);
    await prisma.adminVisit.update({
      where: { id: input.id },
      data: { staffNotes: input.staffNotes },
    });
    await audit(actor, `Staff notes updated for ocular visit ${visit.reference}.`, input.id);
    return { id: input.id, staffNotes: input.staffNotes };
  } catch (error) {
    if (error instanceof VisitError) throw new AdminError(error.message, error.status);
    throw error;
  }
}
