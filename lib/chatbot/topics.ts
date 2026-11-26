import { asksAboutDates } from './intent';

/** Coarse topic labels for staff reporting. They never decide what Zeni is allowed to say. */
export const zeniTopics = [
  'availability',
  'booking',
  'packages',
  'payments',
  'policies',
  'facilities',
  'visits',
  'location',
  'food',
  'planning',
  'suppliers',
  'contact',
  'other',
] as const;
export type ZeniTopic = (typeof zeniTopics)[number];

/** How the admin page names each topic. */
export const zeniTopicLabels: Record<ZeniTopic, string> = {
  availability: 'Dates and availability',
  booking: 'Booking',
  packages: 'Packages and prices',
  payments: 'Payments',
  policies: 'Policies and house rules',
  facilities: 'Venue and facilities',
  visits: 'Visits',
  location: 'Location and directions',
  food: 'Food and drinks',
  planning: 'Planning and styling',
  suppliers: 'Suppliers',
  contact: 'Contact',
  other: 'Other',
};

/**
 * The subject a question is about. Specific subjects come first, so "What food is available?" is
 * about food and "Can we book a photographer?" is about suppliers; dates and booking are the
 * subject only when nothing more specific is named.
 */
const TOPIC_PATTERNS: ReadonlyArray<[ZeniTopic, RegExp]> = [
  [
    'food',
    /\b(?:food|foods|catering|caterer|menu|buffet|dish(?:es)?|cake|lechon|drinks?|beverages?|alcohol|wine|beer|liquor|corkage|tasting|meals?|snacks?|dessert|pagkain|ulam|handa|inumin|alak)\b/i,
  ],
  [
    'payments',
    /\b(?:payments?|pay|paying|deposit|downpayment|down payment|balance|refund\w*|installments?|receipt|soa|gcash|bank|cash|card|bayad|magbayad|hulog|hulugan)\b/i,
  ],
  [
    'packages',
    /\b(?:packages?|price|pricing|rates?|cost|how much|magkano|presyo|inclusions?|included|include|all-?in|add-?ons?|upgrades?|freebies?|promo|discount|budget|quotation|quote)\b/i,
  ],
  [
    'suppliers',
    /\b(?:suppliers?|photographer|videographer|photo|video|hmua|make-?up|host|emcee|dj|band|photobooth|food carts?|coffee cart|mobile bar)\b/i,
  ],
  [
    'planning',
    /\b(?:styling|stylist|motifs?|themes?|decor|decorations?|flowers?|backdrop|coordinators?|coordination|program|timeline|floor plan|pegs?|rehearsal|church|ceremony)\b/i,
  ],
  [
    'policies',
    /\b(?:polic(?:y|ies)|rules?|terms|contract|pets?|dogs?|overtime|curfew|smoking|noise|fireworks|damages?|liabilit\w*|cancel\w*|reschedul\w*|patakaran|bawal)\b/i,
  ],
  [
    'facilities',
    /\b(?:hall|garden|pool|parking|capacity|facilit\w*|room|rooms|aircon|air-?con\w*|generator|led|stage|restrooms?|toilets?|cr|wheelchair|wifi|chairs?|tables?|sound|lights?|selah|pavilion)\b/i,
  ],
  ['location', /\b(?:where|location|located|address|directions|map|route|commute|saan|nasaan)\b/i],
  ['visits', /\b(?:ocular|site visit|visiting|visit|tour|bisita)\b/i],
  ['contact', /\b(?:contact|email|phone|call|message|staff|human|person|messenger|facebook)\b/i],
  ['booking', /\b(?:book|booking|reserve|reservation|mag-?book|i-?book|hold|held)\b/i],
];

export function detectTopic(text: string): ZeniTopic {
  if (asksAboutDates(text)) return 'availability';
  return TOPIC_PATTERNS.find(([, pattern]) => pattern.test(text))?.[0] ?? 'other';
}
