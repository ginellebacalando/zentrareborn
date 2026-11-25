/**
 * Website activity: the newest things visitors did on the public site, merged into one list for the
 * admin dashboard. These pure helpers are shared by the server loader (./website-activity.ts) and
 * the client panel (components/admin/WebsiteActivity.tsx), so they must not import server code.
 *
 * Privacy contract: an item carries only what existing admin screens already show (a name, an
 * event type or topic, a status and a time), shortened to one line. Contact details, full messages,
 * testimony comments and booking notes are never selected or returned.
 */
import { displayStatus, displayStatusLabels, type DisplayStatus } from './dashboard-status';

/** Items shown in the panel; each source also reads at most this many rows. */
export const WEBSITE_ACTIVITY_LIMIT = 12;
/** The panel checks for new activity this often while the browser tab is visible. */
export const WEBSITE_ACTIVITY_POLL_MS = 60_000;
/** Held testimonies are moderated in the dashboard's "Testimonies hold" card, which has this id. */
export const TESTIMONY_HOLD_ANCHOR = 'testimonies-hold';
/** Heading id of the "Unanswered questions" section on the Zeni page (components/admin/ZeniPanel). */
const ZENI_QUESTIONS_HREF = '/admin/zeni#zeni-gaps-title';
/** `Inquiry.sourcePage` written by Zeni's hand-off (ZENI_INQUIRY_SOURCE in services/chatbot). */
const ZENI_HANDOFF_SOURCE = 'zeni_receptionist';

const NAME_MAX = 60;
const TOPIC_MAX = 48;
const QUESTION_MAX = 90;
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export type WebsiteActivityKind = 'booking' | 'inquiry' | 'handoff' | 'testimony' | 'question';

/** A booking display status (shown with the shared status chip) or a plain labelled tag. */
export type WebsiteActivityStatus =
  { tone: DisplayStatus; label: string } | { tone: 'neutral' | 'attention'; label: string };

export type WebsiteActivityItem = {
  /** Unique across kinds and stable for the same record. */
  id: string;
  kind: WebsiteActivityKind;
  /** What happened, for example "Booking request". */
  title: string;
  /** One short line: who, what and when. */
  summary: string;
  status: WebsiteActivityStatus | null;
  /** When the visitor acted (ISO 8601, UTC). */
  occurredAt: string;
  /** The admin screen that handles the item. */
  href: string;
};

export type WebsiteActivityFeed = {
  generatedAt: string;
  /** Newest first, at most WEBSITE_ACTIVITY_LIMIT items. */
  items: WebsiteActivityItem[];
  /** False when Zeni's question log (prisma/receptionist.sql) is not installed on the database. */
  zeniQuestionsAvailable: boolean;
};

type Timestamp = Date | string;

const iso = (value: Timestamp) => new Date(value).toISOString();

/** Venue schedules are kept in Manila time, as on the booking and calendar screens. */
const eventDay = new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

/** User-perceived characters, so an emoji or accented letter is never cut in half. */
function characters(text: string) {
  return typeof Intl.Segmenter === 'function'
    ? Array.from(
        new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(text),
        (part) => part.segment,
      )
    : Array.from(text);
}

/**
 * Collapses whitespace and shortens text to `max` characters, preferring a word boundary and
 * ending with an ellipsis.
 */
export function shortText(value: string | null | undefined, max: number) {
  const text = (value ?? '').replace(/\s+/g, ' ').trim();
  const characterList = characters(text);
  if (characterList.length <= max) return text;
  const cut = characterList.slice(0, Math.max(1, max - 1)).join('');
  const space = cut.lastIndexOf(' ');
  const word = space >= cut.length * 0.6 ? cut.slice(0, space) : cut;
  return `${word.replace(/[\s,;:.\-–—]+$/u, '')}…`;
}

const joinParts = (parts: string[]) => parts.filter(Boolean).join(' · ');

export function bookingActivity(booking: {
  id: string;
  clientName: string;
  eventType: string;
  startsAt: Timestamp;
  approval: string;
  reservation: string;
  createdAt: Timestamp;
}): WebsiteActivityItem {
  const status = displayStatus(booking);
  return {
    id: `booking:${booking.id}`,
    kind: 'booking',
    title: 'Booking request',
    summary: joinParts([
      shortText(booking.clientName, NAME_MAX),
      shortText(booking.eventType, TOPIC_MAX),
      eventDay.format(new Date(booking.startsAt)),
    ]),
    status: { tone: status, label: displayStatusLabels[status] },
    occurredAt: iso(booking.createdAt),
    // The board opens on the request's current status, as the dashboard status cards do.
    href: `/admin/bookings?status=${status}`,
  };
}

const inquiryStatusLabels: Record<string, string> = {
  NEW: 'New',
  PENDING_RESPONSE: 'Awaiting response',
  ANSWERED: 'Answered',
  FOLLOW_UP: 'Follow-up',
  CLOSED: 'Closed',
  SPAM: 'Spam',
};

export function inquiryActivity(inquiry: {
  id: string;
  fullName: string;
  eventInterest: string | null;
  sourcePage: string;
  status: string;
  submittedAt: Timestamp;
}): WebsiteActivityItem {
  const handoff = inquiry.sourcePage === ZENI_HANDOFF_SOURCE;
  return {
    id: `inquiry:${inquiry.id}`,
    kind: handoff ? 'handoff' : 'inquiry',
    title: handoff ? 'Zeni hand-off' : 'Inquiry',
    summary: joinParts([
      shortText(inquiry.fullName, NAME_MAX),
      shortText(inquiry.eventInterest, TOPIC_MAX) ||
        (handoff ? 'Asked for staff help' : 'General inquiry'),
    ]),
    status: {
      tone: 'neutral',
      label: inquiryStatusLabels[inquiry.status] ?? shortText(inquiry.status, TOPIC_MAX),
    },
    occurredAt: iso(inquiry.submittedAt),
    href: '/admin/inquiries',
  };
}

export function testimonyActivity(testimony: {
  id: string;
  clientName: string;
  nickname: string | null;
  eventType: string;
  status: string;
  submittedAt: Timestamp;
}): WebsiteActivityItem {
  return {
    id: `testimony:${testimony.id}`,
    kind: 'testimony',
    title: 'Testimony',
    summary: joinParts([
      // The public name the visitor chose, as in the Testimonies hold card.
      shortText(testimony.nickname || testimony.clientName, NAME_MAX),
      shortText(testimony.eventType, TOPIC_MAX),
    ]),
    status:
      testimony.status === 'FLAGGED'
        ? { tone: 'attention', label: 'On hold' }
        : { tone: 'neutral', label: 'Awaiting review' },
    occurredAt: iso(testimony.submittedAt),
    // Same-page anchor: this feed and the moderation card are both on the dashboard.
    href: `#${TESTIMONY_HOLD_ANCHOR}`,
  };
}

/**
 * One item per question wording: a question asked again replaces its older occurrence, so a
 * repeated question cannot fill the list. Questions are redacted before Zeni stores them.
 */
export function zeniQuestionActivities(
  questions: { id: string; question: string; questionHash: string; createdAt: Timestamp }[],
): WebsiteActivityItem[] {
  const seen = new Set<string>();
  const items: WebsiteActivityItem[] = [];
  const newestFirst = [...questions].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  for (const question of newestFirst) {
    if (seen.has(question.questionHash)) continue;
    seen.add(question.questionHash);
    items.push({
      id: `question:${question.id}`,
      kind: 'question',
      title: 'Zeni could not answer',
      summary: `“${shortText(question.question, QUESTION_MAX)}”`,
      status: null,
      occurredAt: iso(question.createdAt),
      href: ZENI_QUESTIONS_HREF,
    });
  }
  return items;
}

const kindOrder: Record<WebsiteActivityKind, number> = {
  booking: 0,
  inquiry: 1,
  handoff: 2,
  testimony: 3,
  question: 4,
};

/** Newest first across all sources; equal times keep a fixed order so the list never reshuffles. */
export function mergeWebsiteActivity(
  items: WebsiteActivityItem[],
  limit = WEBSITE_ACTIVITY_LIMIT,
): WebsiteActivityItem[] {
  return [...items]
    .sort(
      (a, b) =>
        Date.parse(b.occurredAt) - Date.parse(a.occurredAt) ||
        kindOrder[a.kind] - kindOrder[b.kind] ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    )
    .slice(0, limit);
}

function yearIn(time: number, timeZone: string) {
  return new Intl.DateTimeFormat('en-PH', { timeZone, year: 'numeric' }).format(time);
}

/**
 * Short relative age such as "just now", "5 min ago", "3 hr ago" or "2 days ago". From a week on
 * it shows the date in `timeZone` instead. A time slightly ahead of `now` (clock drift) is "just now".
 */
export function activityAge(occurredAt: string, now: number, timeZone: string) {
  const time = Date.parse(occurredAt);
  const elapsed = Math.max(0, now - time);
  if (elapsed < MINUTE) return 'just now';
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)} min ago`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)} hr ago`;
  if (elapsed < 7 * DAY) {
    const days = Math.floor(elapsed / DAY);
    return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  }
  return new Intl.DateTimeFormat('en-PH', {
    timeZone,
    month: 'short',
    day: 'numeric',
    ...(yearIn(time, timeZone) === yearIn(now, timeZone) ? {} : { year: 'numeric' }),
  }).format(time);
}

/** Items newer than `since`, the newest time shown before ('' when the list was empty). */
export function activityNewerThan(items: WebsiteActivityItem[], since: string) {
  const after = since ? Date.parse(since) : Number.NEGATIVE_INFINITY;
  return items.filter((item) => Date.parse(item.occurredAt) > after);
}

/** One polite announcement for newly shown items (newest first); empty when there is nothing new. */
export function newActivityMessage(fresh: WebsiteActivityItem[]) {
  const latest = fresh[0];
  if (!latest) return '';
  const what = `${latest.title}: ${latest.summary}`;
  return fresh.length === 1
    ? `New website activity. ${what}.`
    : `${fresh.length} new website activities. Latest: ${what}.`;
}
