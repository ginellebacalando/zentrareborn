import type { ChatReply, ChatSource } from './types';
import { chatbotGreeting, chatbotReceptionist } from '@/config/chatbot-receptionist';

const suggestions = ['Where are you located?', 'Wedding packages', 'What are your visiting hours?'];
const ignored = new Set(
  'a an the is are am be do does did can could would will i we my our me us you your it that this those these there their of for to from in at on with and or about what which when who how much many please tell know like want need have has any more details information offer offerings offering options find get show list see give provide available zion events place po ba ang ng mga sa ko ako ninyo nyo naman lang'.split(
    ' ',
  ),
);
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
  packages: 'package',
  weddings: 'wedding',
  kasal: 'wedding',
  birthdays: 'birthday',
  debuts: 'debut',
  policies: 'policy',
  rules: 'policy',
  located: 'location',
  address: 'location',
  where: 'location',
  saan: 'location',
  directions: 'location',
  guests: 'guest',
  pax: 'guest',
  capacity: 'guest',
  people: 'guest',
  persons: 'guest',
  payments: 'payment',
  pay: 'payment',
  cancellations: 'cancellation',
  cancel: 'cancellation',
  refund: 'refundable',
  refunds: 'refundable',
  pets: 'pet',
  dogs: 'pet',
  hours: 'hour',
  opening: 'visiting',
  open: 'visiting',
  parking: 'parking',
  inclusions: 'inclusion',
  included: 'inclusion',
  includes: 'inclusion',
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

export function answerVisitor(
  question: string,
  sources: ChatSource[],
  previousQuestion = '',
): ChatReply {
  if (/^(salamat|thanks|thank you)[!.\s]*$/i.test(question))
    return {
      kind: 'greeting',
      message: chatbotReceptionist.appreciation,
      sources: [],
      suggestions,
    };

  const greeting = /^(hi|hello|hey|good (day|morning|afternoon|evening)|kumusta)[!.\s]*$/i.test(
    question,
  );
  if (greeting)
    return {
      kind: 'greeting',
      message: chatbotGreeting,
      sources: [],
      suggestions,
    };

  // These requests require a person and live operational information, never a search result.
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
        'Please contact the Zion team for live date availability, venue appointments, reservations, payments, or help with an existing event. I cannot check the calendar, make a reservation, or confirm a payment.',
      sources: [],
      suggestions: ['Where are you located?', 'What are your visiting hours?'],
    };

  const isFollowUp = /\b(it|that|those|these|them|more|inclusions)\b/i.test(question);
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

  if (!matches.length)
    return {
      kind: 'handoff',
      message:
        'I couldn’t find a reliable answer in Zion’s published information. Try a specific question about a package, venue, or policy, or contact the team for help.',
      sources: [],
      suggestions,
    };
  return {
    kind: 'answer',
    message: 'Here is the published information that matches your question.',
    sources: matches
      .filter((match) => match.score === matches[0].score)
      .slice(0, 3)
      .map(({ source }) => evidence(source)),
    suggestions: ['Where are you located?', 'How do I contact your team?'],
  };
}
