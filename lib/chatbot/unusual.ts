/**
 * Unusual event requests (docs/chatbot.md, "Unusual and unrelated questions"): items and activities
 * guests ask permission for that Zion's published rules may not cover. Zeni answers from a
 * published rule that names the item, or says honestly that it has no rule yet and offers the
 * team; it never guesses one.
 */
export type UnusualEventTopic = {
  id: 'pets' | 'fireworks' | 'confetti' | 'inflatables' | 'flames' | 'equipment' | 'props';
  /** The words that name the topic in a guest's message (English and Filipino). */
  pattern: RegExp;
  /**
   * Words a published rule uses for the whole topic ("pets" covers a dog). Without them only the
   * guest's own word counts: a rule about generators says nothing about drones.
   */
  ruleTerms: readonly string[];
  /** How a reply names the topic; without one it repeats the guest's word. */
  subject?: { en: string; fil: string };
};

export const UNUSUAL_EVENT_TOPICS: readonly UnusualEventTopic[] = [
  {
    id: 'pets',
    pattern:
      /\b(?:pets?|dogs?|pupp(?:y|ies)|cats?|kittens?|animals?|aso|asong|pusa|alagang? hayop|hayop)\b/i,
    ruleTerms: ['pet', 'pets', 'animal', 'animals'],
    subject: { en: 'bringing pets or animals', fil: 'pagdadala ng alagang hayop' },
  },
  {
    id: 'fireworks',
    pattern: /\b(?:fireworks?|firecrackers?|pyrotechnics?|sparklers?|paputok|lusis|kwitis)\b/i,
    ruleTerms: ['fireworks', 'firecrackers', 'pyrotechnics'],
    subject: { en: 'fireworks or sparklers', fil: 'fireworks o paputok' },
  },
  {
    id: 'confetti',
    pattern:
      /\b(?:confetti|glitters?|smoke bombs?|colou?red smoke|smoke powder|powder cannons?)\b/i,
    ruleTerms: ['confetti', 'glitter', 'smoke powder'],
    subject: { en: 'confetti, glitter or smoke effects', fil: 'confetti, glitter o smoke effects' },
  },
  {
    id: 'inflatables',
    pattern: /\b(?:inflatables?|bouncy|bounce house|trampolines?|ball pits?)\b/i,
    ruleTerms: ['inflatable', 'inflatables'],
    subject: { en: 'inflatables such as bouncy castles', fil: 'inflatables gaya ng bouncy castle' },
  },
  {
    id: 'flames',
    pattern: /\b(?:candles?|open flames?|sky lanterns?|lanterns?|bonfires?|kandila)\b/i,
    // Only a rule that names the guest's own word: an open-flame rule says nothing about LED or
    // battery candles, and may be about the rooms.
    ruleTerms: [],
    subject: { en: 'candles or open flames', fil: 'kandila o open flame' },
  },
  {
    // Zion's own LED wall and back-up generator are not outside equipment; a guest's are.
    id: 'equipment',
    pattern:
      /\b(?:fog machines?|smoke machines?|bubble machines?|drones?|(?:own|outside|sariling) (?:equipment|generators?|led walls?|lights?|lighting|speakers?|sound system))\b/i,
    ruleTerms: [],
  },
  {
    id: 'props',
    pattern: /\b(?:props?|costumes?|mascots?|cosplay)\b/i,
    ruleTerms: ['props', 'costumes'],
    subject: { en: 'props and costumes', fil: 'props at costume' },
  },
];

/** Asking whether something may be brought or done ("Can I bring…?", "Pwede po bang…?"). */
const ASKS_PERMISSION =
  /\b(?:can (?:i|we|they|guests|our)|may (?:i|we)|could (?:i|we)|is it (?:ok(?:ay)?|allowed|possible|fine)|are (?:we|guests|kids) allowed|allowed|permitted|pwede|puwede|pede|bawal|magdala|dalhin|dadalhin)\b/i;

export type UnusualEventRequest = {
  topic: UnusualEventTopic;
  /** The guest's own word for it ("drones", "aso"). */
  asked: string;
};

export function unusualEventRequest(text: string): UnusualEventRequest | null {
  for (const topic of UNUSUAL_EVENT_TOPICS) {
    const asked = text.match(topic.pattern)?.[0];
    if (asked) return { topic, asked: asked.toLowerCase() };
  }
  return null;
}

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Whether a published text names what the guest asked about (its word, or the topic's). */
export function namesRequest(text: string, request: UnusualEventRequest) {
  const own = request.asked.replace(/(?<=[a-z]{3})(?:es|s)$/, '');
  const terms = [`${escape(own)}(?:e?s)?`, ...request.topic.ruleTerms.map(escape)];
  return new RegExp(`\\b(?:${terms.join('|')})\\b`, 'i').test(text);
}

/** Words that make a sentence a rule rather than a mention. */
const RULE_WORDS =
  /\b(?:allowed|permitted|prohibited|forbidden|banned|strictly|must|welcome|bawal|pinapayagan|ipinagbabawal)\b/i;

/**
 * The published sentence that states a rule about what the guest asked: an FAQ answer whose
 * question or answer names it, or the policy line that names it with a rule word ("Confetti,
 * glitter … are prohibited unless approved in writing"). Only that sentence is quoted, so a
 * policy about something else is never passed off as the answer.
 */
export function publishedRuleFor<T extends { kind: string; title: string; text: string }>(
  sources: readonly T[],
  request: UnusualEventRequest,
): { source: T; rule: string } | null {
  for (const source of sources) {
    if (source.kind === 'faq') {
      if (
        namesRequest(`${source.title}\n${source.text}`, request) &&
        RULE_WORDS.test(`${source.title}\n${source.text}`)
      )
        return { source, rule: source.text.trim() };
      continue;
    }
    if (source.kind !== 'policy') continue;
    const line = source.text
      .split(/\n|(?<=[.!?])\s+/)
      .map((part) => part.trim())
      .find((part) => namesRequest(part, request) && RULE_WORDS.test(part));
    if (line) return { source, rule: line };
  }
  return null;
}

/** How Zeni's reply names the request, in the guest's language. */
export function requestSubject(request: UnusualEventRequest, language: 'en' | 'fil') {
  if (request.topic.subject) return request.topic.subject[language];
  // "own lights", "outside sound system": the guest's own equipment in general.
  if (/^(?:own|outside|sariling)/.test(request.asked))
    return language === 'en' ? 'bringing your own equipment' : 'pagdadala ng sariling equipment';
  // "a drone" is asked about; the rule would be about drones.
  return request.asked.endsWith('s') ? request.asked : `${request.asked}s`;
}

export function asksPermission(text: string) {
  return ASKS_PERMISSION.test(text);
}
