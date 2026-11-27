/**
 * The printed contract (docs/admin-panel.md, "Contracts"): what Zion and the client sign, in the
 * order of Zion's own contract (event details and package inclusions, the contract amount with
 * the payments received, the terms, the signatures). Staff generate it from a confirmed booking;
 * everything it shows is frozen then, so a later edit never changes a printed or signed copy. The
 * snapshot is stored as JSON in the contract's `body`; contracts prepared before this format keep
 * their plain text and print as written. Shared by the server and the contract page.
 */

export const CONTRACT_FORMAT = 'zentra-contract/1';

/** One part of the package, as the booklet groups it: "Venue", "Catering", "Styling" … */
export type ContractInclusion = { title: string; items: string[] };

/** A payment recorded before the contract was generated, as its acknowledgment receipt shows it. */
export type ContractPayment = {
  acknowledgmentNumber: string | null;
  receiptNumber: string;
  receivedAt: string;
  method: string;
  amountCents: number;
};

export type ContractSnapshot = {
  format: typeof CONTRACT_FORMAT;
  reference: string;
  version: number;
  preparedAt: string;
  client: { name: string; email: string; phone: string };
  event: { type: string; venue: string; startsAt: string; endsAt: string; guests: number };
  package: {
    name: string;
    inclusions: ContractInclusion[];
    /** Guests the price covers, and the fee for each guest beyond them (null when unknown). */
    paxIncluded: number | null;
    excessPaxFeeCents: number | null;
    checkIn: string | null;
    checkOut: string | null;
  };
  amounts: {
    totalCents: number;
    reservationFeeCents: number;
    /** When the remaining balance is due (Settings > Booking rules), as an ISO date. */
    balanceDueAt: string;
  };
  payments: ContractPayment[];
  terms: { policyVersion: number; text: string };
  /** Who signs for Zion (Settings > Contracts). */
  signatory: { name: string; title: string };
};

/** The snapshot in a contract body, or null for a contract written before this format. */
export function readContractSnapshot(body: string): ContractSnapshot | null {
  if (!body.trimStart().startsWith('{')) return null;
  try {
    const value: unknown = JSON.parse(body);
    return typeof value === 'object' &&
      value !== null &&
      (value as { format?: unknown }).format === CONTRACT_FORMAT
      ? (value as ContractSnapshot)
      : null;
  } catch {
    return null;
  }
}

/** Money received and still owed, from the payments the contract lists. */
export function contractBalance(snapshot: ContractSnapshot) {
  const paidCents = snapshot.payments.reduce((sum, payment) => sum + payment.amountCents, 0);
  return { paidCents, balanceCents: Math.max(0, snapshot.amounts.totalCents - paidCents) };
}

/** A clause; lines that a clause introduces with a colon ("… as follows:") list under it. */
export type TermsItem = { text: string; sub: string[] };
export type TermsEntry = { kind: 'item'; item: TermsItem } | { kind: 'note'; text: string };
export type TermsSection = { title: string | null; entries: TermsEntry[] };
export type TermsGroup = { title: string | null; sections: TermsSection[] };

const SECTION_TITLE = /^\d+[).]\s+\S/;
const BULLET = /^[•▪◦‣\-–]\s+/;
const EMPHASIS = /^\*\*(.+?)\*\*\s*$/;

/**
 * The venue policy's terms (plain text in Settings) as headings and clauses. The text Zion's
 * policy starts from is written as "Category", then "1) SECTION TITLE" and one clause per line,
 * with "•" for points and "**…**" for a sub-heading; other text still reads in order, one clause
 * per line.
 */
export function termsOutline(text: string): TermsGroup[] {
  const lines = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim());
  const groups: TermsGroup[] = [];
  let section: TermsSection | null = null;
  const openGroup = (title: string | null) => {
    groups.push({ title, sections: [] });
    section = null;
  };
  const currentSection = (): TermsSection => {
    if (section) return section;
    if (!groups.length) openGroup(null);
    const opened: TermsSection = { title: null, entries: [] };
    groups[groups.length - 1].sections.push(opened);
    section = opened;
    return opened;
  };

  lines.forEach((line, index) => {
    if (!line) return;
    if (SECTION_TITLE.test(line)) {
      section = null;
      currentSection().title = line;
      return;
    }
    const emphasis = EMPHASIS.exec(line);
    if (emphasis) {
      currentSection().entries.push({ kind: 'note', text: emphasis[1].trim() });
      return;
    }
    if (BULLET.test(line)) {
      const point = line.replace(BULLET, '');
      const entries = currentSection().entries;
      const last = entries[entries.length - 1];
      if (last?.kind === 'item' && last.item.text.endsWith(':')) last.item.sub.push(point);
      else entries.push({ kind: 'item', item: { text: point, sub: [] } });
      return;
    }
    // A short line that opens a block and heads a numbered section names a group of sections.
    const next = lines.slice(index + 1).find(Boolean);
    const opensBlock = index === 0 || !lines[index - 1];
    if (opensBlock && next && SECTION_TITLE.test(next) && !/[.:;,]$/.test(line)) {
      openGroup(line);
      return;
    }
    currentSection().entries.push({ kind: 'item', item: { text: line, sub: [] } });
  });
  return groups;
}
