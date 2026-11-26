import type { ChatReply, ChatSource } from './types';
import { zeniCopy } from '@/config/chatbot-receptionist';

const suggestions = ['Where are you located?', 'Wedding packages', 'What are your visiting hours?'];
// English and Filipino words that carry no subject: they never decide which source answers.
const ignored = new Set(
  `a an the is are am be do does did can could would will i we my our me us you your it that this
  those these there their here hi hello hey just also so ok okay thanks thank yes of for to from in
  at on with and or about what which when who how much many please tell know like want need have
  has any more details information offer offerings offering options find get show list see give
  provide available zion events place po ba ang ng mga sa ko ako ninyo nyo naman lang kayo ano may
  meron pa na yung iyong para pwede puwede pwedeng puwedeng mag magpa nag gusto kami namin natin
  tayo kung din rin daw raw ito iyan yan dito diyan doon paano if happens happen use using used
  ask asking question questions inquire wondering sana ho opo kasi talaga nga yun ung iyon dun
  niyo nila sila siya niya ka mo ikaw amin atin inyo kanila akin iyo si ni kay nang ay at o pag
  kapag anong sino ilan ilang gaano bakit kailan alin aling still already even really only very
  some every each been being was were had should shall might must let make made go going come
  coming say said think allowed allow allowing bawal possible okay ok sure yet then than also
  too ever usually actually exactly anything something everything someone anyone thing things
  way ways kind need needs needed kaya puwedeng pede pde naman ba now asap today right all not no
  after before during while until since full whole complete entire first second third fourth
  fifth last next bang kailangan kailangang dapat hindi wala walang huwag wag habang lahat
  pagkatapos mula naka kong akong naming kaming niyong kayong ninyong gamitin gumamit paggamit
  magagamit gagamitin ginagamit bawat kada isang mangyayari nangyayari mismo mismong sabihin
  malaman alam tungkol mas nasa pang pareho galing gaya tulad gawin ginagawa makukuha makuha
  makakuha makita makikita unang ibig ngayon ngayong agad them they its up am pm choose chose
  choosing between difference differences compare compared comparing comparison versus vs
  pagkakaiba pinagkaiba`
    .split(/\s+/)
    .filter(Boolean),
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
  // "No hidden charges" answers questions about the price being all-in.
  charge: 'price',
  charges: 'price',
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
  alituntunin: 'policy',
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
  bisitang: 'guest',
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
  magbayad: 'payment',
  bayaran: 'payment',
  babayaran: 'payment',
  pagbabayad: 'payment',
  nakapagbayad: 'payment',
  magbabayad: 'payment',
  araw: 'day',
  buwan: 'month',
  taon: 'year',
  loob: 'indoor',
  libre: 'free',
  libreng: 'free',
  simbahan: 'church',
  papunta: 'location',
  papuntang: 'location',
  pupunta: 'location',
  pumunta: 'location',
  isama: 'inclusion',
  // "What's nice about Zion?" is answered by "Why Choose Zion Events Place".
  maganda: 'advantages',
  magaganda: 'advantages',
  ganda: 'advantages',
  highlights: 'advantages',
  expect: 'advantages',
  special: 'advantages',
  cancellations: 'cancellation',
  cancel: 'cancellation',
  kanselahin: 'cancellation',
  refund: 'refundable',
  refunds: 'refundable',
  pets: 'pet',
  dogs: 'pet',
  aso: 'pet',
  pusa: 'pet',
  hours: 'hour',
  oras: 'hour',
  hrs: 'hour',
  opening: 'visiting',
  open: 'visiting',
  bukas: 'visiting',
  paradahan: 'parking',
  sasakyan: 'parking',
  kotse: 'parking',
  inclusions: 'inclusion',
  included: 'inclusion',
  includes: 'inclusion',
  include: 'inclusion',
  kasama: 'inclusion',
  allin: 'inclusive',
  hidden: 'inclusive',
  pagkain: 'catering',
  food: 'catering',
  foods: 'catering',
  handa: 'catering',
  kain: 'catering',
  kumain: 'catering',
  ulam: 'catering',
  putahe: 'catering',
  viand: 'catering',
  inumin: 'drink',
  beverages: 'drink',
  beverage: 'drink',
  tubig: 'water',
  alak: 'alcohol',
  panghimagas: 'dessert',
  meryenda: 'snack',
  merienda: 'snack',
  // Official FAQ vocabulary (zion info): plurals and Filipino words guests type.
  rains: 'rain',
  raining: 'rain',
  rainy: 'rain',
  ulan: 'rain',
  umulan: 'rain',
  maulan: 'rain',
  bagyo: 'typhoon',
  kids: 'kid',
  children: 'kid',
  child: 'kid',
  bata: 'kid',
  magdala: 'bring',
  dala: 'bring',
  dalhin: 'bring',
  magdadala: 'bring',
  sarili: 'own',
  sariling: 'own',
  motifs: 'motif',
  themes: 'theme',
  tema: 'theme',
  suppliers: 'supplier',
  carts: 'cart',
  dishes: 'catering',
  dish: 'catering',
  flowers: 'flower',
  bulaklak: 'flower',
  dekorasyon: 'decor',
  decorations: 'decor',
  decoration: 'decor',
  palamuti: 'decor',
  kulay: 'color',
  colour: 'color',
  pegs: 'peg',
  deposits: 'deposit',
  fees: 'fee',
  bayarin: 'fee',
  singil: 'fee',
  alcoholic: 'alcohol',
  liquor: 'alcohol',
  cars: 'parking',
  car: 'parking',
  vehicles: 'parking',
  vehicle: 'parking',
  rescheduling: 'reschedule',
  rebook: 'reschedule',
  ilipat: 'reschedule',
  upuan: 'chair',
  mesa: 'table',
  lamesa: 'table',
  ilaw: 'light',
  lights: 'light',
  lighting: 'light',
  tunog: 'sound',
  kuryente: 'electricity',
  electric: 'electricity',
  restrooms: 'restroom',
  toilet: 'restroom',
  toilets: 'restroom',
  bathroom: 'restroom',
  banyo: 'restroom',
  palikuran: 'restroom',
  cr: 'restroom',
  kwarto: 'room',
  kuwarto: 'room',
  silid: 'room',
  suite: 'room',
  ac: 'aircon',
  genset: 'generator',
  emcee: 'host',
  mc: 'host',
  addon: 'upgrade',
  addons: 'upgrade',
  upgrades: 'upgrade',
  extras: 'upgrade',
  dagdag: 'upgrade',
  karagdagan: 'upgrade',
  photographer: 'photo',
  photographers: 'photo',
  photography: 'photo',
  litrato: 'photo',
  videographer: 'video',
  videography: 'video',
  coordinators: 'coordinator',
  coordination: 'coordinator',
  internet: 'wifi',
  swimming: 'pool',
  swim: 'pool',
  langoy: 'pool',
  lumangoy: 'pool',
  resibo: 'receipt',
  kontrata: 'contract',
  damages: 'damage',
  sira: 'damage',
  nasira: 'damage',
  basura: 'trash',
  garbage: 'trash',
  linis: 'cleaning',
  paglilinis: 'cleaning',
  clean: 'cleaning',
  sigarilyo: 'smoking',
  smoke: 'smoking',
  paninigarilyo: 'smoking',
  ingay: 'noise',
  maingay: 'noise',
  loud: 'noise',
  musika: 'music',
  kanta: 'music',
  paputok: 'fireworks',
  firework: 'fireworks',
  hanggang: 'until',
  gabi: 'night',
  tanghali: 'noon',
  umaga: 'morning',
  hapon: 'afternoon',
};

/** Things whose amount, not price, a guest may ask about with "how much". */
const QUANTITY_NOUNS =
  'food|time|space|room|power|electricity|water|ice|rice|drinks?|alcohol|wine|beer|parking|lead time|notice';

/** Two-word phrases guests type as one idea, joined before splitting into words. */
const PHRASES: ReadonlyArray<[RegExp, string]> = [
  // "How much food" or "how much time" asks about an amount of something, not a price.
  [new RegExp(`\\bhow much\\b(?!\\s+(?:${QUANTITY_NOUNS}))`, 'g'), 'price'],
  [/\ball[-\s]in(?:clusive)?\b/g, 'allin'],
  [/\badd[-\s]?ons?\b/g, 'addon'],
  [/\bwi[-\s]?fi\b/g, 'wifi'],
  [/\bcomfort rooms?\b/g, 'restroom'],
  [/\bsound system\b/g, 'sound'],
  [/\bair[-\s]?con(?:ditioning|ditioned|ditioner)?\b/g, 'aircon'],
  [/\bfood tasting\b/g, 'tasting'],
  [/\bpre[-\s]?event\b/g, 'preevent'],
  [/\bthird[-\s]party\b/g, 'thirdparty'],
  [/\bset[-\s]?up\b/g, 'setup'],
  // "What counts as damage?" asks about damage, not the guest count.
  [/\bcounts? as\b/g, ' '],
];

const undouble = (value: string) =>
  /([b-df-hj-np-tv-z])\1$/.test(value) ? value.slice(0, -1) : value;

/**
 * Conservative English suffix trimming, applied to every word on both sides of a search, so
 * "chairs" meets "chair", "placed" meets "place" and "parties" meets "party". The trimmed form
 * only has to be the same for every spelling; Filipino words rarely end this way.
 */
function stem(word: string) {
  if (!/^[a-z]+$/.test(word) || word.length < 4) return word;
  if (/(?:ss|us|is|ous|eed)$/.test(word)) return word;
  let base = word;
  if (base.endsWith('ies') && base.length > 4) base = `${base.slice(0, -3)}i`;
  else if (base.endsWith('ing') && base.length > 6) base = undouble(base.slice(0, -3));
  else if (base.endsWith('ed') && base.length > 5) base = undouble(base.slice(0, -2));
  else if (/(?:ches|shes|xes)$/.test(base)) base = base.slice(0, -2);
  else if (base.endsWith('s')) base = base.slice(0, -1);
  if (base.length > 4 && base.endsWith('e')) base = base.slice(0, -1);
  if (base.length > 4 && base.endsWith('y')) base = `${base.slice(0, -1)}i`;
  return base;
}

/** One word as search compares it. */
const term = (word: string) => stem(aliases[word] ?? word);

/** The meaningful words of a text, normalized the same way for questions and sources. */
export function searchTerms(text: string) {
  let normalized = text.toLowerCase();
  for (const [pattern, replacement] of PHRASES)
    normalized = normalized.replace(pattern, replacement);
  return [
    ...new Set(
      (normalized.match(/[\p{L}\p{N}]+/gu) ?? [])
        // Numbers (guest counts, dates) are captured as booking details, not search words.
        .filter((word) => !ignored.has(word) && !/^\d+$/.test(word))
        .map(term),
    ),
  ];
}

const terms = searchTerms;

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

type SourceIndex = {
  /** Title and tags: what the source says it is about. */
  title: Set<string>;
  /** The question or heading the source answers, without context such as a package name. */
  subject: Set<string>;
  body: Set<string>;
  lines: Array<Set<string>>;
};
const indexes = new WeakMap<ChatSource, SourceIndex>();
const frequencies = new WeakMap<readonly ChatSource[], Map<string, number>>();

function sourceIndex(source: ChatSource): SourceIndex {
  let index = indexes.get(source);
  if (!index) {
    index = {
      title: new Set(terms(`${source.title} ${source.keywords.join(' ')}`)),
      subject: new Set(terms(source.subject ?? source.title)),
      body: new Set(terms(source.text)),
      lines: source.text
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => new Set(terms(line))),
    };
    indexes.set(source, index);
  }
  return index;
}

/** In how many sources each word appears: rare words say more about what a question asks. */
function documentFrequency(sources: readonly ChatSource[]) {
  let counts = frequencies.get(sources);
  if (!counts) {
    counts = new Map();
    for (const source of sources) {
      const index = sourceIndex(source);
      for (const word of new Set([...index.title, ...index.body]))
        counts.set(word, (counts.get(word) ?? 0) + 1);
    }
    frequencies.set(sources, counts);
  }
  return counts;
}

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

/** Share of the question's weight a source must cover. */
const MIN_COVERAGE = 0.6;
/** A source that covers this much may miss the question's second most specific word. */
const FULL_COVERAGE = 0.8;
/** Share of an FAQ's own question that a visitor's question must name, when it names its subject. */
const MIN_FAQ_SUBJECT = 0.3;
const PACKAGE = term('package');
const PRICE = term('price');
const INCLUSION = term('inclusion');
const AMOUNT_QUESTION = new RegExp(
  `\\b(?:how much(?!\\s+(?:${QUANTITY_NOUNS}))|magkano|presyo|halaga|cost|costs|price|prices|pricing|rates? (?:for|of)|what(?:'s| is) the rate)\\b`,
  'i',
);
/** A peso amount, a percentage or "free" in a source's text. */
const AMOUNT = /₱\s?\d|\bphp\s?\d|\b\d+\s?%|\bpercent\b|\bfree\b|\bno (?:extra )?(?:charge|fee)\b/i;
/** Words of a question about the packages themselves: which there are, for what, and the price. */
const CATALOG_WORDS = new Set(
  [
    'package',
    'price',
    'inclusion',
    'inclusive',
    'wedding',
    'reception',
    'birthday',
    'debut',
    'christening',
    'gender',
    'reveal',
    'christmas',
    'party',
    'corporate',
    'event',
    'celebration',
    'guest',
    'kind',
    'type',
    'best',
    'cheapest',
    'available',
  ].map(term),
);
/** Words of a package's own name ("Zion Classic", "Starry Night") count as catalog words too. */
const namedWord = (word: string) => PACKAGE_NAME_WORDS.has(word);
const PACKAGE_NAME_WORDS = new Set(
  [
    'classic',
    'premium',
    'ultimate',
    'essential',
    'prestige',
    'intimate',
    'hassle',
    'starry',
    'night',
    'grand',
    'premier',
    'milestone',
    'kids',
  ].map(term),
);
/** A package question about these is about terms and fees, not the package catalog. */
const NOT_CATALOG = new Set(
  [
    'policy',
    'cancellation',
    'refundable',
    'reservation',
    'fee',
    'payment',
    'customize',
    'custom',
  ].map(term),
);
/** A source whose subject the question does not name keeps this share of its score. */
const SUBJECT_BASE = 0.5;

/** A source's fit to a question; `confident` means it answers the question on its own. */
type ScoredSource = {
  source: ChatSource;
  coverage: number;
  score: number;
  confident: boolean;
  /** It holds one of the question's two most specific words, or its title holds a question word. */
  related: boolean;
};

/** Share of the question's weight a related source needs to be offered to the language model. */
const CANDIDATE_COVERAGE = 0.15;

const byScore = (a: ScoredSource, b: ScoredSource) => b.score - a.score || b.coverage - a.coverage;

/**
 * Keyword retrieval over published sources, weighted by how rare each word is. A source must cover
 * most of the question's weight and be about its most specific word: that word is in the source's
 * title or tags, or (for a policy, booklet or page, never an FAQ) one line holds it together with
 * most of the question. A shared word such as "guests" or "contract" alone never picks an answer,
 * and an FAQ that answers a different question ("Can we add food from outside?" for "What food is
 * included?") ranks below a source whose subject the question names. Only the best-scoring group
 * is returned.
 */
export function rankSources(
  question: string,
  sources: ChatSource[],
  previousQuestion = '',
): RankedSource[] {
  const matches = scoreSources(question, sources, previousQuestion)
    .filter((match) => match.confident)
    .sort(byScore);
  const best = matches[0]?.score;
  return matches
    .filter((match) => match.score === best)
    .slice(0, 3)
    .map(({ source, coverage, score }) => ({ source, coverage, score }));
}

/**
 * Published sources related to the question, best first, for the language model to choose from
 * when it writes an answer: they hold one of the question's two most specific words and some of
 * its weight, even when no single source answers it on its own. The same package, amount and
 * catalog rules as `rankSources` apply.
 */
export function candidateSources(
  question: string,
  sources: ChatSource[],
  previousQuestion = '',
  limit = 6,
): ChatSource[] {
  return scoreSources(question, sources, previousQuestion)
    .filter((match) => match.related && match.coverage >= CANDIDATE_COVERAGE)
    .sort(byScore)
    .slice(0, limit)
    .map((match) => match.source);
}

function scoreSources(
  question: string,
  sources: ChatSource[],
  previousQuestion: string,
): ScoredSource[] {
  const isFollowUp = /\b(it|that|those|these|them|more|inclusions|iyan|yan|iyon|yun)\b/i.test(
    question,
  );
  const asked = `${question} ${isFollowUp ? previousQuestion : ''}`;
  const query = terms(asked);
  if (!query.length) return [];
  // "Wedding packages" or "How much is the Classic package?" is about the packages themselves;
  // "Are meals for suppliers included in the package?" is about something else and searches all.
  const packageCatalog =
    (query.includes(PACKAGE) &&
      !query.some((word) => NOT_CATALOG.has(word)) &&
      query.every((word) => CATALOG_WORDS.has(word) || namedWord(word))) ||
    (query.length === 1 && query[0] === PRICE);
  // "What does Zion Classic include?" is about that package only, not another package's list. A
  // one-word name ("Christening", or a catalog package called "Wedding") is also an ordinary word,
  // so only names of two words or more count.
  const lowerAsked = asked.toLowerCase();
  const namedPackages = new Set(
    sources
      .map((source) => source.packageName?.trim().toLowerCase())
      .filter((name): name is string =>
        Boolean(name && /\s/.test(name) && lowerAsked.includes(name)),
      ),
  );
  const frequency = documentFrequency(sources);
  const total = Math.max(sources.length, 1);
  // A word no source uses ("drones") still counts, as a fairly specific word, so a question about
  // something unpublished does not borrow the answer of a question that shares its other words.
  const weight = (word: string) => Math.log(1 + total / (frequency.get(word) ?? 3));
  const totalWeight = query.reduce((sum, word) => sum + weight(word), 0);
  const known = query.filter((word) => frequency.has(word));
  if (!known.length) return [];
  // The two most specific known words: a longer question must match both.
  const [focus, second] = [...known].sort((a, b) => weight(b) - weight(a));
  // "How much…?" is answered only by a source that states an amount.
  const asksAmount = AMOUNT_QUESTION.test(asked);
  // "Does Zion Prestige include photo coverage?" is answered from that package or not at all.
  const packageOnly = namedPackages.size > 0 && query.includes(INCLUSION);
  return sources
    .filter(
      (source) =>
        (!packageCatalog ||
          source.kind === 'package' ||
          (source.id.startsWith('event-category:') && !query.includes(PRICE))) &&
        (!namedPackages.size
          ? true
          : source.packageName
            ? namedPackages.has(source.packageName.toLowerCase())
            : !packageOnly) &&
        (!asksAmount || AMOUNT.test(source.text)),
    )
    .map((source) => {
      const { title, subject, body, lines } = sourceIndex(source);
      const found = query.filter((word) => title.has(word) || body.has(word));
      const share = (words: Iterable<string>) =>
        [...words].reduce((sum, word) => sum + weight(word), 0) / totalWeight;
      // One line of a policy, booklet section or page answers the question when it holds the
      // most specific word and, with the title, most of the question (two words or more).
      const lineAnswers = (line: Set<string>) => {
        const held = query.filter((word) => line.has(word) || title.has(word));
        return (
          line.has(focus) && held.length >= Math.min(2, known.length) && share(held) >= MIN_COVERAGE
        );
      };
      // How much of the source's own subject the question names: "Can we add food or dishes from
      // outside?" fits "outside food" better than "Are meals for our outside suppliers included?".
      // It only ranks sources whose title is about the question's most specific word; matches in
      // the body keep their order (an earlier policy section first).
      const subjectWeight = [...subject].reduce((sum, word) => sum + weight(word), 0);
      const subjectShare =
        subjectWeight && title.has(focus)
          ? [...subject]
              .filter((word) => query.includes(word))
              .reduce((sum, word) => sum + weight(word), 0) / subjectWeight
          : 0;
      // An FAQ answers its own question: "Can we change or remove a supplier after confirming?"
      // shares only "confirm" with "How will I know my booking is confirmed?".
      const answersOtherQuestion =
        source.kind === 'faq' && subject.has(focus) && subjectShare < MIN_FAQ_SUBJECT;
      const aboutFocus =
        !answersOtherQuestion &&
        (title.has(focus) ||
          query.every((word) => title.has(word)) ||
          (source.kind !== 'faq' && lines.some(lineAnswers)));
      const coverage = share(found);
      const coversSecond =
        known.length < 3 || !second || found.includes(second) || coverage >= FULL_COVERAGE;
      return {
        source,
        coverage,
        score:
          found.reduce((sum, word) => sum + weight(word) * (title.has(word) ? 3 : 1), 0) *
          (SUBJECT_BASE + subjectShare),
        confident: coverage >= MIN_COVERAGE && aboutFocus && coversSecond,
        related:
          found.includes(focus) ||
          (second !== undefined && found.includes(second)) ||
          known.some((word) => title.has(word)),
      };
    });
}

/**
 * The part of a source that answers the question, in its original order: a whole short source as
 * a list ("Menu: 3 main courses…" with the rest of a catering section), or the matching lines of a
 * long one. FAQ answers are single reviewed paragraphs and stay whole.
 */
export function relevantPassage(question: string, source: ChatSource, limit = 420) {
  const lines = source.text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (source.kind === 'faq' || lines.length <= 1) return lines[0] ?? '';
  // A booklet section reads as a list under its package, because each package's list differs.
  const heading = source.id.startsWith('booklet:') ? [`${source.title}:`] : [];
  const list = (items: string[]) => [...heading, ...items.map((line) => `• ${line}`)].join('\n');
  if (lines.join(' ').length <= limit) return list(lines);
  const query = new Set(terms(question));
  const scored = lines.map((line, index) => ({
    line,
    index,
    hits: terms(line).filter((word) => query.has(word)).length,
  }));
  const matching = scored
    .filter((item) => item.hits > 0)
    .sort((a, b) => b.hits - a.hits || a.index - b.index);
  // A question about the whole source ("Why choose Zion?") gets its opening lines.
  const candidates = matching.length ? matching : scored;
  const picked: typeof scored = [];
  let length = 0;
  for (const item of candidates) {
    if (length + item.line.length > limit && picked.length) break;
    picked.push(item);
    length += item.line.length + 1;
  }
  const chosen = picked.sort((a, b) => a.index - b.index).map((item) => item.line);
  return chosen.length === 1 ? chosen[0] : list(chosen);
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
