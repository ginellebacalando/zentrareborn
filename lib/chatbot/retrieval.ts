import type { ChatReply, ChatSource } from './types';
import { zeniCopy } from '@/config/chatbot-receptionist';

const suggestions = ['Where are you located?', 'Wedding packages', 'What are your visiting hours?'];
const ignored = new Set(
  'a an the is are am be do does did can could would will i we my our me us you your it that this those these there their here hi hello hey just also so ok okay thanks thank yes of for to from in at on with and or about what which when who how much many please tell know like want need have has any more details information offer offerings offering options find get show list see give provide available zion events place po ba ang ng mga sa ko ako ninyo nyo naman lang kayo ano may meron pa na yung iyong para pwede puwede pwedeng puwedeng mag magpa nag gusto kami namin natin tayo kung din rin daw raw ito iyan yan dito diyan doon paano if happens happen use using used'.split(
    ' ',
  ),
);
// English and Filipino synonyms that point to the same published fact.
const aliases: Record<string, string> = {
  facilities: 'facility',
  features: 'feature',
  costs: 'price',
  cost: 'price',
  prices: 'price',
  pricing: 'price',
  rates: 'price',
  rate: 'price',
  magkano: 'price',
  presyo: 'price',
  halaga: 'price',
  packages: 'package',
  weddings: 'wedding',
  kasal: 'wedding',
  birthdays: 'birthday',
  kaarawan: 'birthday',
  debuts: 'debut',
  binyag: 'christening',
  baptism: 'christening',
  christenings: 'christening',
  policies: 'policy',
  patakaran: 'policy',
  rules: 'policy',
  located: 'location',
  address: 'location',
  where: 'location',
  saan: 'location',
  nasaan: 'location',
  lugar: 'location',
  directions: 'location',
  guests: 'guest',
  bisita: 'guest',
  tao: 'guest',
  katao: 'guest',
  pax: 'guest',
  capacity: 'guest',
  kasya: 'guest',
  people: 'guest',
  persons: 'guest',
  payments: 'payment',
  pay: 'payment',
  bayad: 'payment',
  cancellations: 'cancellation',
  cancel: 'cancellation',
  refund: 'refundable',
  refunds: 'refundable',
  pets: 'pet',
  dogs: 'pet',
  aso: 'pet',
  hours: 'hour',
  oras: 'hour',
  opening: 'visiting',
  open: 'visiting',
  bukas: 'visiting',
  parking: 'parking',
  paradahan: 'parking',
  inclusions: 'inclusion',
  included: 'inclusion',
  includes: 'inclusion',
  kasama: 'inclusion',
  pagkain: 'catering',
  food: 'catering',
  foods: 'catering',
  handa: 'catering',
  // Official FAQ vocabulary (zion info): plurals and Filipino words guests type.
  rains: 'rain',
  raining: 'rain',
  rainy: 'rain',
  ulan: 'rain',
  umulan: 'rain',
  kids: 'kid',
  children: 'kid',
  child: 'kid',
  bata: 'kid',
  magdala: 'bring',
  dala: 'bring',
  dalhin: 'bring',
  sarili: 'own',
  sariling: 'own',
  motifs: 'motif',
  themes: 'theme',
  suppliers: 'supplier',
  carts: 'cart',
  dishes: 'dish',
  flowers: 'flower',
  pegs: 'peg',
  deposits: 'deposit',
  fees: 'fee',
  alcoholic: 'alcohol',
  liquor: 'alcohol',
  cars: 'parking',
  car: 'parking',
  vehicles: 'parking',
  rescheduling: 'reschedule',
  rebook: 'reschedule',
  hrs: 'hour',
};

function terms(text: string) {
  const normalized = text.toLowerCase().replace(/how much/g, 'price');
  return [
    ...new Set(
      (normalized.match(/[\p{L}\p{N}]+/gu) ?? [])
        .filter((word) => !ignored.has(word))
        .map((word) => aliases[word] ?? word),
    ),
  ];
}

function evidence(source: ChatSource) {
  const limit = 3500;
  return {
    title: source.title,
    excerpt:
      source.text.length > limit
        ? `${source.text.slice(0, limit)}… Read the full source for the remaining details.`
        : source.text,
    href: source.href,
  };
}

export type RankedSource = { source: ChatSource; coverage: number; score: number };

/** True when a source's own title (not its tags) contains every search word of the question. */
export function titleCoversQuestion(question: string, source: ChatSource) {
  const query = terms(question);
  const title = terms(source.title);
  return query.length > 0 && query.every((word) => title.includes(word));
}

/** How much of a source's title the question accounts for: higher means a more specific match. */
export function titleMatchRatio(question: string, source: ChatSource) {
  const query = terms(question);
  const title = terms(source.title);
  return title.length ? title.filter((word) => query.includes(word)).length / title.length : 0;
}

/** Keyword retrieval over published sources. Only the best-scoring group is returned. */
export function rankSources(
  question: string,
  sources: ChatSource[],
  previousQuestion = '',
): RankedSource[] {
  const isFollowUp = /\b(it|that|those|these|them|more|inclusions|iyan|yan|iyon|yun)\b/i.test(
    question,
  );
  const query = terms(`${question} ${isFollowUp ? previousQuestion : ''}`);
  const packageCatalog =
    (query.includes('package') &&
      !query.some((word) =>
        [
          'policy',
          'cancellation',
          'refundable',
          'reservation',
          'fee',
          'payment',
          'customize',
          'custom',
        ].includes(word),
      )) ||
    (query.length === 1 && query[0] === 'price');
  const matches = sources
    .filter(
      (source) =>
        !packageCatalog ||
        source.kind === 'package' ||
        (source.id.startsWith('event-category:') && !query.includes('price')),
    )
    .map((source) => {
      const title = terms(`${source.title} ${source.keywords.join(' ')}`);
      const body = terms(source.text);
      const found = query.filter((word) => title.includes(word) || body.includes(word));
      return {
        source,
        coverage: found.length / Math.max(query.length, 1),
        score: found.reduce((sum, word) => sum + (title.includes(word) ? 3 : 1), 0),
      };
    })
    .filter((match) => match.coverage >= 0.75 && match.score >= 1)
    .sort((a, b) => b.coverage - a.coverage || b.score - a.score);
  return matches.filter((match) => match.score === matches[0]?.score).slice(0, 3);
}

export function answerVisitor(
  question: string,
  sources: ChatSource[],
  previousQuestion = '',
): ChatReply {
  if (/^(salamat|thanks|thank you)[!.\s]*$/i.test(question))
    return {
      kind: 'greeting',
      message: zeniCopy.en.appreciation,
      sources: [],
      suggestions,
    };

  const greeting = /^(hi|hello|hey|good (day|morning|afternoon|evening)|kumusta)[!.\s]*$/i.test(
    question,
  );
  if (greeting)
    return {
      kind: 'greeting',
      message: zeniCopy.en.greeting,
      sources: [],
      suggestions,
    };

  // These requests need live operational information or a person, never a search result.
  const catalogAvailability =
    /\bpackages?\b/i.test(question) &&
    !/\b(on|date|day|week|month|tomorrow|today|next|\d+)\b/i.test(question);
  const liveAvailability =
    /\b(available|availability|vacant|bakante)\b/i.test(question) && !catalogAvailability;
  const needsStaff =
    liveAvailability ||
    /\b(book (?:a|an|the|my|for)|reserve (?:a|an|the|my)|confirm (?:a|the|my)|cancel my|reschedule my|my (?:booking|reservation|payment)|pay online|refund my|speak|human|staff|agent)\b/i.test(
      question,
    );
  if (needsStaff)
    return {
      kind: 'handoff',
      message:
        'Live dates, reservations, payments and existing bookings need the calendar or our staff, not a search result.',
      sources: [],
      suggestions: ['Where are you located?', 'What are your visiting hours?'],
    };

  const matches = rankSources(question, sources, previousQuestion);
  if (!matches.length)
    return {
      kind: 'handoff',
      message: zeniCopy.en.knowledgeGap,
      sources: [],
      suggestions,
    };
  return {
    kind: 'answer',
    message: 'Here is the published information that matches your question.',
    sources: matches.map(({ source }) => evidence(source)),
    suggestions: ['Where are you located?', 'How do I contact your team?'],
  };
}

export { evidence as sourceEvidence };
