import 'server-only';

import { appointmentLabel, type AppointmentPurpose } from '@/lib/appointments';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { readVisitRules } from '@/lib/admin/preferences';
import type { VisitActor } from '@/lib/automation/visit-emails';
import {
  enqueueVisitChange,
  visitNoticeSelect,
  type VisitNoticeSource,
} from '@/lib/automation/visits';
import { OCCUPYING_BOOKINGS } from '@/lib/booking-occupancy';
import { prisma } from '@/lib/prisma';
import {
  findVisitSlot,
  manilaDateKey,
  visitDays,
  VISIT_BOOKING_DAYS,
  type TakenTime,
  type VisitRules,
} from '@/lib/visit-rules';
import type { VisitSource } from '@/lib/visit-types';

/**
 * The ocular visit workflow shared by the public visit pages and the admin Front desk
 * (docs/visits.md). Every change runs in one transaction with its emails, serialized with the
 * venue's bookings so a visit never takes the last place twice or lands on an event.
 */

type Db = Prisma.TransactionClient;

/** The admin calendar's single venue (lib/admin/domain.ts); its events block visit times. */
const VENUE = 'Zion Events Place';
const DAY_MS = 24 * 60 * 60_000;
/** Visits that hold their time. */
const ACTIVE_STATUSES = ['SCHEDULED', 'CHECKED_IN'];

export class VisitError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    /** A machine-readable reason for pages that react to it, such as TIME_TAKEN. */
    readonly code?: 'TIME_TAKEN',
  ) {
    super(message);
    this.name = 'VisitError';
  }
}

/** Who made a change, for the activity log. */
export type VisitAuditActor = {
  userId: string | null;
  userName: string;
  userRole: string;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type NewVisit = {
  clientName: string;
  email: string;
  phone: string;
  startsAt: Date;
  source: VisitSource;
  eventType: string;
  eventDate: Date | null;
  guests: number | null;
  message: string;
  staffNotes?: string;
  /** What it is for (lib/appointments.ts); a visit from the website is always OCULAR. */
  purpose?: AppointmentPurpose;
  title?: string;
  place?: string;
  consentAt: Date | null;
  createdBy: string | null;
};

function visitReference(now: Date) {
  return `VIS-${manilaDateKey(now).slice(0, 4)}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

/** The website requires the saved notice; staff at the front desk may offer any open time. */
async function effectiveRules(db: Db, staff: boolean): Promise<VisitRules> {
  const rules = await readVisitRules(db);
  return staff ? { ...rules, noticeHours: 0 } : rules;
}

/** Visits that hold a place, and events at the venue that block visits, within a window. */
async function busyTimes(db: Db, from: Date, to: Date, exceptVisitId?: string) {
  const [taken, blocked] = await Promise.all([
    db.adminVisit.findMany({
      where: {
        status: { in: ACTIVE_STATUSES },
        startsAt: { lt: to },
        endsAt: { gt: from },
        ...(exceptVisitId ? { id: { not: exceptVisitId } } : {}),
      },
      select: { startsAt: true, endsAt: true },
    }),
    db.adminBooking.findMany({
      where: { venue: VENUE, startsAt: { lt: to }, endsAt: { gt: from }, OR: OCCUPYING_BOOKINGS },
      select: { startsAt: true, endsAt: true },
    }),
  ]);
  return { taken: taken as TakenTime[], blocked: blocked as TakenTime[] };
}

/** The open visit days from now; staff see times without the website's notice. */
export async function readVisitAvailability(
  options: { now?: Date; staff?: boolean; exceptVisitId?: string } = {},
) {
  const now = options.now ?? new Date();
  const rules = await effectiveRules(prisma, Boolean(options.staff));
  const { taken, blocked } = await busyTimes(
    prisma,
    now,
    new Date(now.getTime() + (VISIT_BOOKING_DAYS + 1) * DAY_MS),
    options.exceptVisitId,
  );
  return {
    slotMinutes: rules.slotMinutes,
    days: visitDays(rules, now, VISIT_BOOKING_DAYS, taken, blocked),
  };
}

/** Serializes visit changes with each other and with the venue's booking holds. */
async function lockVenue(tx: Db) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${VENUE}))::text`;
}

/** The open time that starts at `startsAt`, rechecked under the lock. */
async function openTime(
  tx: Db,
  startsAt: Date,
  options: { now: Date; staff: boolean; exceptVisitId?: string },
) {
  const rules = await effectiveRules(tx, options.staff);
  const endsAt = new Date(startsAt.getTime() + rules.slotMinutes * 60_000);
  const { taken, blocked } = await busyTimes(tx, startsAt, endsAt, options.exceptVisitId);
  const slot = findVisitSlot(rules, options.now, startsAt, taken, blocked);
  if (!slot)
    throw new VisitError(
      'That time is no longer available. Please choose another time.',
      409,
      'TIME_TAKEN',
    );
  return { startsAt: new Date(slot.startsAt), endsAt: new Date(slot.endsAt) };
}

async function audit(
  tx: Db,
  actor: VisitAuditActor,
  action: 'CREATE' | 'UPDATE',
  description: string,
  visitId: string,
) {
  await tx.auditLog.create({
    data: {
      userId: actor.userId,
      userName: actor.userName,
      userRole: actor.userRole,
      action,
      module: 'Front desk',
      description,
      status: 'SUCCESS',
      source: 'zion-admin',
      ipAddress: actor.ipAddress ?? null,
      userAgent: actor.userAgent ?? null,
      metadata: { visitId },
    },
  });
}

function when(visit: { startsAt: Date }) {
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(visit.startsAt);
}

/**
 * Saves a visit at an open time with its emails. `guard` runs under the lock before the visit is
 * saved, for checks that must not race (the website's limits per visitor).
 */
export async function createVisit(
  input: NewVisit,
  options: {
    staff: boolean;
    actor: VisitAuditActor;
    now?: Date;
    guard?: (tx: Db) => Promise<void>;
  },
) {
  const now = options.now ?? new Date();
  return prisma.$transaction(
    async (tx) => {
      await lockVenue(tx);
      await options.guard?.(tx);
      const time = await openTime(tx, input.startsAt, { now, staff: options.staff });
      const visit = await tx.adminVisit.create({
        data: {
          reference: visitReference(now),
          clientName: input.clientName,
          email: input.email,
          phone: input.phone,
          startsAt: time.startsAt,
          endsAt: time.endsAt,
          scheduledAt: now,
          source: input.source,
          eventType: input.eventType,
          eventDate: input.eventDate,
          guests: input.guests,
          message: input.message,
          staffNotes: input.staffNotes ?? '',
          purpose: input.purpose ?? 'OCULAR',
          title: input.title ?? '',
          place: input.place ?? '',
          consentAt: input.consentAt,
          createdBy: input.createdBy,
        },
        select: visitNoticeSelect,
      });
      await audit(
        tx,
        options.actor,
        'CREATE',
        `${appointmentLabel(visit)} ${visit.reference} scheduled for ${when(visit)} (${input.source === 'STAFF' ? 'staff' : 'website'}).`,
        visit.id,
      );
      const notificationIds = await enqueueVisitChange(tx, {
        visit,
        change: 'SCHEDULED',
        by: options.staff ? 'STAFF' : 'VISITOR',
        now,
      });
      return { visit, notificationIds };
    },
    { maxWait: 10_000, timeout: 15_000 },
  );
}

/** The visit, locked for a change, or an error when it cannot change any more. */
async function changeableVisit(tx: Db, visitId: string, expectedRevision?: number) {
  const visit = await tx.adminVisit.findUnique({
    where: { id: visitId },
    select: { ...visitNoticeSelect, status: true },
  });
  if (!visit) throw new VisitError('This visit was not found.', 404);
  if (visit.status !== 'SCHEDULED')
    throw new VisitError('This visit can no longer be changed.', 409);
  if (expectedRevision !== undefined && visit.revision !== expectedRevision)
    throw new VisitError('This visit changed in the meantime. Reload the page and try again.', 409);
  return visit;
}

/** Moves a scheduled visit to another open time; the visitor and staff get the new time. */
export async function rescheduleVisit(
  visitId: string,
  startsAt: Date,
  options: {
    by: VisitActor;
    actor: VisitAuditActor;
    expectedRevision?: number;
    now?: Date;
  },
) {
  const now = options.now ?? new Date();
  return prisma.$transaction(
    async (tx) => {
      await lockVenue(tx);
      const current = await changeableVisit(tx, visitId, options.expectedRevision);
      if (current.startsAt.getTime() === startsAt.getTime())
        throw new VisitError('The visit is already at that time. Choose a different time.');
      const time = await openTime(tx, startsAt, {
        now,
        staff: options.by === 'STAFF',
        exceptVisitId: visitId,
      });
      const visit: VisitNoticeSource = await tx.adminVisit.update({
        where: { id: visitId },
        data: {
          startsAt: time.startsAt,
          endsAt: time.endsAt,
          scheduledAt: now,
          revision: { increment: 1 },
        },
        select: visitNoticeSelect,
      });
      await audit(
        tx,
        options.actor,
        'UPDATE',
        `Ocular visit ${visit.reference} moved from ${when(current)} to ${when(visit)} by ${options.by === 'STAFF' ? 'staff' : 'the visitor'}.`,
        visit.id,
      );
      const notificationIds = await enqueueVisitChange(tx, {
        visit,
        change: 'RESCHEDULED',
        by: options.by,
        now,
      });
      return { visit, notificationIds };
    },
    { maxWait: 10_000, timeout: 15_000 },
  );
}

/** Cancels a scheduled visit; its time opens again and the calendars drop the event. */
export async function cancelVisit(
  visitId: string,
  options: {
    by: VisitActor;
    actor: VisitAuditActor;
    reason: string;
    expectedRevision?: number;
    now?: Date;
  },
) {
  const now = options.now ?? new Date();
  return prisma.$transaction(
    async (tx) => {
      await lockVenue(tx);
      await changeableVisit(tx, visitId, options.expectedRevision);
      const visit: VisitNoticeSource = await tx.adminVisit.update({
        where: { id: visitId },
        data: {
          status: 'CANCELLED',
          cancelledAt: now,
          cancelReason: options.reason,
          revision: { increment: 1 },
        },
        select: visitNoticeSelect,
      });
      await audit(
        tx,
        options.actor,
        'UPDATE',
        `Ocular visit ${visit.reference} on ${when(visit)} cancelled by ${options.by === 'STAFF' ? 'staff' : 'the visitor'}${options.reason ? `: ${options.reason}` : '.'}`,
        visit.id,
      );
      const notificationIds = await enqueueVisitChange(tx, {
        visit,
        change: 'CANCELLED',
        by: options.by,
        now,
      });
      return { visit, notificationIds };
    },
    { maxWait: 10_000, timeout: 15_000 },
  );
}
