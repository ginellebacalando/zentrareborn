import { test } from 'node:test';
import assert from 'node:assert/strict';
import { termsData } from '@/config/terms';
import { defaultTerms } from './default-terms';
import {
  CONTRACT_FORMAT,
  contractBalance,
  readContractSnapshot,
  termsOutline,
  type ContractSnapshot,
} from './contract-document';
import { contractSignatoryProblem, DEFAULT_CONTRACT_SIGNATORY } from './preferences-types';

/**
 * The printed contract (docs/admin-panel.md, "Contracts"): the snapshot read back from a contract
 * body, the money it shows, and the venue policy's terms laid out as headings and clauses.
 */

const snapshot: ContractSnapshot = {
  format: CONTRACT_FORMAT,
  reference: 'ZEP-2026-0001',
  version: 1,
  preparedAt: '2026-11-27T02:00:00.000Z',
  client: { name: 'Test Client', email: 'client@example.test', phone: '09171234567' },
  event: {
    type: 'Wedding',
    venue: 'Pavilion Garden',
    startsAt: '2027-02-13T08:00:00.000Z',
    endsAt: '2027-02-13T14:00:00.000Z',
    guests: 100,
  },
  package: {
    name: 'Zion Classic (100 guests)',
    inclusions: [{ title: 'Venue', items: ['Pavilion Garden', 'Back-up generator'] }],
    paxIncluded: 100,
    excessPaxFeeCents: 95_000,
    checkIn: '10 AM',
    checkOut: '12 MN',
  },
  amounts: {
    totalCents: 22_500_000,
    reservationFeeCents: 3_000_000,
    balanceDueAt: '2027-01-30T15:59:59.999Z',
  },
  payments: [
    {
      acknowledgmentNumber: 'ACK-2026-000001',
      receiptNumber: 'OR-1',
      receivedAt: '2026-11-20T03:00:00.000Z',
      method: 'BANK_TRANSFER',
      amountCents: 3_000_000,
    },
  ],
  terms: { policyVersion: 2, text: 'Terms' },
  signatory: { ...DEFAULT_CONTRACT_SIGNATORY },
};

test('a contract body reads back as its snapshot; older text bodies stay text', () => {
  assert.deepEqual(readContractSnapshot(JSON.stringify(snapshot)), snapshot);
  assert.equal(readContractSnapshot('ZION EVENTS PLACE\nEVENT SERVICE AGREEMENT'), null);
  assert.equal(readContractSnapshot('{"format":"something-else"}'), null);
  assert.equal(readContractSnapshot('{not json'), null);
});

test('the contract shows what was paid and what is still owed', () => {
  assert.deepEqual(contractBalance(snapshot), { paidCents: 3_000_000, balanceCents: 19_500_000 });
  const overpaid = {
    ...snapshot,
    payments: [{ ...snapshot.payments[0], amountCents: 23_000_000 }],
  };
  assert.equal(contractBalance(overpaid).balanceCents, 0);
});

test("Zion's policy text becomes groups, numbered clauses and the points they list", () => {
  // The text a new venue policy starts from, and a contract's fallback.
  const outline = termsOutline(defaultTerms);
  assert.deepEqual(
    outline.map((group) => group.title),
    termsData.map((group) => group.category),
  );
  assert.deepEqual(
    outline.flatMap((group) => group.sections.map((section) => section.title)),
    termsData.flatMap((group) => group.sections.map((section) => section.title)),
  );
  const payment = outline[0].sections[0];
  const fee = payment.entries[0];
  assert.equal(fee.kind, 'item');
  assert.ok(fee.kind === 'item' && fee.item.text.endsWith('as follows:'));
  // The reservation fees list under the clause that introduces them.
  assert.ok(
    fee.kind === 'item' && fee.item.sub.length === 3 && fee.item.sub[0].startsWith('Classic'),
  );
  // "**…**" is a sub-heading, and the points after it stand on their own.
  const photo = outline.at(-1)!.sections.at(-1)!;
  const noteIndex = photo.entries.findIndex((entry) => entry.kind === 'note');
  assert.ok(noteIndex > 0);
  assert.equal(photo.entries[noteIndex + 1].kind, 'item');
});

test('terms written another way still read in order, one clause per line', () => {
  const outline = termsOutline('Pay on time.\nKeep the venue clean.\n\n• Bring your own towels.');
  assert.equal(outline.length, 1);
  assert.equal(outline[0].title, null);
  assert.deepEqual(
    outline[0].sections[0].entries.map((entry) => (entry.kind === 'item' ? entry.item.text : '')),
    ['Pay on time.', 'Keep the venue clean.', 'Bring your own towels.'],
  );
});

test('a contract signatory needs a name; the title may be empty', () => {
  assert.equal(contractSignatoryProblem({ name: 'Ana Cruz', title: '' }), null);
  assert.match(contractSignatoryProblem({ name: 'A', title: 'Manager' }) ?? '', /name/);
  assert.match(
    contractSignatoryProblem({ name: 'Ana Cruz', title: 'x'.repeat(81) }) ?? '',
    /title/,
  );
});
