export type ChatSource = {
  id: string;
  title: string;
  text: string;
  href: string;
  keywords: string[];
  kind: 'faq' | 'package' | 'policy' | 'venue' | 'contact';
  revision?: string;
  offering?: {
    serviceId: string;
    category: string;
    packageName: string;
    price: number;
    currency: string;
    guests: number;
  };
};

export type ReceptionistAction = {
  type:
    | 'start_booking'
    | 'check_availability'
    | 'select_package'
    | 'accept_terms'
    | 'confirm_handoff'
    | 'decline'
    | 'request_human'
    | 'confirm_escalation'
    | 'confirm_change'
    | 'resume';
  label: string;
  value?: string;
};

export type ConversationSummary = {
  stage: string;
  revision: number;
  status: string;
  previousStatus?: string;
  statusObservedAt?: string;
  statusExpiresAt?: string;
  name?: string;
  contact?: string;
  eventType?: string;
  packageName?: string;
  bookingReference?: string;
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
    | 'escalation';
  message: string;
  sources: Array<{ title: string; excerpt: string; href: string }>;
  suggestions: string[];
  actions?: ReceptionistAction[];
  context?: ConversationSummary;
};

export type PublicFaq = { id: string; question: string; answer: string; tags?: string[] };
