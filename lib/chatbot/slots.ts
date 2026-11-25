import { assertDateKey, nextDateKey, venueDateKey } from '@/lib/calendar-time';
import type { ReceptionistConversation } from './conversation';
import type { ChatSource } from './types';

export type SlotChanges = {
  date?: string;
  venue?: string;
  guests?: number;
  packageId?: string;
  invalidDate?: boolean;
  timeWindow?: string;
  invalidTime?: boolean;
};

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  enero: 1,
  feb: 2,
  february: 2,
  pebrero: 2,
  mar: 3,
  march: 3,
  marso: 3,
  apr: 4,
  april: 4,
  abril: 4,
  may: 5,
  mayo: 5,
  jun: 6,
  june: 6,
  hunyo: 6,
  jul: 7,
  july: 7,
  hulyo: 7,
  aug: 8,
  august: 8,
  agosto: 8,
  sep: 9,
  sept: 9,
  september: 9,
  setyembre: 9,
  oct: 10,
  october: 10,
  oktubre: 10,
  nov: 11,
  november: 11,
  nobyembre: 11,
  dec: 12,
  december: 12,
  disyembre: 12,
};
const MONTH_PATTERN = Object.keys(MONTHS)
  .sort((a, b) => b.length - a.length)
  .join('|');
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function validKey(key: string) {
  try {
    assertDateKey(key);
    return true;
  } catch {
    return false;
  }
}

function addDays(key: string, days: number) {
  let result = key;
  for (let index = 0; index < days; index += 1) result = nextDateKey(result);
  return result;
}

/** A month and day without a year means the next occurrence on or after today (Manila). */
function nextOccurrence(month: number, day: number, today: string) {
  const year = Number(today.slice(0, 4));
  for (const candidate of [year, year + 1]) {
    const key = dateKey(candidate, month, day);
    if (validKey(key) && key >= today) return key;
  }
  return null;
}

function explicitDate(text: string, now: Date): { date?: string; invalidDate?: boolean } {
  const today = venueDateKey(now);
  let date: string | null | undefined = text.match(/\b(\d{4}-\d{2}-\d{2})\b/)?.[1];
  if (!date) {
    const monthFirst = text.match(
      new RegExp(
        `\\b(${MONTH_PATTERN})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?(?!\\s*(?:pm|am|:|guests?|pax|tao|katao))\\b`,
        'i',
      ),
    );
    const dayFirst = text.match(
      new RegExp(
        `\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+|ng\\s+)?(${MONTH_PATTERN})\\.?(?:,?\\s+(\\d{4}))?\\b`,
        'i',
      ),
    );
    const parts = monthFirst
      ? {
          month: MONTHS[monthFirst[1].toLowerCase()],
          day: Number(monthFirst[2]),
          year: monthFirst[3],
        }
      : dayFirst
        ? { month: MONTHS[dayFirst[2].toLowerCase()], day: Number(dayFirst[1]), year: dayFirst[3] }
        : null;
    // "May" is also an English and Filipino word, so it needs a day right after it.
    if (parts && parts.day >= 1 && parts.day <= 31)
      date = parts.year
        ? dateKey(Number(parts.year), parts.month, parts.day)
        : (nextOccurrence(parts.month, parts.day, today) ?? undefined);
  }
  if (!date) {
    if (/\b(?:tomorrow|bukas)\b/i.test(text)) date = addDays(today, 1);
    else {
      const weekday = text.match(
        /\b(?:this|next|coming)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i,
      );
      if (weekday) {
        const target = WEEKDAYS.indexOf(weekday[1].toLowerCase());
        const current = new Date(`${today}T12:00:00Z`).getUTCDay();
        let offset = (target - current + 7) % 7;
        if (offset === 0) offset = 7;
        date = addDays(today, offset);
      }
    }
  }
  if (!date) return {};
  if (!validKey(date)) return { invalidDate: true };
  return date >= today ? { date } : { invalidDate: true };
}

function normalizeClock(value: string) {
  const match = value.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  if (match[3]) {
    if (hour < 1 || hour > 12) return null;
    hour = (hour % 12) + (/^pm$/i.test(match[3]) ? 12 : 0);
  }
  if (hour > 23) return null;
  return `${String(hour).padStart(2, '0')}:${match[2] ?? '00'}`;
}

/** Extract explicit facts only. Ambiguous dates and inferred contact details are not filled. */
export function captureSlots(
  state: ReceptionistConversation,
  text: string,
  sources: ChatSource[],
  now = new Date(),
): SlotChanges {
  const changes: SlotChanges = explicitDate(text, now);
  const name =
    text.match(
      /(?:\bmy (?:full )?name is|^name:|\bpangalan ko(?: po)?(?: ay)?)\s*([\p{L}][\p{L}'’.-]*(?:\s+[\p{L}][\p{L}'’.-]*){0,4})/iu,
    )?.[1] ??
    text.match(
      /^(?:I am|I'm|I’m|ako(?: po)? si)\s+([\p{Lu}][\p{L}'’.-]*(?:\s+[\p{Lu}][\p{L}'’.-]*){0,3})(?=[,.!]|$)/u,
    )?.[1] ??
    (state.awaiting === 'name' && /^[\p{L}][\p{L}'’ .-]{1,99}$/u.test(text.trim())
      ? text.trim()
      : undefined);
  if (
    name &&
    name.trim().split(/\s+/).length <= 5 &&
    !/\b(interested|looking|planning|ready|sorry|fine|okay|want|would|need|book|hello|hi|yes|no|po|sige|opo|what|where|when|how|why|who|which|can|could|is|are|do|does|you|your|the|saan|ano|paano|magkano|kailan|bakit|ilan|price|package|available|date|staff)\b/i.test(
      name,
    ) &&
    // Suggestion chips and quick replies ("Schedule a visit", "Wedding packages") are requests,
    // not names, even when Zeni has just asked for a name.
    !/\b(schedule|visits?|ocular|tour|check|reserve|reservation|booking|weddings?|debuts?|birthdays?|christenings?|party|reveal|packages|prices|rates?|quote|inquir(?:e|y)|contact|call|e-?mail|phone|help|thanks?|salamat|continue|start|new|talk|agent|human|person|menu|venue|facilit(?:y|ies)|dates)\b/i.test(
      name,
    )
  )
    state.client.name = name
      .split(/\s+(?:and|my|email|phone|for|with|we|on|at)\b/i)[0]
      .trim()
      .slice(0, 100);
  const informationQuestion =
    /\?|^(?:what|where|when|how|why|is|are|do|does|can|could|would|should|ano|saan|kailan|paano|magkano)\b/i.test(
      text.trim(),
    );
  const introduction =
    /\bmy (?:full )?name is\b/i.test(text) &&
    !/\b(?:your (?:email|phone|contact)|email you|call you|contact you)\b/i.test(text);
  const contactAnswer = state.awaiting === 'contact' && !informationQuestion;
  const emailStatement = text.match(
    /(?:\bmy (?:e-?mail(?: address)?|contact)(?: is|:)?|\b(?:email|contact|reach) me at|\breply to|^e-?mail(?: address)?:)\s*([^?!\n]{1,300})/i,
  )?.[1];
  const phoneStatement = text.match(
    /(?:\bmy (?:phone|mobile|contact)(?: number)?(?: is|:)?|\b(?:call|contact|reach) me (?:at|on)|^(?:phone|mobile)(?: number)?:)\s*([^?!\n]{1,300})/i,
  )?.[1];
  const emailText =
    emailStatement ??
    (introduction || contactAnswer || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text.trim()) ? text : '');
  const phoneText =
    phoneStatement ??
    (introduction || contactAnswer || /^(?:\+639|09)[\d -]+$/.test(text.trim()) ? text : '');
  const email = emailText.match(
    /\b[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9.-]*[A-Z0-9])?\.[A-Z]{2,}\b/i,
  )?.[0];
  if (email && email.length <= 254) state.client.email = email.toLowerCase();
  const phone = phoneText.match(/(?:\+63|\b09)\d[\d -]{7,15}\d\b/)?.[0].replace(/[ -]/g, '');
  if (phone && /^(?:\+639\d{9}|09\d{9})$/.test(phone)) state.client.phone = phone;
  const event = text.match(
    /\b(weddings?|kasal|birthdays?|kaarawan|debuts?|christenings?|binyag|baptism|gender reveal|christmas(?: party)?|corporate(?: event)?)\b/i,
  )?.[1];
  if (event) {
    const lower = event.toLowerCase();
    state.booking.eventType =
      lower === 'kasal'
        ? 'wedding'
        : lower === 'kaarawan'
          ? 'birthday'
          : lower === 'binyag' || lower === 'baptism'
            ? 'christening'
            : lower.replace(/^(wedding|birthday|debut|christening)s$/, '$1');
  }
  const guests =
    text.match(
      /\b(\d{1,6})\s*(?:guests?|pax|people|persons?|attendees?|tao|katao|bisita)\b/i,
    )?.[1] ??
    (state.awaiting === 'guests' && /^\d{1,6}$/.test(text.trim()) ? text.trim() : undefined);
  if (guests && Number(guests) > 0 && Number(guests) <= 10000) changes.guests = Number(guests);
  const venue = text.match(
    /\b(selah(?: (?:indoor )?hall)?|pavilion(?: garden)?|garden|pool(?: and grounds)?)\b/i,
  )?.[1];
  if (venue)
    changes.venue = /selah/i.test(venue)
      ? 'Selah Hall'
      : /pool/i.test(venue)
        ? 'Pool and grounds'
        : 'Pavilion Garden';
  const clock = '(?:(?:[01]?\\d|2[0-3]):[0-5]\\d(?:\\s*(?:AM|PM))?|(?:1[0-2]|[1-9])\\s*(?:AM|PM))';
  const window = text.match(
    new RegExp(`\\b(${clock})\\s*(?:to|until|hanggang|[-–—])\\s*(${clock})`, 'i'),
  );
  if (window) {
    const start = normalizeClock(window[1]);
    const end = normalizeClock(window[2]);
    if (!start || !end || start >= end) changes.invalidTime = true;
    else changes.timeWindow = `${start}/${end}`;
  }
  const time = text.match(
    /\b(?:[01]?\d|2[0-3]):[0-5]\d(?:\s*(?:AM|PM))?\b|\b(?:1[0-2]|[1-9])\s*(?:AM|PM)\b|\b(?:morning|afternoon|evening)\b/i,
  )?.[0];
  if (time && !window && !changes.timeWindow) state.booking.timePreference = time;
  const budget = text.match(
    /\b(?:budget(?: is| of|:)?|under|up to|hanggang)\s*(?:PHP|₱)?\s*([\d,]+)(k)?\b/i,
  );
  if (budget)
    state.needs.budget = Math.min(
      Number(budget[1].replaceAll(',', '')) * (budget[2] ? 1000 : 1),
      100000000,
    );
  const requested = sources.filter(
    (source) =>
      source.offering && text.toLowerCase().includes(source.offering.packageName.toLowerCase()),
  );
  const selected = requested.filter(
    (source) =>
      !state.booking.eventType ||
      source.offering?.category.toLowerCase().includes(state.booking.eventType),
  );
  if (selected.length === 1) changes.packageId = selected[0].id;
  const reference = text.match(
    /\b(?:reference(?: is|:)?|booking ref(?:erence)?(?: is|:)?)\s*([A-Za-z0-9][A-Za-z0-9-]{3,79})\b/i,
  )?.[1];
  if (reference && /\d/.test(reference)) state.booking.reference = reference;
  return changes;
}
