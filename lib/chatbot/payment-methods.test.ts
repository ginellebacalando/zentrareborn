import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { websiteChatSources } from '@/config/chatbot';
import { publicFaqs } from '@/config/public-faqs';
import { createConversation } from './conversation';
import { faqChatSource, officialFaqSources } from './faq-sources';
import { paymentGuideSources } from './payment-methods';
import { planReceptionistTurn } from './receptionist';
import type { ChatSource } from './types';

const NOW = new Date('2099-01-01T00:00:00Z');
const ask = (question: string, sources: ChatSource[]) =>
  planReceptionistTurn(
    createConversation(randomUUID(), NOW),
    { question, turnId: randomUUID() },
    sources,
    NOW,
  );
/** The live loader's order: website, the payment guide from the system, then the FAQs. */
const withMethods = (methods: Parameters<typeof paymentGuideSources>[0]) => [
  ...websiteChatSources,
  ...paymentGuideSources(methods),
  ...officialFaqSources(),
  ...publicFaqs.map((faq) => faqChatSource(faq)),
];

test('payment methods come from what the booking system offers now', () => {
  const all = ask(
    'ano mga possible mode of payment?',
    withMethods(['GCASH', 'BANK_TRANSFER', 'CASH']),
  );
  assert.equal(all.reply.kind, 'answer');
  assert.match(all.reply.message, /^You can pay by bank transfer, GCash and cash at the venue\./);
  assert.deepEqual(
    all.reply.sources.map((source) => source.title),
    ['Which payment methods does Zion accept?'],
  );
  // Only cash while no online account is set up in Settings.
  const cash = ask('Do you accept GCash?', withMethods(['CASH']));
  assert.match(cash.reply.message, /^You can pay by cash at the venue\./);
  assert.doesNotMatch(cash.reply.message, /GCash/);
  // Without the system's list, the older conflicting list still goes to staff (unchanged).
  const older = ask('What are your modes of payment?', [
    ...websiteChatSources,
    ...officialFaqSources(),
    ...publicFaqs.map((faq) => faqChatSource(faq)),
  ]);
  assert.equal(older.gap?.reason, 'conflict');
});

test('the payment guide answers where and how to pay, the proof, cash, the account and receipts', () => {
  const sources = withMethods(['GCASH', 'BANK_TRANSFER', 'CASH']);
  const where = 'Where and how do I pay?';
  const proof = 'Where do I send my proof of payment?';
  const cash = 'Can I pay in cash, and where?';
  const account = 'bank and GCash account details for payments';
  const receipt = 'Do I get a receipt for each payment?';
  const cases: [string, string][] = [
    ['Where can I pay?', where],
    ['Saan pwede magbayad?', where],
    ['How can I pay?', where],
    ['Saan ko po ipapadala ang bayad?', where],
    ['I lost the private payment link from the email. Can you send it again?', where],
    ['Can I pay in cash?', cash],
    ['Pwede ba magbayad ng cash? Saan?', cash],
    ['Can I pay in person at the venue?', cash],
    ['Where do I send my proof of payment?', proof],
    ['Saan ko isesend yung proof of payment?', proof],
    ['Paano mag-upload ng screenshot ng bayad?', proof],
    ['paano mag send ng ss ng gcash', proof],
    ['What is your bank account number?', account],
    ['Ano GCash number niyo?', account],
    ['Will I get a receipt for every payment I make?', receipt],
    // The accepted methods keep their own answer.
    ['What are your modes of payment?', 'Which payment methods does Zion accept?'],
    ['How do I pay by bank transfer?', 'Which payment methods does Zion accept?'],
  ];
  for (const [question, title] of cases) {
    const turn = ask(question, sources);
    assert.equal(turn.reply.kind, 'answer', question);
    assert.equal(turn.reply.sources[0]?.title, title, question);
  }
  // A client asking where to pay or send a receipt gets their payment page, in their language.
  const asked = ask('Where do I send my proof of payment?', sources);
  assert.deepEqual(
    asked.reply.links?.map((link) => [link.label, link.href]),
    [['Find my payment page', '/booking/pay']],
  );
  assert.match(asked.reply.message, /upload/i);
  assert.equal(
    ask('Saan ko isesend yung proof of payment?', sources).reply.links?.[0]?.label,
    'Hanapin ang payment page ko',
  );
  // Zion's account numbers stay on the private payment page; Zeni only says where they are.
  const details = ask('What is your GCash number?', sources);
  assert.match(details.reply.message, /private payment page/);
  for (const source of paymentGuideSources(['GCASH', 'BANK_TRANSFER', 'CASH']))
    assert.doesNotMatch(source.text.replace(/82MH\+QPG|4023/g, ''), /\d{5,}/, source.title);
  // Only questions about paying use the guide: the location and the payment schedule keep theirs.
  assert.equal(
    ask('Where are you located?', sources).reply.sources[0]?.title,
    'Where are you located?',
  );
  assert.equal(
    ask('When is the full payment due?', sources).reply.sources[0]?.title,
    'When are our payments due?',
  );
});

test('with cash only, the payment guide never mentions GCash or a bank', () => {
  const guide = paymentGuideSources(['CASH']);
  assert.deepEqual(
    guide.map((source) => source.id),
    [
      'system-payment-methods',
      'system-payment-where',
      'system-payment-receipt',
      'system-payment-cash',
    ],
  );
  for (const source of guide) assert.doesNotMatch(source.text, /gcash|bank/i, source.title);
  assert.equal(
    ask('Can I pay in cash?', withMethods(['CASH'])).reply.sources[0]?.title,
    'Can I pay in cash, and where?',
  );
});

test('Zeni says what ZENTRA is', () => {
  for (const question of ['saan tungkol yung zentra?', 'What is ZENTRA?', 'ano ang zentra'])
    assert.match(
      ask(question, websiteChatSources).reply.message,
      /^ZENTRA is the website and booking system of Zion Events Place/,
      question,
    );
});
