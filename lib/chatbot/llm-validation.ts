import type { ComposeSource, ComposeTurn } from './llm-prompt';

export const MAX_ANSWER_LENGTH = 700;
/** General advice is a short add-on to an answer, never the bulk of a reply. */
export const MAX_ADVICE_LENGTH = 600;

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

const SMALL_NUMBERS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  dalawa: 2,
  dalawang: 2,
  tatlo: 3,
  tatlong: 3,
  apat: 4,
  lima: 5,
  limang: 5,
  anim: 6,
  pito: 7,
  pitong: 7,
  walo: 8,
  walong: 8,
  siyam: 9,
  sampu: 10,
  sampung: 10,
};
const TENS: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

/**
 * Numbers written as words ("thirty-two guests", "one hundred", "sampung bisita"), from 2 up.
 * "One" alone is too common a word to count.
 */
function spelledNumbers(text: string) {
  const words = text.toLowerCase().match(/[a-z]+/g) ?? [];
  const values = new Set<string>();
  const below100 = (index: number): [number, number] | null => {
    const word = words[index];
    if (word in TENS) {
      const unit = SMALL_NUMBERS[words[index + 1]];
      return unit !== undefined && unit < 10 ? [TENS[word] + unit, index + 1] : [TENS[word], index];
    }
    return word in SMALL_NUMBERS ? [SMALL_NUMBERS[word], index] : null;
  };
  for (let index = 0; index < words.length; index += 1) {
    const first = below100(index);
    if (!first) continue;
    let [value, end] = first;
    if (words[end + 1] === 'hundred') {
      value *= 100;
      end += 1;
      const rest = below100(words[end + 1] === 'and' ? end + 2 : end + 1);
      if (rest) [value, end] = [value + rest[0], rest[1]];
    }
    if (value >= 2) values.add(String(value));
    index = end;
  }
  return values;
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
  // A number written as a word must also come from the sources or the conversation.
  const sourceSpelled = spelledNumbers(sourceText);
  for (const value of spelledNumbers(withoutEmails))
    if (!sourceNumbers.has(value) && !sourceSpelled.has(value) && !conversationNumbers.has(value))
      return { ok: false, reason: 'number' };

  if (CLAIMS.some((pattern) => pattern.test(text))) return { ok: false, reason: 'claim' };
  return { ok: true, text };
}

export type AdviceRejection =
  'too_long' | 'placeholder' | 'url' | 'path' | 'contact' | 'money' | 'zion' | 'claim';

export type AdviceValidation = { ok: true; text: string } | { ok: false; reason: AdviceRejection };

/** How general advice must open, so guests can tell it from Zion's own information. */
const ADVICE_OPENER = /^(?:in general|generally|sa pangkalahatan|karaniwan)\b/i;
const PHONE = /(?:\+?63|\b0)9\d{2}[\s-]?\d{3}[\s-]?\d{4}\b|\b\d{7,}\b/;

/**
 * General event-planning advice is not Zion's information, so it may contain ordinary numbers
 * ("8 to 10 guests per round table") but never an amount of money, a link, a contact detail,
 * anything about Zion (that belongs in the Zion part, checked against the sources) or a booking
 * or availability claim. Advice that does not open with "In general" gets that opening.
 */
export function validateGeneralAdvice(
  raw: string,
  language: 'en' | 'taglish' = 'en',
): AdviceValidation {
  const text = raw
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^["“]|["”]$/g, '')
    .trim();
  if (!text) return { ok: true, text: '' };
  if (text.length > MAX_ADVICE_LENGTH) return { ok: false, reason: 'too_long' };
  if (/\[(?:name|email|phone|number|address|reference)\]|\[S\d+\]/i.test(text))
    return { ok: false, reason: 'placeholder' };
  // EMAIL is a global pattern: match() never carries its position over between calls.
  if (text.match(EMAIL) || PHONE.test(text)) return { ok: false, reason: 'contact' };
  if (/https?:\/\/|\bwww\./i.test(text) || DOMAIN.test(text)) return { ok: false, reason: 'url' };
  if (/(?<![\w./])\/[a-z0-9][a-z0-9\-/]*/i.test(text)) return { ok: false, reason: 'path' };
  if (new RegExp(MONEY.source, 'i').test(text) || SPELLED_AMOUNT.test(text))
    return { ok: false, reason: 'money' };
  if (CLAIMS.some((pattern) => pattern.test(text))) return { ok: false, reason: 'claim' };
  // A sentence about Zion belongs in the Zion part, which is checked against the sources.
  const kept = text.split(/(?<=[.!?])\s+/).filter((sentence) => !/\bzion\b/i.test(sentence));
  if (!kept.length) return { ok: false, reason: 'zion' };
  const advice = kept.join(' ');
  if (ADVICE_OPENER.test(advice)) return { ok: true, text: advice };
  const opener = language === 'en' ? 'In general,' : 'Sa pangkalahatan po,';
  const rest = /^\p{Lu}\p{Ll}/u.test(advice)
    ? `${advice[0].toLowerCase()}${advice.slice(1)}`
    : advice;
  return { ok: true, text: `${opener} ${rest}` };
}
