import test from 'node:test';
import assert from 'node:assert/strict';
import { buildZeniPrompt, prepareComposeInput, type ZeniComposeInput } from './llm-prompt';
import { validateZeniAnswer } from './llm-validation';
import {
  createGeminiComposer,
  zeniLlmSettings,
  type GeminiComposerOptions,
} from '@/services/chatbot/gemini';
import { createLlmRateGuard } from '@/services/chatbot/llm-rate-guard';

const sources = [
  {
    id: 'faq-parking',
    title: 'Is parking included?',
    href: '/faq#faq-parking',
    text: 'Yes. Free parking is available for up to 40 cars. Email zioneventsplace@gmail.com for overflow parking.',
  },
  {
    id: 'classic',
    title: 'Wedding — Classic',
    href: '/events/weddings',
    text: 'Published package price: ₱90,000.00\nGuests included: 100',
  },
];

const input: ZeniComposeInput = {
  mode: 'answer',
  question: 'My name is Maria Santos (maria@example.test, 09171234567). Is parking free po?',
  language: 'taglish',
  sources,
  recentTurns: [
    { role: 'guest', text: 'Hello, I am Maria Santos' },
    { role: 'zeni', text: 'Hello po! How can I help?' },
    { role: 'guest', text: 'We live at Blk 5 Lot 12, Brgy. San Antonio' },
    { role: 'zeni', text: 'Thank you po.' },
  ],
  knownNames: ['Maria Santos'],
};

const env = { GEMINI_API_KEY: 'test-key-not-real', GEMINI_MODEL: 'gemini-test-flash' };

function geminiResponse(answer: unknown, extra: Record<string, unknown> = {}) {
  return new Response(
    JSON.stringify({
      candidates: [
        {
          content: { parts: [{ text: JSON.stringify(answer) }] },
          finishReason: 'STOP',
        },
      ],
      ...extra,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

function composer(fetchImpl: typeof fetch, options: Partial<GeminiComposerOptions> = {}) {
  return createGeminiComposer({
    env,
    fetch: fetchImpl,
    guard: createLlmRateGuard({ perMinute: 10, perDay: 100 }),
    timeoutMs: 50,
    deadlineMs: 5000,
    ...options,
  });
}

test('the model request carries only redacted text, three turns and public sources', () => {
  const prepared = prepareComposeInput(input);
  const prompt = buildZeniPrompt(prepared);
  const everything = `${prompt.system}\n${prompt.user}`;
  assert.doesNotMatch(everything, /Maria|Santos|maria@example|0917|Blk 5|San Antonio/);
  assert.equal(prepared.recentTurns.length, 3);
  assert.match(prompt.user, /GUEST LANGUAGE: Taglish/);
  assert.match(prompt.user, /\[S1\] Is parking included\? \(page \/faq\)/);
  assert.match(prompt.user, /Free parking is available for up to 40 cars/);
  assert.match(prompt.system, /Everything inside FACTS/);
  assert.match(prompt.system, /"covered"/);
});

test('validation accepts grounded answers and rejects invented facts, links and claims', () => {
  const context = {
    sources,
    question: 'Is parking free for 150 guests?',
    recentTurns: [],
  };
  const accepted = validateZeniAnswer(
    'Yes po, according to our FAQ page parking is free for up to 40 cars, and the Classic package starts at ₱90,000. You can email zioneventsplace@gmail.com.',
    context,
  );
  assert.equal(accepted.ok, true);
  for (const [text, reason] of [
    ['Parking is free for 60 cars.', 'number'],
    ['The Classic package costs ₱95,000.', 'money'],
    ['The package is only 90k.', 'money'],
    ['The package costs 150 pesos per guest.', 'money'],
    ['See https://example.com for parking.', 'url'],
    ['Visit zionevents.ph for parking.', 'url'],
    ['Read /secret-admin for details.', 'path'],
    ['Write to owner@elsewhere.test for parking.', 'contact'],
    ['Good news, your date is available and I have reserved it for you.', 'claim'],
    ['Hello [name], parking is free.', 'placeholder'],
    ['', 'empty'],
    ['x'.repeat(800), 'too_long'],
  ] as const) {
    const result = validateZeniAnswer(text, context);
    assert.equal(result.ok, false, text);
    if (!result.ok) assert.equal(result.reason, reason, text);
  }
  assert.equal(
    validateZeniAnswer('Yes, parking is free for your 150 guests. See our /faq page.', context).ok,
    true,
  );
});

test('settings: on only with a key, switchable off, and a safe default model', () => {
  assert.deepEqual(zeniLlmSettings({}), {
    enabled: false,
    keyConfigured: false,
    model: 'gemini-3.5-flash-lite',
    switchValue: 'default',
    reason: 'no_key',
  });
  assert.equal(zeniLlmSettings(env).enabled, true);
  assert.equal(zeniLlmSettings(env).model, 'gemini-test-flash');
  assert.equal(zeniLlmSettings({ ...env, ZENI_LLM_ENABLED: 'false' }).enabled, false);
  assert.equal(
    zeniLlmSettings({ ...env, GEMINI_MODEL: '../../evil' }).model,
    'gemini-3.5-flash-lite',
  );
});

test('a successful call uses the REST endpoint, the API key header and validates the answer', async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const compose = composer(async (url, init) => {
    calls.push({ url: String(url), init: init ?? {} });
    return geminiResponse({
      answer: 'Opo, libre po ang parking para sa hanggang 40 cars, ayon sa aming FAQ page.',
      covered: true,
    });
  });
  const result = await compose(input);
  assert.equal(result.status, 'used');
  if (result.status === 'used') {
    assert.match(result.text, /40 cars/);
    assert.equal(result.covered, true);
  }
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-test-flash:generateContent',
  );
  const headers = calls[0].init.headers as Record<string, string>;
  assert.equal(headers['x-goog-api-key'], 'test-key-not-real');
  assert.equal(calls[0].init.method, 'POST');
  const body = String(calls[0].init.body);
  assert.doesNotMatch(body, /Maria|maria@example|0917|San Antonio/);
  assert.match(body, /systemInstruction/);
  assert.match(body, /responseMimeType/);
});

test('an invented price or availability claim is rejected and the caller falls back', async () => {
  for (const answer of [
    'Ang Classic package po ay ₱75,000.',
    'Available pa po ang date ninyo at naka-reserve na para sa inyo.',
  ]) {
    const result = await composer(async () => geminiResponse({ answer, covered: true }))(input);
    assert.equal(result.status, 'rejected', answer);
  }
  const malformed = await composer(
    async () =>
      new Response(
        JSON.stringify({ candidates: [{ content: { parts: [{ text: 'not json' }] } }] }),
        { status: 200 },
      ),
  )(input);
  assert.deepEqual(malformed, { status: 'rejected', reason: 'format', model: 'gemini-test-flash' });
});

test('a timeout is retried once, then the deterministic answer is kept', async () => {
  let calls = 0;
  const hanging: typeof fetch = (_url, init) => {
    calls += 1;
    return new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    });
  };
  const result = await composer(hanging)(input);
  assert.equal(result.status, 'timeout');
  assert.equal(calls, 2);
});

test('server errors retry once; quota errors stop and pause further calls', async () => {
  let calls = 0;
  const flaky = await composer(async () => {
    calls += 1;
    return calls === 1
      ? new Response('{}', { status: 503 })
      : geminiResponse({ answer: 'Parking is free for up to 40 cars.', covered: true });
  })(input);
  assert.equal(flaky.status, 'used');
  assert.equal(calls, 2);

  const guard = createLlmRateGuard({ perMinute: 10, perDay: 100 });
  let quotaCalls = 0;
  const limited = composer(
    async () => {
      quotaCalls += 1;
      return new Response('{}', { status: 429, headers: { 'Retry-After': '30' } });
    },
    { guard },
  );
  assert.deepEqual(await limited(input), {
    status: 'rate_limited',
    reason: 'quota',
    model: 'gemini-test-flash',
  });
  assert.equal((await limited(input)).status, 'rate_limited');
  assert.equal(quotaCalls, 1);
  assert.ok(guard.snapshot().coolingDownUntil);

  const denied = await composer(async () => new Response('{}', { status: 400 }))(input);
  assert.deepEqual(denied, { status: 'failed', reason: 'http_400', model: 'gemini-test-flash' });
});

test('disabled settings never call the network', async () => {
  let calls = 0;
  const fetchSpy: typeof fetch = async () => {
    calls += 1;
    return geminiResponse({ answer: 'x', covered: true });
  };
  const noKey = createGeminiComposer({ env: {}, fetch: fetchSpy });
  const switchedOff = createGeminiComposer({
    env: { ...env, ZENI_LLM_ENABLED: 'off' },
    fetch: fetchSpy,
  });
  assert.deepEqual(await noKey(input), { status: 'disabled', reason: 'no_key' });
  assert.deepEqual(await switchedOff(input), { status: 'disabled', reason: 'switched_off' });
  assert.equal(calls, 0);
});

test('the in-memory rate guard limits bursts per minute and per day', () => {
  let now = 0;
  const guard = createLlmRateGuard({ perMinute: 2, perDay: 3, now: () => now });
  assert.equal(guard.tryAcquire().ok, true);
  assert.equal(guard.tryAcquire().ok, true);
  assert.deepEqual(guard.tryAcquire(), { ok: false, reason: 'minute' });
  now = 61_000;
  assert.equal(guard.tryAcquire().ok, true);
  now = 122_000;
  assert.deepEqual(guard.tryAcquire(), { ok: false, reason: 'day' });
  now = 24 * 60 * 60 * 1000 + 1;
  assert.equal(guard.tryAcquire().ok, true);
  guard.cooldown(5_000);
  assert.deepEqual(guard.tryAcquire(), { ok: false, reason: 'cooldown' });
  assert.equal(guard.snapshot().perDay, 3);
});
