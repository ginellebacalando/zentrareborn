import type { ReceptionistIntent } from './conversation';
import { mentionsDate } from './slots';

export function containsSensitiveDetails(message: string) {
  return (
    /\b(?:password|otp|one.time (?:password|code)|cvv|cvc|card number|credit card details|bank login|account password|passport|national id|identity document|identification (?:document|number)|id number|sss number|tin number|driver.?s licen[cs]e|social security number|tax identification number)\b/i.test(
      message,
    ) || /\b(?:\d[ -]?){13,19}\b/.test(message)
  );
}

const GREETING =
  /^(?:(?:hi|hello|hey|helo)(?: po)?(?: zeni)?|good (?:day|morning|afternoon|evening)(?: po)?|magandang (?:araw|umaga|tanghali|hapon|gabi)(?: po)?|kumusta(?: po)?|kamusta(?: po)?)[!.\s]*$/i;
const APPRECIATION =
  /^(?:thanks|thank you|thank you so much|thanks a lot|salamat|maraming salamat|salamat ng marami)(?: po)?(?: zeni)?[!.\s]*$/i;
const SMALL_TALK =
  /^(?:how are you(?: doing)?|how'?s it going|kumusta ka|kamusta ka|kumusta ka na|ok(?:ay)?|sige|ayos|nice|cool|great|wow|galing|ang galing|ang ganda|good (?:job|bot)|you(?:'re| are) (?:great|helpful|nice)|haha+|hehe+|lol)(?: po)?(?: zeni)?[!.?\s]*$/i;

function tokens(message: string) {
  return message.toLowerCase().match(/[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*/gu) ?? [];
}

const PERSON =
  '(?:real\\s+|live\\s+|actual\\s+)?(?:human|person|people|staff|agent|representative|rep|manager|admin|administrator|owner|team|someone|somebody|coordinator|sir\\s+tim|customer\\s+service|sales)';

const PERSON_REQUESTS = [
  // "talk to staff", "connect me with a person", "speak to Sir Tim"
  new RegExp(
    `\\b(?:talk|speak|chat|connect|transfer|escalate|forward|pass)(?:\\s+me)?\\s+(?:to|with|through\\s+to)\\s+(?:a\\s+|an\\s+|the\\s+|your\\s+|some\\s+|one\\s+of\\s+your\\s+)?${PERSON}\\b`,
    'i',
  ),
  // "I want a real person", "we need a human"; not "we need someone to carry the chairs"
  new RegExp(
    `\\b(?:i|we)(?:'d|’d|\\s+would)?\\s+(?:want|need|like|prefer)\\s+(?:a\\s+|an\\s+|the\\s+)?${PERSON}\\b(?!\\s+(?:to|who|that|for|at|in|on|during)\\b)`,
    'i',
  ),
  new RegExp(
    `\\b(?:can|could|may)\\s+i\\s+(?:get|have|reach)\\s+(?:a\\s+|an\\s+)?${PERSON}\\b`,
    'i',
  ),
  // "Is there a human I can chat with?"
  new RegExp(
    `\\bis there (?:a\\s+|an\\s+|any\\s+)?${PERSON}\\s+(?:i|we)\\s+(?:can|could)\\s+(?:talk|speak|chat)\\b`,
    'i',
  ),
  // "Can you pass my question to the staff?", "I'll just wait for a staff member"
  new RegExp(
    `\\b(?:pass|forward|send|relay|refer|escalate|endorse|give)\\s+(?:this|it|me|my\\s+(?:question|concern|message|inquiry|request))\\s+to\\s+(?:a\\s+|an\\s+|the\\s+|your\\s+)?${PERSON}\\b`,
    'i',
  ),
  new RegExp(`\\bwait (?:for|on) (?:a\\s+|the\\s+|your\\s+)?${PERSON}\\b`, 'i'),
  // "Please have someone message me", "Pwede po bang tawagan na lang ako?"; not "Which number
  // will you call me from?"
  /\b(?:please|pls|paki)\s+(?:have\s+someone\s+)?(?:call|text|contact|message|email)\s+me\b|\bhave\s+(?:someone|somebody|a\s+staff(?:\s+member)?)\s+(?:call|text|contact|message|email)\s+me\b|\b(?:can|could)\s+(?:someone|somebody|a\s+staff(?:\s+member)?)\s+(?:please\s+)?(?:call|text|contact|message|email)\s+me\b|\btawagan\s+(?:na\s+)?(?:lang\s+)?(?:po\s+)?ako\b/i,
  // A bare "human please" or "staff po"
  new RegExp(
    `^(?:please\\s+)?(?:a\\s+|an\\s+)?${PERSON}(?:\\s+(?:please|pls|po|now))*[.!?\\s]*$`,
    'i',
  ),
  // "Pwede ko po bang makausap ang staff?", "Paki-connect na lang po ako sa staff"
  /\b(?:kausapin|makausap|makipag-?usap|makipag-?chat|maka-?chat|ikonekta|i-?connect|paki-?connect|ipasa|paki-?pasa|ipaabot|pakisabi)\b(?:\s+(?:ko|kami|po|ba|lang|na|sana|nang|ako|ninyo|niyo|nyo|mo|nalang|muna|ang\s+tanong\s+ko|ito))*\s+(?:(?:ang|ng|sa|si|kay|isang|yung|inyong)\s+)*(?:totoong\s+)?(?:staff|tao|admin|manager|may-?ari|owner|team|coordinator|ahente|agent|sir\s+tim|kayo|tauhan|empleyado)\b/i,
  /\bmay\s+(?:tao|staff)\s+(?:po\s+)?(?:ba\s+)?(?:dyan|diyan|riyan|ryan)\b|\bhihintayin\b.{0,24}\b(?:staff|tao)\b/i,
  // Someone hurt at the venue right now needs the people on duty, not a published answer.
  /\b(?:got|is|was|has been|have been|were)\s+(?:hurt|injured)\b|\bthere(?:'s|’s| is) an? emergency\b|\bemergency (?:right )?now\b|\b(?:nasaktan|naaksidente|nahimatay|fainted|collapsed)\b/i,
  // Two people (or Zeni and staff) said different things: staff must reconcile it.
  /\b(?:said|says|told|sinabi|sabi)\b.{0,90}\b(?:but|pero|while|iba)\b.{0,70}\b(?:said|says|told|sinabi|sabi)\b|\bone staff (?:member )?said\b/i,
];

/**
 * A request to reach a person now. A question about staff ("Can your staff help elderly guests?")
 * is an information question, not a hand-off.
 */
export function asksForPerson(message: string) {
  return PERSON_REQUESTS.some((pattern) => pattern.test(message));
}

const MONTH_WORDS =
  'jan|january|feb|february|mar|march|apr|april|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december|enero|pebrero|marso|abril|mayo|hunyo|hulyo|agosto|setyembre|oktubre|nobyembre|disyembre';
/** Words that make "available" or "free" about the calendar rather than about a thing. */
const DATE_WORDS = new RegExp(
  `\\b(?:dates?|petsa|days?|araw|weekends?|weekdays?|months?|buwan|years?|taon|slots?|sched(?:ule)?s?|sked|calendar|kalendaryo|holidays?|season|ngayong|${MONTH_WORDS}|mondays?|tuesdays?|wednesdays?|thursdays?|fridays?|saturdays?|sundays?|lunes|martes|miyerkules|huwebes|biyernes|sabado|linggo|\\d{1,2}(?:st|nd|rd|th))\\b`,
  'i',
);
const AVAILABILITY_WORDS =
  /\b(?:available|availability|vacant|vacancy|vacancies|bakante|openings?)\b/i;
/** "Free", "open", "libre" and "bukas" are about the calendar only with a date nearby. */
const LOOSE_AVAILABILITY_WORDS = /\b(?:free|open|libre|bukas)\b/i;
/** Things a guest may ask about with "available": "What food is available?" is not a date check. */
const THINGS = new Set(
  `food foods pagkain menu menus dish dishes ulam viand drink drinks inumin beverage beverages water
  tubig juice coffee kape tea alcohol wine beer liquor alak bar catering caterer caterers buffet
  lechon cake cakes dessert desserts tasting parking paradahan wifi wi-fi internet signal chair
  chairs upuan table tables mesa linen linens sound sounds speaker speakers mic mics microphone
  microphones light lights ilaw led projector screen generator aircon ac fan fans electricity
  kuryente outlet outlets room rooms kwarto suite suites restroom restrooms cr banyo toilet toilets
  shower showers towel towels motif motifs theme themes color colors colour colours kulay style
  styles design designs decor decoration decorations flower flowers bulaklak backdrop backdrops
  prop props payment payments bayad gcash discount discounts promo promos promotion promotions
  freebie freebies option options addon addons add-on add-ons upgrade upgrades service services
  supplier suppliers staff coordinator coordinators waiter waiters server servers photographer
  photographers videographer videographers host hosts emcee dj band singer hmua makeup wheelchair
  wheelchairs ramp ramps nurse medic doctor security guard guards plate plates utensils napkin
  napkins sanitary tissue ice grill kitchen stage umbrella umbrellas tent tents shuttle grab taxi
  transport bank atm pharmacy hotel hotels store cart carts photobooth booth mirror car cars van
  package packages`
    .split(/\s+/)
    .filter(Boolean),
);
/** Who or what is being checked: the venue or Zion itself, not an item. */
const VENUE_SUBJECT =
  /\b(?:you|kayo|ninyo|niyo|nyo|venue|zion|place|lugar|hall|garden|pavilion|selah|pool|grounds|ito|this|it)\b/i;

/** A thing named within a few words of the availability word ("food ... available"). */
function thingNearAvailability(message: string) {
  const words = tokens(message);
  return words.some(
    (word, index) =>
      /^(?:available|availability|free|open|libre|bukas|bakante|vacant)$/.test(word) &&
      words.slice(Math.max(0, index - 4), index + 4).some((near) => THINGS.has(near)),
  );
}

/**
 * Whether a date (or the venue) is free, as opposed to whether a thing is available. "Is December
 * 12 available?" and "Available pa po ba?" check the calendar; "What food is available?" and "Is
 * parking free?" are information questions.
 */
export function asksAboutDates(message: string) {
  if (
    /\bcheck (?:a |the |another |my |our )?dates?\b|\bmag-?check ng (?:date|petsa)\b/i.test(message)
  )
    return true;
  if (
    /\b(?:accept|accepting|take|taking|tumatanggap)\b.{0,24}\b(?:bookings?|reservations?|clients?)\b/i.test(
      message,
    )
  )
    return true;
  const exactDate = mentionsDate(message);
  const dated = exactDate || DATE_WORDS.test(message);
  if (!AVAILABILITY_WORDS.test(message) && !(LOOSE_AVAILABILITY_WORDS.test(message) && dated))
    return false;
  if (thingNearAvailability(message) && !exactDate) return false;
  if (/\bpackages?\b/i.test(message) && !dated) return false;
  return dated || VENUE_SUBJECT.test(message) || tokens(message).length <= 7;
}

/** "Book" as the venue booking itself, not a visit, a supplier, a ride or a room. */
const OTHER_BOOKING =
  /\b(?:book|reserve|booking|mag-?book|magpa-?book|i-?book|pa-?book)\s+(?:(?:a|an|the|our|my|your|extra|some|another|ng|po)\s+){0,2}(?:visit|ocular|tour|supplier|suppliers|photographer|photographers|videographer|grab|ride|rides|taxi|car|cars|shuttle|hotel|hotels|room|rooms|tasting|food tasting|band|host|emcee|hmua|makeup|artist|photobooth|parking|slots?|caterer|stylist|transport)\b/i;
/** A booking question about rules or money ("booking fee", "refund"), answered from policies. */
const BOOKING_TERMS = /\b(?:fee|fees|policy|policies|terms|refund|deposit|cancel(?:lation)?)\b/i;
/** "If we book", "after booking", "kung mag-book kami": a condition, not a request. */
const CONDITION =
  /\b(?:if|when|once|after|before|until|unless|even if|without|while|kung|kapag|pag|pagka|bago|pagkatapos|habang)\s+(?:(?:i|we|you|they|kami|tayo|ako|po|na)\s+){0,2}(?:book|booking|booked|reserve|reserving|reserved|mag-?book|magpa-?book|i-?book|nag-?book|mag-?reserve)\b/i;
const BOOKING_REQUESTS = [
  /\b(?:i|we)(?:'d|'m|'re|’d|’m|’re|\s+would|\s+will|\s+am|\s+are)?\s+(?:really\s+|just\s+)?(?:like|love|want|wanna|need|plan|planning|intend|hope|looking|ready|interested)\s+(?:to\s+|in\s+)?(?:book|reserve|booking|reserving|make an? (?:booking|reservation)|secure)\b/i,
  /\bhow (?:do|can|could|would|should|will) (?:i|we|one)\s+(?:book|reserve|make an? (?:booking|reservation)|start|proceed|secure)\b|\bhow to (?:book|reserve)\b/i,
  /\b(?:booking|reservation) (?:process|steps?|procedure|link|form|page)\b|\b(?:steps?|ways?) to (?:book|reserve)\b|\bwhere (?:do|can|should) (?:i|we) (?:book|reserve)\b/i,
  /\b(?:can|could|may)\s+(?:i|we)(?:\s+(?:already|still|now|just|also|even))*\s+(?:book|reserve)\b/i,
  // "book a date", "reserve the venue", "book her debut", "book a Christmas party"
  /\b(?:book|reserve)\s+(?:(?:a|an|the|our|my|this|that|her|his|their)\s+)?(?:[\p{L}-]+\s+)?(?:date|dates|event|venue|wedding|debut|party|birthday|christening|celebration|reception|reunion|hall|garden|place)\b/iu,
  /^(?:please\s+)?(?:book|reserve)\b|^(?:booking|bookings|reservation|reservations|book now)(?:\s+(?:po|please|pls))?[!.?\s]*$/i,
  /\bsecure (?:my|a|the|our) date\b/i,
  /\b(?:mag-?book|magpa-?book|i-?book|pa-?book|ipa-?book|mag-?reserve|magpa-?reserve|i-?reserve|pa-?reserve|ipa-?reserve|magpareserba|magreserba)\b/i,
];

/**
 * Wanting to start a booking ("I want to book", "Paano po mag-book?"). A question that only
 * mentions a booking ("What happens after we book?", "Is my booking confirmed?") is answered from
 * published information instead of opening the booking form.
 */
export function asksToBook(message: string) {
  return (
    BOOKING_REQUESTS.some((pattern) => pattern.test(message)) &&
    !OTHER_BOOKING.test(message) &&
    !BOOKING_TERMS.test(message) &&
    !CONDITION.test(message)
  );
}

const VISIT =
  '(?:ocular(?:\\s+(?:visit|inspection))?|site\\s+visit|visit|venue\\s+tour|tour|viewing)';
const VISIT_REQUESTS = [
  new RegExp(
    `\\b(?:schedule|book|set|arrange|request|plan)\\s+(?:up\\s+)?(?:an?\\s+|the\\s+|our\\s+|my\\s+)?${VISIT}\\b`,
    'i',
  ),
  /\b(?:can|could|may)\s+(?:i|we)\s+(?:visit|see|tour|view|check out|look around)\s+(?:the\s+|your\s+)?(?:venue|place|hall|garden|pavilion|grounds|selah|zion)\b/i,
  new RegExp(
    `\\b(?:can|could|may)\\s+(?:i|we)\\s+(?:do|have|go for|get)\\s+(?:an?\\s+)?${VISIT}\\b`,
    'i',
  ),
  /\bwhen can (?:i|we) (?:visit|do an? ocular|ocular|tour|see the venue)\b/i,
  /\b(?:tour the venue|visit the (?:venue|place))\b/i,
  /\b(?:mag-?schedule|magpa-?schedule|mag-?set|pa-?schedule)\s+(?:po\s+)?(?:ng\s+)?(?:ocular|visit|tour)\b|\b(?:bumisita|bisitahin|makabisita|mag-?ocular|magpa-?ocular)\b|\bmakita ang (?:venue|lugar)\b/i,
];
/** "During our ocular", "bago ang ocular": the visit is context for another question. */
const VISIT_CONTEXT = new RegExp(
  `\\b(?:during|while|when|on|at|after|before|for|from|sa|habang|pagkatapos|bago)\\s+(?:(?:our|my|the|your|aming|ang|ng|we're|we are|there)\\s+){0,3}${VISIT}\\b`,
  'i',
);

/** Asking to arrange a venue visit; a question that only mentions one is answered instead. */
export function asksToVisit(message: string) {
  const short = tokens(message).length <= 6 && /\b(?:ocular|tour|visit)\b/i.test(message);
  return (
    (short || VISIT_REQUESTS.some((pattern) => pattern.test(message))) &&
    !VISIT_CONTEXT.test(message)
  );
}

/** "Can we make special requests?" is a question; "I have a special request" needs a person. */
const QUESTION_FORM =
  /\?|^\s*(?:can|could|may|might|what|how|is|are|do|does|will|when|why|which|pwede|puwede|paano|ano|kailan|magkano|gaano|bakit|may)\b/i;

/** Rules route capabilities; source text and visitor instructions never grant authority. */
export function receptionistIntent(message: string): ReceptionistIntent {
  if (
    /\b(ignore|override|bypass|forget).{0,30}\b(instructions?|rules?|system|policy)|\b(system prompt|developer message|reveal.*(?:secret|instructions?|password|prompt)|pretend (?:you are|to be))\b/i.test(
      message,
    )
  )
    return 'manipulation';
  if (containsSensitiveDetails(message)) return 'sensitive';
  if (
    /\b(?:you(?:'re| are)?|zeni|bot)\b.{0,24}\b(?:idiot|stupid|useless|moron)\b|\bshut up\b|\b(?:bobo|tanga|gago|fuck(?:ing)?|bullshit|putang ?ina|tang ?ina|pakyu|ulol|inutil)\b/i.test(
      message,
    )
  )
    return 'abuse';
  if (
    /\b(are you (?:a (?:bot|human|person|robot)|real|an? ai)|are you automated|who am i (?:talking|speaking) to|what are you|tao ka ba|bot ka ba|sino ka)\b/i.test(
      message,
    )
  )
    return 'identity';
  if (asksForPerson(message)) return 'human';
  if (/\b(legal advice|medical advice|diagnos[ei]s?|investment advice)\b/i.test(message))
    return 'human';
  if (
    /\b(special arrangement|custom arrangement|special request)\b/i.test(message) &&
    !QUESTION_FORM.test(message)
  )
    return 'human';
  // Feedback about the team ("The staff were so accommodating") is passed on to staff.
  if (
    /\b(?:staff|team|coordinators?|waiters?|servers?|crew)\b.{0,40}\b(?:accommodating|helpful|kind|great|amazing|wonderful|excellent|mabait|maasikaso|magaling|maayos)\b/i.test(
      message,
    ) &&
    !QUESTION_FORM.test(message)
  )
    return 'human';
  if (
    /\b(complaint|unacceptable|disappointed|terrible|angry|scam|unfair|upset|distressed|rude|unprofessional|bastos|reklamo|dismayado|nakakadismaya)\b/i.test(
      message,
    )
  )
    return 'complaint';
  // "We had a great time. Thank you!" is thanks, not a question to search for.
  if (isAppreciation(message)) return 'greeting';
  if (
    /\b(reschedule|rebook|change my (?:date|booking|reservation)|move my (?:date|event|booking|reservation)|ilipat ang (?:date|petsa|booking)|palitan ang (?:date|petsa))\b/i.test(
      message,
    )
  )
    return 'reschedule';
  if (
    /\b(cancel my|cancel (?:the |a |our )?(?:booking|reservation|event)|i-?cancel|ikansela|kanselahin)\b/i.test(
      message,
    )
  )
    return 'cancel';
  if (asksToVisit(message)) return 'visit';
  if (asksAboutDates(message)) return 'availability';
  if (asksToBook(message)) return 'new_booking';
  if (
    /\b(recommend|suggest|best fit|which package|anong package|ano ang (?:magandang|best) package)\b/i.test(
      message,
    ) &&
    /\b(package|wedding|birthday|debut|event|kasal|binyag)\b/i.test(message)
  )
    return 'offerings';
  if (
    /\b(expensive|too much|afford|budget|think about|not sure|maybe later|not now|comparing|compare|discount|legit|trust|ask my|check with my|mahal|pag-?iisipan)\b/i.test(
      message,
    )
  )
    return 'objection';
  if (/\b(competitor|better than|why (?:choose|zion)|versus| vs\.? )\b/i.test(message))
    return 'comparison';
  if (
    /\b(weather|forecast|joke|poem|politics|news|homework|programming)\b/i.test(message) &&
    !/\b(venue|garden|hall|event|outdoor|indoor|rain|transfer|policy)\b/i.test(message)
  )
    return 'off_topic';
  if (
    /\b(weather forecast|politics|president|election|stock market|bitcoin|write (?:me |some )?code|football|basketball|who won|recipe|restaurant recommendation|recommend a (?:restaurant|hotel)|medical advice|diagnos[ei]|investment advice)\b/i.test(
      message,
    )
  )
    return 'off_topic';
  // Questions with nothing to do with Zion or an event: general knowledge, schoolwork, coding.
  if (
    /\b(capital of|population of|kabisera ng|translate (?:this|to)|solve (?:this|the|for)|math problem|equation|takdang[- ]aralin|essay about|python|javascript|chatgpt|song lyrics|lyrics of|horoscope|lotto|lottery|crypto(?:currency)?|stock price|prime minister)\b/i.test(
      message,
    )
  )
    return 'off_topic';
  if (
    /\b(policy|policies|rules?|terms|cancel(?:lation)?|refund|rescheduling|patakaran)\b/i.test(
      message,
    )
  )
    return 'policy';
  if (
    /\b(price|pricing|cost|rate|how much|magkano|presyo|fee|payment|deposit|cash|card|check|cheque|bank transfer|bayad|gcash)\b/i.test(
      message,
    )
  )
    return 'pricing';
  if (
    /\b(package|packages|included|inclusions|offering|services|wedding|birthday|debut|christening|gender reveal|christmas|kasal|binyag|kaarawan)\b/i.test(
      message,
    )
  )
    return 'offerings';
  if (GREETING.test(message) || APPRECIATION.test(message)) return 'greeting';
  if (SMALL_TALK.test(message)) return 'small_talk';
  if (
    /\b(where|location|address|hours|contact|email|phone|parking|pets?|capacity|guests|venue|garden|hall|pool|directions|saan|nasaan|lugar|oras)\b/i.test(
      message,
    )
  )
    return 'information';
  return 'unclear';
}

/** Thanks alone, or thanks that ends a message without asking anything. */
export function isAppreciation(message: string) {
  const text = message.trim();
  return (
    APPRECIATION.test(text) ||
    (/\b(?:thank you|thanks|salamat)\b/i.test(text) && !QUESTION_FORM.test(text))
  );
}
