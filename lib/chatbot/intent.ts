import type { ReceptionistIntent } from './conversation';

export function containsSensitiveDetails(message: string) {
  return (
    /\b(?:password|otp|one.time (?:password|code)|cvv|cvc|card number|credit card details|bank login|account password|passport|national id|identity document|identification (?:document|number)|id number|sss number|tin number|driver.?s licen[cs]e|social security number|tax identification number)\b/i.test(
      message,
    ) || /\b(?:\d[ -]?){13,19}\b/.test(message)
  );
}

/** Rules route capabilities; source text and client instructions never grant authority. */
export function receptionistIntent(message: string): ReceptionistIntent {
  if (
    /\b(ignore|override|bypass|forget).{0,30}\b(instructions?|rules?|system|policy)|\b(system prompt|developer message|reveal.*(?:secret|instructions?|password)|pretend (?:you are|to be))\b/i.test(
      message,
    )
  )
    return 'manipulation';
  if (containsSensitiveDetails(message)) return 'sensitive';
  if (
    /\b(?:you(?:'re| are)?|zeni|bot)\b.{0,24}\b(?:idiot|stupid|useless|moron)\b|\bshut up\b/i.test(
      message,
    )
  )
    return 'abuse';
  if (
    /\b(are you (?:a (?:bot|human|person)|real|ai)|are you automated|who am i (?:talking|speaking) to|what are you)\b/i.test(
      message,
    )
  )
    return 'identity';
  if (
    /\b(human|(?:a|real) person|speak (?:to|with)|talk (?:to|with)|staff|manager|agent|someone from (?:the |your )?team)\b/i.test(
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
    /\b(complaint|unacceptable|disappointed|terrible|angry|scam|unfair|upset|distressed)\b/i.test(
      message,
    )
  )
    return 'complaint';
  if (
    /\b(reschedule|change my date|move my (?:date|event|booking)|change my booking)\b/i.test(
      message,
    )
  )
    return 'reschedule';
  if (/\b(cancel my|cancel (?:the |a )?(?:booking|reservation|event))\b/i.test(message))
    return 'cancel';
  if (
    /\b(available|availability|vacant|bakante|free on|free (?:this|next)|open (?:on|slot))\b/i.test(
      message,
    ) &&
    !(
      /\bpackages?\b/i.test(message) &&
      !/\b(on|date|day|week|month|tomorrow|today|next|\d+)\b/i.test(message)
    )
  )
    return 'availability';
  if (
    /\b(book|booking|reserve|reservation|secure (?:my|a|the) date|how (?:do|can) i (?:start|proceed))\b/i.test(
      message,
    ) &&
    !/\b(fee|policy|policies|terms|refund|deposit|cancel(?:lation)?)\b/i.test(message)
  )
    return 'new_booking';
  if (
    /\b(recommend|suggest|best fit|which package)\b/i.test(message) &&
    /\b(package|wedding|birthday|debut|event)\b/i.test(message)
  )
    return 'offerings';
  if (
    /\b(expensive|too much|afford|budget|think about|not sure|maybe later|not now|comparing|compare|discount|legit|trust|ask my|check with my)\b/i.test(
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
  if (/\b(policy|policies|rules?|terms|cancel(?:lation)?|refund|rescheduling)\b/i.test(message))
    return 'policy';
  if (
    /\b(price|pricing|cost|rate|how much|magkano|presyo|fee|payment|deposit|cash|card|check|cheque|bank transfer)\b/i.test(
      message,
    )
  )
    return 'pricing';
  if (
    /\b(package|packages|included|inclusions|offering|services|wedding|birthday|debut|christening|gender reveal|christmas)\b/i.test(
      message,
    )
  )
    return 'offerings';
  if (
    /^(?:(?:hi|hello|hey)(?: po)?|good (?:day|morning|afternoon|evening)|kumusta|thanks(?: po)?|thank you(?: po)?|salamat)[!.\s]*$/i.test(
      message,
    )
  )
    return 'greeting';
  if (
    /\b(where|location|address|hours|contact|email|phone|parking|pets?|capacity|guests|venue|garden|hall|pool|directions|saan)\b/i.test(
      message,
    )
  )
    return 'information';
  return 'unclear';
}
