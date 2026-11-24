import 'server-only';

import { prisma } from '@/lib/prisma';

/** The admin calendar's venue (see lib/admin/domain.ts); public availability reads the same records. */
const VENUE = 'Zion Events Place';
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type PublicDateAvailability = { booked: string[]; inquired: string[] };

/** Manila calendar date (YYYY-MM-DD) of an instant; Manila has no daylight saving time. */
function manilaDay(instant: Date) {
  return new Date(instant.getTime() + MANILA_OFFSET_MS).toISOString().slice(0, 10);
}

/** Every Manila date an event touches, so an event that runs past midnight blocks both days. */
function manilaDays(startsAt: Date, endsAt: Date) {
  const days: string[] = [];
  const last = manilaDay(new Date(Math.max(startsAt.getTime(), endsAt.getTime() - 1)));
  for (let day = manilaDay(startsAt); day <= last;) {
    days.push(day);
    day = new Date(Date.parse(`${day}T00:00:00Z`) + DAY_MS).toISOString().slice(0, 10);
  }
  return days;
}

/**
 * Dates only, never client details. A date is "booked" when a confirmed reservation touches it and
 * "inquired" when an open request does (rejected, cancelled and completed records are ignored).
 * This is guidance for choosing a date, not a hold: staff confirmation rechecks conflicts.
 */
export async function readPublicDateAvailability(
  from: string,
  to: string,
): Promise<PublicDateAvailability> {
  const start = new Date(`${from}T00:00:00+08:00`);
  const end = new Date(Date.parse(`${to}T00:00:00+08:00`) + DAY_MS);
  const rows = await prisma.adminBooking.findMany({
    where: {
      venue: VENUE,
      startsAt: { lt: end },
      endsAt: { gt: start },
      OR: [
        { reservation: 'CONFIRMED' },
        { reservation: 'REQUESTED', approval: { not: 'REJECTED' } },
      ],
    },
    select: { startsAt: true, endsAt: true, reservation: true },
  });
  const booked = new Set<string>();
  const inquired = new Set<string>();
  for (const row of rows) {
    for (const day of manilaDays(row.startsAt, row.endsAt)) {
      (row.reservation === 'CONFIRMED' ? booked : inquired).add(day);
    }
  }
  const inRange = (day: string) => day >= from && day <= to;
  return {
    booked: [...booked].filter(inRange).sort(),
    inquired: [...inquired].filter((day) => inRange(day) && !booked.has(day)).sort(),
  };
}
