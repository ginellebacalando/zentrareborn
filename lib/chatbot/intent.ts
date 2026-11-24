import type { ReceptionistIntent } from './conversation';

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
    /\b(?:you(?:'re| are)?|zeni|bot)\b.{0,24}\b(?:idiot|stupid|useless|moron)\b|\bshut up\b|\b(?:bobo|tanga|gago)\b/i.test(
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
  if (
    /\b(human|(?:a|real) person|speak (?:to|with)|talk (?:to|with)|staff|manager|agent|someone from (?:the |your )?team|kausapin|makausap)\b/i.test(
      message,
    ) ||
    /^person[.!\s]*$/i.test(message)
  )
    return 'human';
  if (
    /\b(legal advice|medical advice|diagnos[ei]s?|investment advice|special arrangement|custom arrangement|special request)\b/i.test(
      message,
    )
  )
    return 'human';
  if (
    /\b(complaint|unacceptable|disappointed|terrible|angry|scam|unfair|upset|distressed|reklamo|dismayado)\b/i.test(
      message,
    )
  )
    return 'complaint';
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
  if (
    /\b(ocular|site visit|venue tour|tour the venue|visit the (?:venue|place)|schedule (?:a |an )?(?:ocular |site )?visit|mag-?schedule ng (?:ocular )?visit|bumisita|bisitahin|makita ang (?:venue|lugar))\b/i.test(
      message,
    )
  )
    return 'visit';
  if (
    (/\b(available|availability|vacant|bakante|free on|free (?:this|next)|open (?:on|slot)|check (?:a |the |another |my )?dates?|available dates?|mag-?check ng (?:date|petsa)|may (?:available|bakante)|libre (?:ba|pa))\b/i.test(
      message,
    ) ||
      /^(?:check (?:a |the )?date|mag-?check ng date)[!.?\s]*$/i.test(message)) &&
    !(
      /\bpackages?\b/i.test(message) &&
      !/\b(on|date|day|week|month|tomorrow|today|next|\d+)\b/i.test(message)
    )
  )
    return 'availability';
  if (
    /\b(book|booking|reserve|reservation|secure (?:my|a|the) date|how (?:do|can) i (?:start|proceed)|mag-?book|magpa-?book|i-?book|pa-?reserve|magpa-?reserve|mag-?reserve)\b/i.test(
      message,
    ) &&
    !/\b(fee|policy|policies|terms|refund|deposit|cancel(?:lation)?)\b/i.test(message)
  )
    return 'new_booking';
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

export function isAppreciation(message: string) {
  return APPRECIATION.test(message.trim());
}
