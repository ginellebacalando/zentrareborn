import type { ZeniLanguage } from './language';

export type ChatSource = {
  id: string;
  title: string;
  /**
   * What the source is about when its title also carries context, such as a booklet section
   * ("Catering (food and beverages)") under its package and event. Search compares it with the
   * question; it defaults to the title.
   */
  subject?: string;
  /** The one package a source describes ("Zion Classic"); a question naming another skips it. */
  packageName?: string;
  text: string;
  href: string;
  keywords: string[];
  kind: 'faq' | 'package' | 'policy' | 'venue' | 'contact';
  /** The help topic of an official FAQ answer, used for related follow-up chips. */
  topic?: ZeniTopicId;
  revision?: string;
  /** Present only for a package version currently published to visitors. */
  offering?: {
    serviceId: string;
    category: string;
    packageName: string;
    price: number;
    currency: string;
    guests: number;
  };
};

/** Conversation commands a reply button may send back. Navigation uses links instead. */
export const receptionistActionTypes = [
  'check_availability',
  'request_human',
  'confirm_escalation',
  'decline',
  'resume',
] as const;
export type ReceptionistActionType = (typeof receptionistActionTypes)[number];

export type ReceptionistAction = {
  type: ReceptionistActionType;
  label: string;
  value?: string;
};

/** A server-built link. Zeni never takes the booking itself; it opens pre-filled pages. */
export type ZeniLink = {
  kind: 'book' | 'visit' | 'page';
  label: string;
  href: string;
  primary?: boolean;
};

export type ZeniDetailCard = {
  type: 'detail';
  id: string;
  kind: 'facility' | 'package' | 'event';
  title: string;
  description: string;
  href: string;
  linkLabel: string;
  image?: { src: string; alt: string };
  /** Formatted "starts at" price, only from a published package version. */
  startsAt?: string;
};

/**
 * Dates only: a held or confirmed admin-calendar event marks the whole date unavailable. The card
 * covers the booking window (docs/booking-window.md): from today to the last bookable date, with
 * the days before `earliest` inside the minimum notice period. It carries the unavailable dates of
 * the month it opens on; the browser loads other months from /api/client/chatbot/calendar.
 */
export type ZeniCalendarCard = {
  type: 'calendar';
  today: string;
  /** Today, the first day shown. */
  from: string;
  /** The last bookable date. */
  to: string;
  /** The first bookable date; older saved cards have none (no notice period shown). */
  earliest?: string;
  minNoticeDays?: number;
  maxMonthsAhead?: number;
  /** The month the card opens on (YYYY-MM); `unavailable` holds that month's dates. */
  month?: string;
  unavailable: string[];
  selected?: string;
  observedAt: string;
};

/** One month of the calendar card, loaded when the guest opens it. */
export type ZeniCalendarMonth = { month: string; unavailable: string[]; observedAt: string };

export type ZeniCard = ZeniDetailCard | ZeniCalendarCard;

export type ConversationSummary = {
  stage: string;
  revision: number;
  status: string;
  previousStatus?: string;
  statusObservedAt?: string;
  statusExpiresAt?: string;
  language: ZeniLanguage;
  name?: string;
  contact?: string;
  eventType?: string;
  date?: string;
  venue?: string;
  timePreference?: string;
  guests?: number;
  awaiting?: string;
  expiresAt: string;
};

export type ChatReply = {
  kind:
    | 'answer'
    | 'handoff'
    | 'greeting'
    | 'discovery'
    | 'objection'
    | 'scope'
    | 'booking'
    | 'availability'
    | 'escalation';
  message: string;
  sources: Array<{ title: string; excerpt: string; href: string }>;
  suggestions: string[];
  actions?: ReceptionistAction[];
  links?: ZeniLink[];
  cards?: ZeniCard[];
  language?: ZeniLanguage;
  context?: ConversationSummary;
  /** Present when this reply handed the visitor to the staff live chat queue. */
  live?: { status: 'WAITING' };
};

/** The six help topics of Zion's official chatbot knowledge base (config/zeni-topics.ts). */
export type ZeniTopicId = 'payments' | 'food' | 'venue' | 'planning' | 'suppliers' | 'changes';

export type PublicFaq = {
  id: string;
  question: string;
  /** The official wording, shown on the /faq page. */
  answer: string;
  tags?: string[];
  /** The same facts in the casual wording Zion approved for the chatbot; Zeni prefers it. */
  chatAnswer?: string;
  topic?: ZeniTopicId;
};
