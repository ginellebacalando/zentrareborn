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
  'contact',
  'other',
] as const;
export type ZeniTopic = (typeof zeniTopics)[number];

const TOPIC_PATTERNS: ReadonlyArray<[ZeniTopic, RegExp]> = [
  ['visits', /\b(?:ocular|site visit|visit(?:ing)?|tour|bisita)\b/i],
  [
    'availability',
    /\b(?:available|availability|vacant|bakante|libre|free on|open (?:on|date)|date|petsa)\b/i,
  ],
  ['booking', /\b(?:book|booking|reserve|reservation|reschedul\w*|cancel\w*|mag-?book|i-?book)\b/i],
  ['payments', /\b(?:payments?|pay|deposit|bayad|gcash|bank|cash|card|downpayment|balance)\b/i],
  [
    'packages',
    /\b(?:packages?|price|pricing|rates?|cost|magkano|presyo|inclusions?|included|budget)\b/i,
  ],
  ['food', /\b(?:food|catering|menu|caterer|pagkain|corkage|cake)\b/i],
  ['policies', /\b(?:polic(?:y|ies)|rules?|terms|refund|pets?|dogs?|overtime|smoking|noise)\b/i],
  [
    'facilities',
    /\b(?:hall|garden|pool|parking|capacity|facilit\w*|venue|room|aircon|led|stage)\b/i,
  ],
  ['location', /\b(?:where|location|located|address|directions|map|saan|nasaan)\b/i],
  ['contact', /\b(?:contact|email|phone|call|message|staff|human|person)\b/i],
];

export function detectTopic(text: string): ZeniTopic {
  return TOPIC_PATTERNS.find(([, pattern]) => pattern.test(text))?.[0] ?? 'other';
}
