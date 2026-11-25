/**
 * Browser-safe vocabulary for ocular visits (docs/visits.md), shared by the public visit pages,
 * the admin Front desk and the server.
 */
import type { VisitDay } from './visit-rules';

export const VISIT_STATUSES = [
  'SCHEDULED',
  'CHECKED_IN',
  'COMPLETED',
  'NO_SHOW',
  'CANCELLED',
] as const;
export type VisitStatus = (typeof VISIT_STATUSES)[number];

export const VISIT_STATUS_LABELS: Record<VisitStatus, string> = {
  SCHEDULED: 'Scheduled',
  CHECKED_IN: 'Checked in',
  COMPLETED: 'Completed',
  NO_SHOW: 'No-show',
  CANCELLED: 'Cancelled',
};

export const VISIT_SOURCES = ['WEBSITE', 'ZENI', 'STAFF'] as const;
export type VisitSource = (typeof VISIT_SOURCES)[number];

export const VISIT_SOURCE_LABELS: Record<VisitSource, string> = {
  WEBSITE: 'Website',
  ZENI: 'Website, from Zeni',
  STAFF: 'Front desk',
};

export function visitStatusLabel(status: string) {
  return VISIT_STATUS_LABELS[status as VisitStatus] ?? status;
}

export function visitSourceLabel(source: string) {
  return VISIT_SOURCE_LABELS[source as VisitSource] ?? source;
}

/** Field limits shared by the forms and the server. */
export const VISIT_FIELD_LIMITS = {
  name: 180,
  email: 255,
  phone: 30,
  eventType: 100,
  message: 1000,
  staffNotes: 2000,
  cancelReason: 500,
  guests: { min: 1, max: 10000 },
} as const;

/** What the public visit page shows after a visit is saved. */
export type ScheduledVisit = {
  reference: string;
  startsAt: string;
  endsAt: string;
  /** Whether a confirmation email is on its way. */
  emailed: boolean;
  /** The private page to reschedule or cancel, or null when links cannot be signed. */
  managePath: string | null;
};

/** The visitor's private manage page. */
export type VisitManageView =
  | { state: 'invalid' }
  | {
      state: 'closed';
      reference: string;
      status: VisitStatus;
      startsAt: string;
      endsAt: string;
    }
  | {
      state: 'open';
      reference: string;
      firstName: string;
      startsAt: string;
      endsAt: string;
      revision: number;
      slotMinutes: number;
      days: VisitDay[];
    };

/** One visit as the Front desk shows it. */
export type FrontDeskVisit = {
  id: string;
  reference: string;
  clientName: string;
  email: string;
  phone: string;
  startsAt: string;
  endsAt: string;
  status: VisitStatus;
  source: VisitSource;
  eventType: string;
  eventDate: string | null;
  guests: number | null;
  message: string;
  staffNotes: string;
  revision: number;
  checkedInAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string;
  createdAt: string;
};

/** An event at the venue on the agenda; only what the front desk needs. */
export type FrontDeskEvent = {
  id: string;
  reference: string;
  clientName: string;
  eventType: string;
  packageName: string;
  guests: number;
  startsAt: string;
  endsAt: string;
  /** Confirmed, or held while the client pays. */
  state: 'CONFIRMED' | 'HELD';
};

export type FrontDeskAgenda = {
  /** Today's Manila date, YYYY-MM-DD. */
  today: string;
  visitsToday: FrontDeskVisit[];
  eventsToday: FrontDeskEvent[];
  /** Scheduled visits after today, soonest first. */
  upcoming: FrontDeskVisit[];
  /** Earlier visits still waiting for check-in, completion or a no-show. */
  needsOutcome: FrontDeskVisit[];
  slotMinutes: number;
};

/** A past or upcoming booking in a client's history. */
export type ClientHistoryBooking = {
  id: string;
  reference: string;
  clientName: string;
  email: string;
  phone: string;
  eventType: string;
  packageName: string;
  startsAt: string;
  approval: string;
  reservation: string;
};

export type ClientLookup = {
  query: string;
  clientBookings: ClientHistoryBooking[];
  clientVisits: FrontDeskVisit[];
};

/** An ocular visit on the admin Calendar: when, who and how it went. */
export type CalendarVisit = {
  id: string;
  reference: string;
  clientName: string;
  startsAt: string;
  endsAt: string;
  status: VisitStatus;
};

/** The open visit times staff can offer, without the notice the website requires. */
export type FrontDeskSlots = { days: VisitDay[]; slotMinutes: number };
