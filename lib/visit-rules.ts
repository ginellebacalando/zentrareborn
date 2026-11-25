/**
 * Ocular visit rules (docs/visits.md): when Zion receives visitors and how the day is divided
 * into visit times. Pure functions shared by the Settings form, the public visit page and the
 * server, all in Manila time (UTC+8, no daylight saving time).
 */

/** Weekday names in Date.getUTCDay() order: index 0 is Sunday. */
export const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

/** Opening and closing time as 24-hour "HH:MM", or null when Zion takes no visits that day. */
export type VisitDayHours = { open: string; close: string } | null;

export type VisitRules = {
  /** Seven entries in WEEKDAYS order. */
  weekly: VisitDayHours[];
  slotMinutes: number;
  /** How many visits one time can take. */
  capacity: number;
  /** The least time between booking and the visit. */
  noticeHours: number;
  /** Dates without visits (holidays, events), as YYYY-MM-DD. */
  closedDates: string[];
};

export type VisitRuleField =
  `weekly.${number}` | 'slotMinutes' | 'capacity' | 'noticeHours' | 'closedDates';

export const VISIT_SLOT_MINUTES = [30, 45, 60, 90, 120] as const;
export const VISIT_CAPACITY = { min: 1, max: 5 } as const;
export const VISIT_NOTICE_HOURS = { min: 0, max: 72 } as const;
export const VISIT_CLOSED_DATES_MAX = 60;
/** How far ahead the visit page offers times. */
export const VISIT_BOOKING_DAYS = 60;

/**
 * The hours the website already publishes ("Tuesdays to Saturdays, 10:00 AM to 6:00 PM; Sundays,
 * 2:00 PM to 6:00 PM; by appointment only"), one-hour visits, one visit at a time. To confirm
 * with Zion (plan section 27, item 11).
 */
export const DEFAULT_VISIT_RULES: VisitRules = {
  weekly: [
    { open: '14:00', close: '18:00' },
    null,
    { open: '10:00', close: '18:00' },
    { open: '10:00', close: '18:00' },
    { open: '10:00', close: '18:00' },
    { open: '10:00', close: '18:00' },
    { open: '10:00', close: '18:00' },
  ],
  slotMinutes: 60,
  capacity: 1,
  noticeHours: 12,
  closedDates: [],
};

const CLOCK = /^([01]\d|2[0-3]):([0-5]\d)$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const MANILA_OFFSET_MS = 8 * 60 * MINUTE_MS;

function minutesOf(clock: string) {
  const [hours, minutes] = clock.split(':').map(Number);
  return hours * 60 + minutes;
}

function isRealDate(value: string) {
  if (!ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** The first rule to fix and why, or null when the rules are usable. */
export function visitRulesProblem(
  rules: VisitRules,
): { field: VisitRuleField; problem: string } | null {
  if (rules.weekly.length !== 7)
    return { field: 'weekly.0', problem: 'Set the hours for every day of the week.' };
  for (const [day, hours] of rules.weekly.entries()) {
    if (!hours) continue;
    const field = `weekly.${day}` as const;
    if (!CLOCK.test(hours.open) || !CLOCK.test(hours.close))
      return { field, problem: `Enter ${WEEKDAYS[day]}'s hours as times, for example 10:00.` };
    if (minutesOf(hours.close) - minutesOf(hours.open) < rules.slotMinutes)
      return {
        field,
        problem: `${WEEKDAYS[day]} must stay open for at least one visit (${rules.slotMinutes} minutes).`,
      };
  }
  if (!(VISIT_SLOT_MINUTES as readonly number[]).includes(rules.slotMinutes))
    return { field: 'slotMinutes', problem: 'Choose how long each visit lasts.' };
  if (
    !Number.isInteger(rules.capacity) ||
    rules.capacity < VISIT_CAPACITY.min ||
    rules.capacity > VISIT_CAPACITY.max
  )
    return {
      field: 'capacity',
      problem: `Enter ${VISIT_CAPACITY.min} to ${VISIT_CAPACITY.max} visits at the same time.`,
    };
  if (
    !Number.isInteger(rules.noticeHours) ||
    rules.noticeHours < VISIT_NOTICE_HOURS.min ||
    rules.noticeHours > VISIT_NOTICE_HOURS.max
  )
    return {
      field: 'noticeHours',
      problem: `Enter ${VISIT_NOTICE_HOURS.min} to ${VISIT_NOTICE_HOURS.max} hours of notice.`,
    };
  if (rules.closedDates.length > VISIT_CLOSED_DATES_MAX)
    return {
      field: 'closedDates',
      problem: `List at most ${VISIT_CLOSED_DATES_MAX} closed dates.`,
    };
  const wrong = rules.closedDates.find((date) => !isRealDate(date));
  if (wrong)
    return {
      field: 'closedDates',
      problem: `"${wrong}" is not a date. Write closed dates as YYYY-MM-DD, separated by commas.`,
    };
  return null;
}

/** Splits the closed dates field ("2026-12-25, 2027-01-01") into sorted, unique dates. */
export function parseClosedDates(text: string) {
  return [
    ...new Set(
      text
        .split(/[\s,;]+/)
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ].sort();
}

/** Today's date in Manila, YYYY-MM-DD. */
export function manilaDateKey(now: Date) {
  return new Date(now.getTime() + MANILA_OFFSET_MS).toISOString().slice(0, 10);
}

/** A Manila date and minutes after midnight as an instant. */
function manilaInstant(dateKey: string, minutes: number) {
  return new Date(Date.parse(`${dateKey}T00:00:00Z`) + minutes * MINUTE_MS - MANILA_OFFSET_MS);
}

export type VisitSlot = { startsAt: string; endsAt: string; remaining: number };
export type VisitDay = { date: string; slots: VisitSlot[] };
export type TakenTime = { startsAt: Date; endsAt: Date };

/**
 * The visit times of the next `days` Manila days that still have room: inside the day's hours,
 * not on a closed date, at least `noticeHours` from now, with fewer visits than `capacity`, and
 * clear of every `blocked` time (an event at the venue). Days without open times are listed with
 * no slots, so a calendar can show them as unavailable.
 */
export function visitDays(
  rules: VisitRules,
  now: Date,
  days: number,
  taken: TakenTime[],
  blocked: TakenTime[] = [],
) {
  const earliest = now.getTime() + rules.noticeHours * 60 * MINUTE_MS;
  const today = Date.parse(`${manilaDateKey(now)}T00:00:00Z`);
  const result: VisitDay[] = [];
  for (let offset = 0; offset < days; offset += 1) {
    const date = new Date(today + offset * DAY_MS).toISOString().slice(0, 10);
    const hours = rules.weekly[new Date(today + offset * DAY_MS).getUTCDay()];
    const slots: VisitSlot[] = [];
    if (hours && !rules.closedDates.includes(date)) {
      const close = minutesOf(hours.close);
      for (
        let start = minutesOf(hours.open);
        start + rules.slotMinutes <= close;
        start += rules.slotMinutes
      ) {
        const startsAt = manilaInstant(date, start);
        const endsAt = manilaInstant(date, start + rules.slotMinutes);
        if (startsAt.getTime() < earliest) continue;
        if (blocked.some((busy) => busy.startsAt < endsAt && busy.endsAt > startsAt)) continue;
        const overlapping = taken.filter(
          (visit) => visit.startsAt < endsAt && visit.endsAt > startsAt,
        ).length;
        const remaining = rules.capacity - overlapping;
        if (remaining > 0)
          slots.push({ startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), remaining });
      }
    }
    result.push({ date, slots });
  }
  return result;
}

/** The open slot that starts at `startsAt`, or null when that time cannot be booked now. */
export function findVisitSlot(
  rules: VisitRules,
  now: Date,
  startsAt: Date,
  taken: TakenTime[],
  blocked: TakenTime[] = [],
) {
  const dateKey = manilaDateKey(startsAt);
  const offset = Math.round(
    (Date.parse(`${dateKey}T00:00:00Z`) - Date.parse(`${manilaDateKey(now)}T00:00:00Z`)) / DAY_MS,
  );
  if (offset < 0 || offset >= VISIT_BOOKING_DAYS) return null;
  const day = visitDays(rules, now, offset + 1, taken, blocked)[offset];
  return day?.slots.find((slot) => slot.startsAt === startsAt.toISOString()) ?? null;
}
