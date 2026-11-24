/**
 * Guest language for Zeni. Detection is a small word-list heuristic, not a language model: it only
 * decides which template set to use and which language the composed answer should mirror.
 * Filipino and Taglish share the Taglish template set.
 */
export type ZeniLanguage = 'en' | 'fil' | 'taglish';
export type ZeniTemplateLanguage = 'en' | 'taglish';

export const zeniLanguages = ['en', 'fil', 'taglish'] as const satisfies readonly ZeniLanguage[];

// Common Filipino function words, question words and event vocabulary. Words that are also
// ordinary English words ("may", "at", "to", "o") are deliberately excluded.
const FILIPINO_WORDS = new Set(
  `po opo ho oho ba ang ng nang mga sa si sina ni nina kay kina ko ako akin ikaw ka mo kayo ninyo
  niyo nyo kami namin natin tayo sila nila siya niya ito iyan yan iyon yun yung iyong dito diyan
  dyan doon na pa lang lamang naman nga din rin daw raw kasi pero kung kapag pag para dahil hindi
  oo wala meron mayroon ano anong sino saan nasaan kailan paano bakit ilan ilang magkano pwede
  puwede gusto sana salamat maraming kumusta kamusta talaga maganda ganda bisita kasal binyag
  kaarawan handaan presyo bayad petsa araw buwan taon oras tao katao lugar bakante libre muna sige
  alam tanong tulong kailangan ngayon bukas kahapon lunes martes miyerkules huwebes biyernes sabado
  enero pebrero marso abril mayo hunyo hulyo agosto setyembre oktubre nobyembre disyembre paki
  pakisabi pakiusap kuya ninang ninong ulan pagkain kain magandang umaga hapon gabi tanghali
  pasensya walang anuman sigurado ayos galing huwag wag lahat ilalagay ibang iba susunod`
    .split(/\s+/)
    .filter(Boolean),
);

// Common English function words plus the venue vocabulary guests mix into Taglish sentences.
const ENGLISH_WORDS = new Set(
  `the a an is are was were be been am do does did can could would will should have has had what
  which who whom whose when where why how much many you your yours we our us i me my it its this
  that these those there here for of from with about into on in by and or but not no yes please
  thanks thank hey if any some all more most also just only very really like want need know tell
  show give get check book booking reserve reservation available availability date dates guests
  guest people package packages price prices rate rates cost venue event events wedding birthday
  debut christening party hall garden pool visit schedule time located location address parking
  capacity payment deposit policy policies include included inclusions food catering menu open
  hours day week month year free still other another next first help talk staff person`
    .split(/\s+/)
    .filter(Boolean),
);

// Taglish verbs built on English roots, such as "mag-book", "i-check" or "pa-reserve".
const TAGLISH_VERB = /^(?:mag|nag|pag|i|ma|na|pa|naka|maka|ipa|magpa|nagpa)-[a-z]{2,}$/;

function words(text: string) {
  return (
    text
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .match(/[a-z]+(?:-[a-z]+)*/g) ?? []
  );
}

/** Mirrors the guest. Messages without language markers keep the previous language. */
export function detectLanguage(text: string, fallback: ZeniLanguage = 'en'): ZeniLanguage {
  let filipino = 0;
  let english = 0;
  for (const word of words(text)) {
    if (FILIPINO_WORDS.has(word) || TAGLISH_VERB.test(word)) filipino += 1;
    else if (ENGLISH_WORDS.has(word)) english += 1;
  }
  if (filipino === 0) return english > 0 ? 'en' : fallback;
  return english === 0 ? 'fil' : 'taglish';
}

export function templateLanguage(language: ZeniLanguage): ZeniTemplateLanguage {
  return language === 'en' ? 'en' : 'taglish';
}

export function languageName(language: ZeniLanguage) {
  return language === 'en' ? 'English' : language === 'fil' ? 'Filipino' : 'Taglish';
}
