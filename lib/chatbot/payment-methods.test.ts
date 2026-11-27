import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { websiteChatSources } from '@/config/chatbot';
import { publicFaqs } from '@/config/public-faqs';
import { createConversation } from './conversation';
import { faqChatSource, officialFaqSources } from './faq-sources';
import { paymentMethodsSource } from './payment-methods';
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
/** The live loader's order: website, the system's payment methods, then the FAQs. */
const withMethods = (methods: Parameters<typeof paymentMethodsSource>[0]) => [
  ...websiteChatSources,
  ...[paymentMethodsSource(methods)].filter((source): source is ChatSource => source !== null),
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

test('Zeni says what ZENTRA is', () => {
  for (const question of ['saan tungkol yung zentra?', 'What is ZENTRA?', 'ano ang zentra'])
    assert.match(
      ask(question, websiteChatSources).reply.message,
      /^ZENTRA is the website and booking system of Zion Events Place/,
      question,
    );
});
