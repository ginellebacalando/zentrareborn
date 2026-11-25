/**
 * Minimal RFC 5545 / RFC 5546 (iTIP) calendar writer for booking invitations.
 * Output uses CRLF line endings, folds content lines at 75 octets without splitting UTF-8
 * sequences, escapes TEXT values, and writes every time in UTC so no VTIMEZONE is needed.
 */
import { EMAIL_ADDRESS_PATTERN } from '@/lib/email-address';

export type CalendarMethod = 'REQUEST' | 'CANCEL';

export type CalendarPerson = { name: string; email: string };

export type CalendarInvite = {
  method: CalendarMethod;
  /** Stable for the life of a booking so updates and cancellations replace the same event. */
  uid: string;
  /** Must increase whenever the event is re-sent with changes or cancelled. */
  sequence: number;
  stamp: Date;
  start: Date;
  end: Date;
  summary: string;
  description: string;
  location: string;
  organizer: CalendarPerson;
  attendees: CalendarPerson[];
  /**
   * For REQUEST only. TENTATIVE marks a booking request whose date is not reserved yet, so the
   * event does not show the time as busy; CONFIRMED (the default) is a reserved event.
   */
  status?: 'CONFIRMED' | 'TENTATIVE';
};

const PRODUCT_ID = '-//Zion Events Place//ZENTRA Automation//EN';
const MAX_LINE_OCTETS = 75;

export function formatCalendarDate(value: Date) {
  if (Number.isNaN(value.getTime())) throw new Error('Calendar dates must be valid.');
  return value
    .toISOString()
    .replace(/\.\d{3}Z$/, 'Z')
    .replaceAll('-', '')
    .replaceAll(':', '');
}

/** Escapes a TEXT property value (RFC 5545 section 3.3.11). */
export function escapeCalendarText(value: string) {
  return value
    .replaceAll('\\', '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replaceAll(';', '\\;')
    .replaceAll(',', '\\,');
}

/** Parameter values are quoted; DQUOTE and control characters are not representable. */
function quotedParameter(value: string) {
  const safe = value.replace(/["\p{Cc}]/gu, '').trim();
  return `"${safe || 'Guest'}"`;
}

function mailto(email: string) {
  const address = email.trim().toLowerCase();
  if (!EMAIL_ADDRESS_PATTERN.test(address))
    throw new Error('Calendar participants need a valid email.');
  return `mailto:${address}`;
}

/** Folds one content line into chunks of at most 75 octets, continuation lines included. */
export function foldCalendarLine(line: string) {
  const chunks: string[] = [];
  let chunk = '';
  let octets = 0;
  let limit = MAX_LINE_OCTETS;
  for (const character of line) {
    const size = Buffer.byteLength(character, 'utf8');
    if (octets + size > limit) {
      chunks.push(chunk);
      chunk = '';
      octets = 0;
      // Each continuation line starts with one space, which counts toward its 75 octets.
      limit = MAX_LINE_OCTETS - 1;
    }
    chunk += character;
    octets += size;
  }
  chunks.push(chunk);
  return chunks.join('\r\n ');
}

export function buildCalendarInvite(invite: CalendarInvite) {
  if (!invite.uid.trim() || /[\r\n]/.test(invite.uid)) throw new Error('Calendar UID is required.');
  if (!Number.isInteger(invite.sequence) || invite.sequence < 0)
    throw new Error('Calendar SEQUENCE must be a non-negative integer.');
  if (invite.end <= invite.start) throw new Error('Calendar events must end after they start.');
  if (!invite.attendees.length) throw new Error('Calendar invitations need an attendee.');
  const cancelled = invite.method === 'CANCEL';
  const tentative = !cancelled && invite.status === 'TENTATIVE';
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODUCT_ID}`,
    'CALSCALE:GREGORIAN',
    `METHOD:${invite.method}`,
    'BEGIN:VEVENT',
    `UID:${invite.uid.trim()}`,
    `SEQUENCE:${invite.sequence}`,
    `DTSTAMP:${formatCalendarDate(invite.stamp)}`,
    `DTSTART:${formatCalendarDate(invite.start)}`,
    `DTEND:${formatCalendarDate(invite.end)}`,
    `SUMMARY:${escapeCalendarText(invite.summary)}`,
    `LOCATION:${escapeCalendarText(invite.location)}`,
    `DESCRIPTION:${escapeCalendarText(invite.description)}`,
    `ORGANIZER;CN=${quotedParameter(invite.organizer.name)}:${mailto(invite.organizer.email)}`,
    ...invite.attendees.map(
      (attendee) =>
        `ATTENDEE;CN=${quotedParameter(attendee.name)};ROLE=REQ-PARTICIPANT;RSVP=FALSE:${mailto(attendee.email)}`,
    ),
    `STATUS:${cancelled ? 'CANCELLED' : tentative ? 'TENTATIVE' : 'CONFIRMED'}`,
    ...(cancelled ? [] : [`TRANSP:${tentative ? 'TRANSPARENT' : 'OPAQUE'}`]),
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return `${lines.map(foldCalendarLine).join('\r\n')}\r\n`;
}
