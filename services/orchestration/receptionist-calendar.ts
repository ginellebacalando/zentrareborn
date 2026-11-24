import 'server-only';

import type { Prisma } from '@prisma/client';
import { assertDateKey, assertTime, nextDateKey, venueDateKey } from '@/lib/calendar-time';

/**
 * Read-only projection of the admin calendar for Zeni. Admin confirmation currently locks and
 * conflicts on this one venue literal, so every public space (Selah Hall, Pavilion Garden, the
 * pool) is a conservative alias of the same exclusive scheduling resource.
 */
export const RECEPTIONIST_CALENDAR_VENUE = 'Zion Events Place' as const;

export type ReceptionistCalendarQuery = {
  venue: typeof RECEPTIONIST_CALENDAR_VENUE;
  startsAt: Date;
  endsAt: Date;
};

export type ConfirmedSpan = { startsAt: Date; endsAt: Date };

export interface ReceptionistCalendarSource {
  hasConfirmedOverlap(query: ReceptionistCalendarQuery): Promise<boolean>;
  confirmedSpans(query: ReceptionistCalendarQuery): Promise<ConfirmedSpan[]>;
}

type CalendarBookingReader = {
  findFirst(input: {
    where: Prisma.AdminBookingWhereInput;
    select: { id: true };
  }): Promise<{ id: string } | null>;
  findMany(input: {
    where: Prisma.AdminBookingWhereInput;
    select: { startsAt: true; endsAt: true };
    orderBy: { startsAt: 'asc' };
    take: number;
  }): Promise<ConfirmedSpan[]>;
};

export type AvailabilityCheckRequest = { date: string; startTime?: string; endTime?: string };

export type AvailabilityCheckResult =
  | {
      status: 'AVAILABLE' | 'UNAVAILABLE';
      date: string;
      startTime?: string;
      endTime?: string;
      wholeDay: boolean;
      observedAt: string;
    }
  | { status: 'INVALID'; reason: 'date' | 'time' | 'past'; observedAt: string }
  | { status: 'ERROR'; observedAt: string };

export type ReceptionistCalendarAvailability = {
  check(request: AvailabilityCheckRequest): Promise<AvailabilityCheckResult>;
  /** Manila dates between `from` and `to` (inclusive) that have a confirmed event. */
  unavailableDates(from: string, to: string): Promise<string[]>;
};

export type ReceptionistCalendarDependencies = {
  source?: ReceptionistCalendarSource;
  now?: () => Date;
};

const MAX_CALENDAR_DAYS = 120;

function manilaInstant(date: string, time: string) {
  return new Date(`${assertDateKey(date)}T${assertTime(time)}:00+08:00`);
}

export function confirmedCalendarOverlapWhere(
  query: ReceptionistCalendarQuery,
): Prisma.AdminBookingWhereInput {
  return {
    venue: query.venue,
    reservation: 'CONFIRMED',
    startsAt: { lt: query.endsAt },
    endsAt: { gt: query.startsAt },
  };
}

/** Selects only an opaque id or the confirmed time span: never names, notes or references. */
export function createAdminCalendarSource(
  reader?: CalendarBookingReader,
): ReceptionistCalendarSource {
  async function bookingReader(): Promise<CalendarBookingReader> {
    if (reader) return reader;
    const { prisma } = await import('@/lib/prisma');
    return {
      findFirst: (input) => prisma.adminBooking.findFirst(input),
      findMany: (input) => prisma.adminBooking.findMany(input),
    };
  }
  return {
    async hasConfirmedOverlap(query) {
      const conflict = await (
        await bookingReader()
      ).findFirst({
        where: confirmedCalendarOverlapWhere(query),
        select: { id: true },
      });
      return Boolean(conflict);
    },
    async confirmedSpans(query) {
      return (await bookingReader()).findMany({
        where: confirmedCalendarOverlapWhere(query),
        select: { startsAt: true, endsAt: true },
        orderBy: { startsAt: 'asc' },
        take: 500,
      });
    },
  };
}

function validDate(date: string) {
  try {
    assertDateKey(date);
    return true;
  } catch {
    return false;
  }
}

export function createReceptionistCalendarAvailability(
  dependencies: ReceptionistCalendarDependencies = {},
): ReceptionistCalendarAvailability {
  const source = dependencies.source ?? createAdminCalendarSource();
  const now = dependencies.now ?? (() => new Date());

  return {
    async check(request) {
      const observed = now();
      const observedAt = observed.toISOString();
      if (!validDate(request.date)) return { status: 'INVALID', reason: 'date', observedAt };
      if (request.date < venueDateKey(observed))
        return { status: 'INVALID', reason: 'past', observedAt };
      const wholeDay = !request.startTime || !request.endTime;
      let startsAt: Date;
      let endsAt: Date;
      try {
        startsAt = wholeDay
          ? manilaInstant(request.date, '00:00')
          : manilaInstant(request.date, request.startTime!);
        endsAt = wholeDay
          ? manilaInstant(nextDateKey(request.date), '00:00')
          : manilaInstant(request.date, request.endTime!);
      } catch {
        return { status: 'INVALID', reason: 'time', observedAt };
      }
      // An explicit window must lie ahead; a whole-day check also covers the rest of today.
      if (startsAt >= endsAt || (!wholeDay && startsAt <= observed))
        return { status: 'INVALID', reason: 'time', observedAt };
      let unavailable: boolean;
      try {
        unavailable = await source.hasConfirmedOverlap({
          venue: RECEPTIONIST_CALENDAR_VENUE,
          startsAt,
          endsAt,
        });
      } catch {
        return { status: 'ERROR', observedAt: now().toISOString() };
      }
      return {
        status: unavailable ? 'UNAVAILABLE' : 'AVAILABLE',
        date: request.date,
        ...(wholeDay ? {} : { startTime: request.startTime, endTime: request.endTime }),
        wholeDay,
        observedAt: now().toISOString(),
      };
    },
    async unavailableDates(from, to) {
      if (!validDate(from) || !validDate(to) || from > to) return [];
      const spans = await source.confirmedSpans({
        venue: RECEPTIONIST_CALENDAR_VENUE,
        startsAt: manilaInstant(from, '00:00'),
        endsAt: manilaInstant(nextDateKey(to), '00:00'),
      });
      const dates = new Set<string>();
      for (const span of spans) {
        // A span ending exactly at midnight does not occupy the following date.
        let key = venueDateKey(span.startsAt);
        const last = venueDateKey(new Date(span.endsAt.getTime() - 1));
        for (let day = 0; key <= last && day < MAX_CALENDAR_DAYS; day += 1) {
          if (key >= from && key <= to) dates.add(key);
          key = nextDateKey(key);
        }
      }
      return [...dates].sort();
    },
  };
}
