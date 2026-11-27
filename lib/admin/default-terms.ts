import { termsData } from '@/config/terms';

/**
 * Zion's published terms (the Terms page, config/terms.ts) as the venue policy's plain text: the
 * policy starts from it, and a contract falls back to it while the saved policy has no terms. Each
 * group is its category, then "1) SECTION TITLE" and one clause per line (contract-document.ts).
 */
export const defaultTerms = termsData
  .map(
    (group) =>
      `${group.category}\n${group.sections.map((s) => `${s.title}\n${s.content.join('\n')}`).join('\n\n')}`,
  )
  .join('\n\n');
