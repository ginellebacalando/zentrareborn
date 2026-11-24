/**
 * Personal-data redaction applied before any text leaves the server for a language model, and
 * before guest text is kept as conversation context. It is a pattern guard, not universal
 * personal-data detection: names are recognized only when the guest introduces them or when
 * Zeni collected them for a staff hand-off.
 */
export type RedactionOptions = {
  /** Names already known for this conversation, for example the hand-off name. */
  names?: readonly string[];
  maxLength?: number;
};

const REFERENCE_CODE =
  /\b(?:ZION|ZENI|INQ|REQ|ESC|BKG|BK|REF|RES)-(?=[A-Z0-9-]*\d)[A-Z0-9]+(?:-[A-Z0-9]+)*\b/gi;
const LABELLED_REFERENCE =
  /\b((?:booking|reservation|reference|ref|inquiry|confirmation|transaction|receipt)(?:\s+(?:no\.?|number|code|id))?\s*(?:is\s+|:\s*|#\s*|no\.\s*))((?=[A-Z0-9-]*\d)[A-Z0-9][A-Z0-9-]{3,79})\b/gi;
const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.\p{L}{2,}/gu;
const PHILIPPINE_MOBILE = /(?:\+\s?63|\b63|\b0)[\s.-]?9\d{2}[\s.-]?\d{3}[\s.-]?\d{4}\b/g;
const LANDLINE = /(?:\(\s?0?2\s?\)|\b02)[\s.-]?\d{4}[\s.-]?\d{4}\b/g;
const LONG_NUMBER = /(?<![\d-])\d(?:[\s.-]?\d){8,}(?![\d-])/g;
const STREET_ADDRESS =
  /(?:#\s?)?\b\d{1,5}[A-Za-z]?\s+(?:[\p{Lu}][\p{L}.'’-]*\s+){0,4}(?:St\.?|Street|Ave\.?|Avenue|Rd\.?|Road|Blvd\.?|Boulevard|Dr\.?|Drive|Ln\.?|Lane|Highway|Hwy\.?|Ext\.?|Extension|Kalye)(?=[\s,.;]|$)/gu;
const HOUSE_NUMBER =
  /#\s?\d{1,5}[A-Za-z]?\s+(?:[\p{Lu}][\p{L}'’-]*)(?:\s+[\p{Lu}][\p{L}'’-]*){0,3}/gu;
const BLOCK_LOT =
  /\b(?:Blk|Block)\.?\s*\d+[A-Za-z]?(?:\s*,?\s*(?:Lot|Lt)\.?\s*\d+[A-Za-z]?)?|\bLot\.?\s*\d+[A-Za-z]?\s*,?\s*(?:Blk|Block)\.?\s*\d+[A-Za-z]?/gi;
const BARANGAY =
  /\b(?:Brgy|Bgy|Barangay)\.?\s+[\p{L}\p{N}][\p{L}\p{N}'’.-]*(?:\s+[\p{Lu}\p{N}][\p{L}\p{N}'’.-]*){0,3}/giu;
const LOCALITY = /\b(?:Purok|Sitio)\s+[\p{L}\p{N}-]+/giu;
const SUBDIVISION =
  /\b(?:[\p{Lu}][\p{L}'’-]*\s+){1,3}(?:Subdivision|Subd\.?|Village|Homes|Residences|Heights)\b/gu;

// Capitalized words that follow "I'm", "this is" or "si" but are not personal names.
const NOT_A_NAME = new Set(
  `zion zeni zentra selah pavilion garden hall pool grounds venue events event place wedding
  debut birthday christening christmas party gender reveal corporate interested looking planning
  ready sorry fine okay ok want would need book booking hello hi yes no here just asking a an the
  from with for going happy glad excited new back available free still from january february march
  april may june july august september october november december monday tuesday wednesday thursday
  friday saturday sunday po`
    .split(/\s+/)
    .filter(Boolean),
);

const NAME_WORD = "[\\p{Lu}][\\p{L}'’.-]*";
// Lowercase surname particles, as in "Juan dela Cruz" or "Ana de los Santos".
const NAME_PARTICLE = '(?:de|del|dela|delos|de\\s+la|de\\s+los|da|di|van|von)';
const STRONG_INTRODUCTION = new RegExp(
  `(\\b(?:my (?:full )?name(?: is|'s)|name\\s*:|(?:ang )?pangalan ko(?: po)?(?: ay)?)\\s+)([\\p{L}][\\p{L}'’.-]*(?:\\s+[\\p{L}][\\p{L}'’.-]*){0,3})`,
  'giu',
);
// Case-sensitive so only a capitalized word after "I'm" or "si" is taken for a name.
const WEAK_INTRODUCTION = new RegExp(
  `(\\b(?:[Ii] am|[Ii]'m|[Ii]’m|[Tt]his is|[Aa]ko(?: po)? (?:ay )?si|si)\\s+)(${NAME_WORD}(?:\\s+(?:${NAME_PARTICLE}\\s+)?${NAME_WORD}){0,3})`,
  'gu',
);
const NAME_STOP = new Set(
  'and or from po i my email phone number for with we on at to of is ang ng sa at ako ko na pa ba'.split(
    ' ',
  ),
);

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function trimName(candidate: string) {
  const kept: string[] = [];
  for (const word of candidate.split(/\s+/)) {
    const plain = word.toLowerCase().replace(/[.'’-]+$/, '');
    if (NAME_STOP.has(plain) || NOT_A_NAME.has(plain)) break;
    kept.push(word.replace(/[.,]+$/, ''));
  }
  return kept.join(' ');
}

function redactIntroducedNames(text: string) {
  const replace = (match: string, lead: string, candidate: string) => {
    const name = trimName(candidate);
    if (!name) return match;
    return `${lead}[name]${candidate.slice(candidate.indexOf(name) + name.length)}`;
  };
  return text.replace(STRONG_INTRODUCTION, replace).replace(WEAK_INTRODUCTION, replace);
}

function redactKnownNames(text: string, names: readonly string[]) {
  let result = text;
  const parts = new Set<string>();
  for (const name of names) {
    const trimmed = name.trim();
    if (trimmed.length < 2) continue;
    parts.add(trimmed);
    for (const part of trimmed.split(/\s+/))
      if (part.length >= 3 && !NOT_A_NAME.has(part.toLowerCase())) parts.add(part);
  }
  // Replace the longest forms first so a full name is not split into partial markers.
  for (const part of [...parts].sort((a, b) => b.length - a.length)) {
    result = result.replace(
      new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(part)}(?![\\p{L}\\p{N}])`, 'giu'),
      '[name]',
    );
  }
  return result;
}

/** Replace contact details, references, addresses and recognized names with placeholders. */
export function redactPersonalData(text: string, options: RedactionOptions = {}) {
  const redacted = redactKnownNames(
    redactIntroducedNames(
      text
        .replace(REFERENCE_CODE, '[reference]')
        .replace(LABELLED_REFERENCE, (_match, label: string, value: string) =>
          /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${label}${value}` : `${label}[reference]`,
        )
        .replace(EMAIL, '[email]')
        .replace(PHILIPPINE_MOBILE, '[phone]')
        .replace(LANDLINE, '[phone]')
        .replace(LONG_NUMBER, (value) =>
          /^\d{4}-\d{2}-\d{2}$/.test(value.trim()) ? value : '[number]',
        )
        .replace(BLOCK_LOT, '[address]')
        .replace(STREET_ADDRESS, '[address]')
        .replace(HOUSE_NUMBER, '[address]')
        .replace(BARANGAY, '[address]')
        .replace(LOCALITY, '[address]')
        .replace(SUBDIVISION, '[address]'),
    ),
    options.names ?? [],
  );
  return redacted.slice(0, options.maxLength ?? 600);
}

/** Back-compatible name for the pattern guard used before storing a question. */
export function redactSensitiveText(text: string) {
  return redactPersonalData(text);
}
