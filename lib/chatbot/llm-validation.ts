import type { ComposeSource, ComposeTurn } from './llm-prompt';

export const MAX_ANSWER_LENGTH = 700;

/** Public site paths a reply may mention, in addition to the supplied sources' pages. */
const SITE_PATHS = [
  '/',
  '/about',
  '/booking',
  '/contact',
  '/events',
  '/facilities',
  '/faq',
  '/gallery',
  '/policies',
  '/privacy',
  '/rules',
  '/terms',
  '/testimonies',
  '/events/weddings',
  '/events/birthdays',
  '/events/debuts',
  '/events/christmas-party',
  '/events/christening',
  '/events/gender-reveal',
];

export type AnswerRejection =
  'empty' | 'too_long' | 'placeholder' | 'url' | 'path' | 'contact' | 'number' | 'money' | 'claim';

export type AnswerValidation = { ok: true; text: string } | { ok: false; reason: AnswerRejection };

export type AnswerContext = {
  sources: ComposeSource[];
  question: string;
  recentTurns: ComposeTurn[];
};

const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.\p{L}{2,}/gu;
const DOMAIN =
  /\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|ph|io|co|gov|edu|app|dev|info|biz|me|ai|link|site|online|shop)\b/i;
const MONEY =
  /(?:₱|\bphp\b|\bp(?=\s?\d)|\bpesos?\b)\s?(\d[\d,]*(?:\.\d+)?)|(\d[\d,]*(?:\.\d+)?)\s?(?:pesos?|php)\b/gi;
const SPELLED_AMOUNT = /\b(?:thousand|million|billion|libo|milyon|\d+(?:\.\d+)?\s?k)\b/i;
// Claims a reply must never make: Zeni checks calendars and offers links; staff confirm bookings.
const CLAIMS = [
  /\b(?:i|we)(?:'ve| have)? (?:booked|reserved|confirmed|held|secured)\b/i,
  /\b(?:your|the) (?:booking|reservation|date|slot|event) (?:is|has been|was) (?:now )?(?:confirmed|reserved|booked|secured|held|approved)\b/i,
  /\b(?:date|day|slot|schedule)s? (?:is|are) (?:still )?(?:available|free|open|vacant)\b/i,
  /\b(?:is|are) (?:still )?available (?:on|for) (?:that|your|the) (?:date|day)\b/i,
  /\bnaka-?(?:book|reserve|reserba) na\b/i,
  /\b(?:confirmed|reserved|booked) na (?:po )?(?:ang|yung|ang inyong|ninyo)\b/i,
  /\b(?:available|bakante) (?:pa )?(?:po )?(?:ang|yung) (?:date|petsa|araw)\b/i,
];

function normalizeNumber(value: string) {
  const plain = value.replaceAll(',', '').replace(/\.0+$/, '');
  const numeric = Number(plain);
  return Number.isFinite(numeric) ? String(numeric) : plain;
}

function numbersIn(text: string) {
  return new Set((text.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map(normalizeNumber));
}

/**
 * Accept model text only when it stays inside the supplied facts: no addresses other than the
 * site's own paths, no contact details, amounts or numbers that the sources do not contain, and
 * no availability or booking claims. Any failure keeps Zeni's deterministic answer.
 */
export function validateZeniAnswer(raw: string, context: AnswerContext): AnswerValidation {
  const text = raw
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .replace(/^["“]|["”]$/g, '')
    .trim();
  if (text.length < 2) return { ok: false, reason: 'empty' };
  if (text.length > MAX_ANSWER_LENGTH) return { ok: false, reason: 'too_long' };
  if (/\[(?:name|email|phone|number|address|reference)\]|\[S\d+\]/i.test(text))
    return { ok: false, reason: 'placeholder' };

  const sourceText = context.sources.map((source) => `${source.title}\n${source.text}`).join('\n');
  const sourceEmails = new Set((sourceText.match(EMAIL) ?? []).map((email) => email.toLowerCase()));
  let inventedContact = false;
  const withoutEmails = text.replace(EMAIL, (email) => {
    if (!sourceEmails.has(email.toLowerCase())) inventedContact = true;
    return ' ';
  });
  if (inventedContact) return { ok: false, reason: 'contact' };
  if (/https?:\/\/|\bwww\./i.test(withoutEmails) || DOMAIN.test(withoutEmails))
    return { ok: false, reason: 'url' };

  const allowedPaths = new Set([
    ...SITE_PATHS,
    ...context.sources.map((source) => source.href.split('#')[0] || '/'),
  ]);
  for (const path of withoutEmails.match(/(?<![\w./])\/[a-z0-9][a-z0-9\-/]*/gi) ?? []) {
    const clean = path.replace(/\/+$/, '').toLowerCase() || '/';
    if (!allowedPaths.has(clean)) return { ok: false, reason: 'path' };
  }

  const sourceNumbers = numbersIn(sourceText);
  for (const match of withoutEmails.matchAll(MONEY)) {
    const amount = match[1] ?? match[2];
    if (!amount || !sourceNumbers.has(normalizeNumber(amount)))
      return { ok: false, reason: 'money' };
  }
  if (SPELLED_AMOUNT.test(withoutEmails) && !SPELLED_AMOUNT.test(sourceText))
    return { ok: false, reason: 'money' };

  const conversationNumbers = numbersIn(
    [context.question, ...context.recentTurns.map((turn) => turn.text)].join('\n'),
  );
  for (const value of numbersIn(withoutEmails))
    if (!sourceNumbers.has(value) && !conversationNumbers.has(value))
      return { ok: false, reason: 'number' };

  if (CLAIMS.some((pattern) => pattern.test(text))) return { ok: false, reason: 'claim' };
  return { ok: true, text };
}
