import type { ZeniLanguage } from './language';

export type ChatSource = {
  id: string;
  title: string;
  text: string;
  href: string;
  keywords: string[];
  kind: 'faq' | 'package' | 'policy' | 'venue' | 'contact';
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

/** Dates only: a confirmed admin-calendar event marks the whole date unavailable. */
export type ZeniCalendarCard = {
  type: 'calendar';
  today: string;
  from: string;
  to: string;
  unavailable: string[];
  selected?: string;
  observedAt: string;
};

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

export type PublicFaq = { id: string; question: string; answer: string; tags?: string[] };
