import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { websiteChatSources } from '@/config/chatbot';
import { zeniCopyFor } from '@/config/chatbot-receptionist';
import { publicFaqs } from '@/config/public-faqs';
import { DEFAULT_PUBLIC_SYSTEM_SETTINGS } from '@/lib/system-settings-types';
import { createGeminiComposer } from '@/services/chatbot/gemini';
import { createLlmRateGuard } from '@/services/chatbot/llm-rate-guard';
import type { ZeniTurnDependencies } from '@/services/chatbot/receptionist';
import { createConversation } from './conversation';
import { faqChatSource, officialFaqSources } from './faq-sources';
import { ZENI_SYSTEM_INSTRUCTIONS } from './llm-prompt';
import { claimsUnpublishedRule, validateSideReply } from './llm-validation';
import { planReceptionistTurn } from './receptionist';
import type { ChatSource } from './types';

/**
 * Zeni's test set for unusual, playful, unrelated and rude messages (docs/chatbot.md, "Unusual and
 * unrelated questions"): it always replies to what the guest asked, never with only the topics.
 */
const NOW = new Date('2099-01-01T00:00:00Z');
/** The published website and the official FAQ: no rule about pets, fireworks or drones. */
const published: ChatSource[] = [...websiteChatSources, ...officialFaqSources()];
/** The live loader adds the older built-in FAQ list while no staff-managed FAQ exists. */
const withBuiltInList: ChatSource[] = [
  ...published,
  ...publicFaqs.map((faq) => faqChatSource(faq)),
];
const english = zeniCopyFor('en');
const filipino = zeniCopyFor('fil');

const EXAMPLES = {
  dinosaur:
    'A real dinosaur might not fit in our garden! If you mean dinosaur-themed decorations or costumes for a kids’ party, that’s a fun theme. Our team can confirm which props and decorations are allowed. Want me to connect you?',
  dog: 'Wala pa po akong hawak na policy tungkol sa pagdadala ng alagang hayop. Gusto n’yo po bang i-connect ko kayo sa team namin para makumpirma?',
  japan:
    'That’s outside what I can help with. I’m Zion’s event concierge, so I can help with packages, dates, the venue and bookings.',
};

function ask(question: string, sources: ChatSource[] = published) {
  const state = createConversation(randomUUID(), NOW);
  return planReceptionistTurn(state, { question, turnId: randomUUID() }, sources, NOW);
}

const staffOffered = (plan: ReturnType<typeof ask>) =>
  plan.reply.actions?.some((item) => item.type === 'request_human');

test('backup mode: each kind of message gets a reply to what it asked', () => {
  // "can i bring dinosaur?" was four words, so it got only the topic menu and was never logged.
  const dinosaur = ask('can i bring dinosaur?');
  assert.equal(dinosaur.reply.message, english.notSure);
  assert.notEqual(dinosaur.reply.message, english.unclear);
  assert.ok(staffOffered(dinosaur));
  assert.ok(dinosaur.reply.suggestions.includes('Payments & booking'));
  assert.equal(dinosaur.gap?.reason, 'no_source');
  assert.equal(dinosaur.compose?.replyWhenUncovered, true);

  // An unusual event request with no published rule: honest, in the guest's language, logged.
  const dog = ask('Pwede ba magdala ng aso?');
  assert.equal(dog.reply.message, filipino.noRuleYet('pagdadala ng alagang hayop'));
  assert.equal(dog.reply.message, EXAMPLES.dog);
  assert.ok(staffOffered(dog));
  assert.equal(dog.gap?.reason, 'no_source');
  const fireworks = ask('Can I bring fireworks?');
  assert.equal(fireworks.reply.message, english.noRuleYet('fireworks or sparklers'));
  assert.equal(fireworks.gap?.reason, 'no_source');
  // A rule about generators says nothing about drones.
  const drones = ask('Can we fly drones over the garden?');
  assert.equal(drones.reply.message, english.noRuleYet('drones'));

  // A published rule that names the item is the answer ("Confetti, glitter … unless approved").
  const confetti = ask('Are confetti cannons allowed?');
  assert.equal(confetti.reply.kind, 'answer');
  assert.match(confetti.reply.message, /confetti/i);
  assert.equal(confetti.gap, undefined);
  // A question that only mentions an item is not a permission question, and a policy that only
  // mentions it is not a rule: no generator FAQ for the LED wall, no pet rule for a cleaning fee.
  assert.doesNotMatch(
    ask('Can the LED wall serve as our backdrop instead of a styled one?').reply.message,
    /generator/i,
  );
  assert.doesNotMatch(
    ask('Is there a cleaning fee if a dog has an accident on the lawn?', withBuiltInList).reply
      .message,
    /pets are welcome/i,
  );
  // So is the older built-in list's pet answer while it is in use (to confirm with Zion).
  const builtInDog = ask('Pwede ba magdala ng aso?', withBuiltInList);
  assert.equal(builtInDog.reply.kind, 'answer');
  assert.match(builtInDog.reply.message, /pets are welcome/i);

  // Unrelated: one polite sentence and what Zeni can help with; not an unanswered question.
  const japan = ask('What’s the capital of Japan?');
  assert.equal(japan.reply.message, EXAMPLES.japan);
  assert.equal(japan.gap, undefined);
  assert.equal(japan.compose, undefined);
  // Rude: calm, not engaged with, steered back; not logged.
  const rude = ask('you are so stupid');
  assert.equal(rude.reply.message, english.abuse);
  assert.equal(rude.gap, undefined);
});

test('AI mode: the model answers the actual message; unrelated and playful ones are not logged', async () => {
  // The pipeline's modules create database clients when loaded; preview mode never queries them.
  process.env.DATABASE_URL ??= 'postgresql://zeni-unit-test@127.0.0.1:1/unused';
  const { runReceptionistPipeline } = await import('@/services/chatbot/receptionist');
  const run = (question: string, compose: NonNullable<ZeniTurnDependencies['compose']>) =>
    runReceptionistPipeline(
      createConversation(randomUUID(), NOW),
      { question, turnId: randomUUID() },
      published,
      DEFAULT_PUBLIC_SYSTEM_SETTINGS,
      { preview: true, compose },
    );
  const model = 'gemini-test-flash';

  const dinosaur = await run('can i bring dinosaur?', async () => ({
    status: 'used',
    text: EXAMPLES.dinosaur,
    covered: false,
    general: false,
    aboutZion: true,
    used: [],
    scope: 'zion',
    model,
  }));
  assert.equal(dinosaur.reply.message, EXAMPLES.dinosaur);
  assert.ok(dinosaur.reply.actions?.some((item) => item.type === 'request_human'));
  assert.equal(dinosaur.gap?.reason, 'no_source');

  // A question the rules cannot place goes to the model, whose decline stands on its own.
  const painter = await run('Who painted the Mona Lisa?', async () => ({
    status: 'used',
    text: EXAMPLES.japan,
    covered: false,
    general: false,
    aboutZion: false,
    used: [],
    scope: 'unrelated',
    model,
  }));
  assert.equal(painter.reply.kind, 'scope');
  assert.equal(painter.reply.message, EXAMPLES.japan);
  assert.equal(painter.gap, undefined);
  assert.equal(painter.llm.reason, 'unrelated message');
  assert.ok(painter.reply.suggestions.includes('Payments & booking'));

  const playful = await run('Tell me something funny', async () => ({
    status: 'used',
    text: 'I’ll leave the jokes to your emcee! I can help with packages, dates and the venue.',
    covered: false,
    general: false,
    aboutZion: false,
    used: [],
    scope: 'playful',
    model,
  }));
  assert.equal(playful.reply.kind, 'scope');
  assert.equal(playful.gap, undefined);

  // With the model off, the backup reply still answers the message.
  const backup = await run('can i bring dinosaur?', async () => ({
    status: 'disabled',
    reason: 'no_key',
  }));
  assert.equal(backup.reply.message, english.notSure);
});

test('model replies to unusual or unrelated messages state no rule, number or link', async () => {
  for (const claim of [
    'Pets are allowed at Zion.',
    'You can bring your dog as long as it is leashed.',
    'We allow fireworks after 9 PM.',
    'Pwede po kayong magdala ng aso.',
    'Bawal po ang paputok sa venue.',
  ])
    assert.equal(claimsUnpublishedRule(claim), true, claim);
  for (const reply of Object.values(EXAMPLES))
    assert.equal(claimsUnpublishedRule(reply), false, reply);
  assert.deepEqual(validateSideReply(EXAMPLES.japan), { ok: true, text: EXAMPLES.japan });
  assert.equal(validateSideReply('Our packages start at 165,000.').ok, false);
  assert.equal(validateSideReply('See zion.ph for that.').ok, false);
  assert.equal(validateSideReply('Dogs are welcome at Zion!').ok, false);
  assert.match(ZENI_SYSTEM_INSTRUCTIONS, /"scope"/);
  assert.match(ZENI_SYSTEM_INSTRUCTIONS, /Never answer with only a list of topics/);

  // The Gemini client: a checked reply passes with its kind; a stated rule falls back to backup.
  const respond = (answer: unknown) => async () =>
    new Response(
      JSON.stringify({
        candidates: [
          { content: { parts: [{ text: JSON.stringify(answer) }] }, finishReason: 'STOP' },
        ],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  const compose = (answer: unknown) =>
    createGeminiComposer({
      env: { GEMINI_API_KEY: 'test-key-not-real', GEMINI_MODEL: 'gemini-test-flash' },
      fetch: respond(answer),
      guard: createLlmRateGuard({ perMinute: 10, perDay: 100 }),
      timeoutMs: 50,
      deadlineMs: 5000,
    })({ mode: 'answer', question: 'q', language: 'en', sources: [], recentTurns: [] });
  const unrelated = await compose({
    zion: EXAMPLES.japan,
    general: '',
    scope: 'unrelated',
    covered: false,
    aboutZion: false,
    used: [],
  });
  assert.equal(unrelated.status, 'used');
  assert.equal(unrelated.status === 'used' && unrelated.scope, 'unrelated');
  const invented = await compose({
    zion: 'Pets are allowed at Zion as long as they wear diapers.',
    general: '',
    scope: 'zion',
    covered: false,
    aboutZion: true,
    used: [],
  });
  assert.equal(invented.status, 'rejected');
  const numbered = await compose({
    zion: 'Haha! Our 3 halls are great.',
    general: '',
    scope: 'playful',
    covered: false,
    aboutZion: false,
    used: [],
  });
  assert.equal(numbered.status, 'rejected');
});
