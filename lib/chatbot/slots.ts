import { assertDateKey, venueDateKey } from '@/lib/calendar-time';
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

export function redactSensitiveText(text: string) {
  return text
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[email]')
    .replace(/\b(?:\d[ -]?){9,19}\b/g, '[number]')
    .slice(0, 600);
}

function explicitDate(text: string, now: Date): { date?: string; invalidDate?: boolean } {
  let date = text.match(/\b(\d{4}-\d{2}-\d{2})\b/)?.[1];
  if (!date) {
    const match = text.match(
      /\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+(\d{1,2})(?:st|nd|rd|th)?[,]?\s+(\d{4})\b/i,
    );
    if (match) {
      const month =
        [
          'jan',
          'feb',
          'mar',
          'apr',
          'may',
          'jun',
          'jul',
          'aug',
          'sep',
          'oct',
          'nov',
          'dec',
        ].indexOf(match[1].slice(0, 3).toLowerCase()) + 1;
      date = `${match[3]}-${String(month).padStart(2, '0')}-${match[2].padStart(2, '0')}`;
    }
  }
  if (!date) return {};
  try {
    assertDateKey(date);
    return date >= venueDateKey(now) ? { date } : { invalidDate: true };
  } catch {
    return { invalidDate: true };
  }
}

/** Extract only explicit facts. Ambiguous dates and inferred contact details are not filled. */
export function captureSlots(
  state: ReceptionistConversation,
  text: string,
  sources: ChatSource[],
  now = new Date(),
): SlotChanges {
  const changes: SlotChanges = explicitDate(text, now);
  const name =
    text.match(
      /(?:\bmy (?:full )?name is|^name:)\s*([\p{L}][\p{L}'’.-]*(?:\s+[\p{L}][\p{L}'’.-]*){0,4})/iu,
    )?.[1] ??
    text.match(
      /^(?:I am|I'm|I’m)\s+([\p{Lu}][\p{L}'’.-]*(?:\s+[\p{Lu}][\p{L}'’.-]*){0,3})(?=[,.!]|$)/u,
    )?.[1] ??
    (state.awaiting === 'name' && /^[\p{L}][\p{L}'’ .-]{1,99}$/u.test(text.trim())
      ? text.trim()
      : undefined);
  if (
    name &&
    !/\b(interested|looking|planning|ready|sorry|fine|okay|want|would|need|book|hello|hi|yes|no)\b/i.test(
      name,
    )
  )
    state.client.name = name
      .split(/\s+(?:and|my|email|phone|for|with|we|on)\b/i)[0]
      .trim()
      .slice(0, 100);
  const informationQuestion =
    /\?|^(?:what|where|when|how|why|is|are|do|does|can|could|would|should)\b/i.test(text.trim());
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
    /\b(weddings?|kasal|birthdays?|debuts?|christenings?|gender reveal|christmas(?: party)?|corporate(?: event)?)\b/i,
  )?.[1];
  if (event)
    state.booking.eventType =
      event.toLowerCase() === 'kasal'
        ? 'wedding'
        : event.toLowerCase().replace(/^(wedding|birthday|debut|christening)s$/, '$1');
  const guests =
    text.match(/\b(\d{1,6})\s*(?:guests?|pax|people|persons?|attendees?)\b/i)?.[1] ??
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
    new RegExp(`\\b(${clock})\\s*(?:to|until|[-–—])\\s*(${clock})\\b`, 'i'),
  );
  if (window) {
    const normalize = (value: string) => {
      const match = value.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
      if (!match) return null;
      let hour = Number(match[1]);
      if (match[3]) {
        if (hour < 1 || hour > 12) return null;
        hour = (hour % 12) + (/^pm$/i.test(match[3]) ? 12 : 0);
      }
      return `${String(hour).padStart(2, '0')}:${match[2] ?? '00'}`;
    };
    const start = normalize(window[1]);
    const end = normalize(window[2]);
    if (!start || !end || start >= end) changes.invalidTime = true;
    else changes.timeWindow = `${start}/${end}`;
  }
  const time = text.match(
    /\b(?:[01]?\d|2[0-3]):[0-5]\d(?:\s*(?:AM|PM))?\b|\b(?:1[0-2]|[1-9])\s*(?:AM|PM)\b|\b(?:morning|afternoon|evening)\b/i,
  )?.[0];
  if (time && !window) {
    if (
      state.booking.startTime &&
      time !== state.booking.startTime &&
      time !== state.booking.endTime
    )
      changes.invalidTime = true;
    else state.booking.timePreference = time;
  }
  if (
    state.awaiting === 'timePreference' &&
    /^(any time|flexible|no preference)$/i.test(text.trim())
  )
    state.booking.timePreference = 'Flexible';
  const budget = text.match(
    /\b(?:budget(?: is| of|:)?|under|up to)\s*(?:PHP|₱)?\s*([\d,]+)(k)?\b/i,
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
  const reference =
    text.match(
      /\b(?:reference(?: is|:)?|booking ref(?:erence)?(?: is|:)?)\s*([A-Za-z0-9][A-Za-z0-9-]{3,79})\b/i,
    )?.[1] ??
    (state.awaiting === 'reference' && /^[A-Za-z0-9][A-Za-z0-9-]{3,79}$/.test(text.trim())
      ? text.trim()
      : undefined);
  if (reference) state.booking.reference = reference;
  return changes;
}
