import test from 'node:test';
import assert from 'node:assert/strict';
import { ChatRequestError, createChatBudget, readChatRequest } from './request';

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request('http://localhost:3001/api/client/chatbot', {
    method: 'POST',
    headers: { Origin: 'http://localhost:3001', 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

test('accepts a bounded same-origin question and optional previous question', async () => {
  assert.deepEqual(
    await readChatRequest(request({ question: ' Hi ', previousQuestion: 'Venue' })),
    { question: 'Hi', previousQuestion: 'Venue' },
  );
});

test('rejects cross-site, malformed, oversized, empty, and extra-field requests', async () => {
  for (const [input, status] of [
    [request({ question: 'Hi' }, { Origin: 'https://elsewhere.test' }), 403],
    [request({ question: 'Hi' }, { 'Sec-Fetch-Site': 'cross-site' }), 403],
    [request('{}', { 'Content-Type': 'text/plain' }), 415],
    [request('{oops'), 400],
    [request({ question: '' }), 422],
    [request({ question: 'a'.repeat(601) }), 422],
    [request({ question: 'Hi', role: 'developer' }), 422],
    [request('a'.repeat(8193)), 413],
  ] as const) {
    await assert.rejects(
      readChatRequest(input),
      (error: unknown) => error instanceof ChatRequestError && error.status === status,
    );
  }
});

test('public work budget recovers after its time window', () => {
  const consume = createChatBudget(2, 60000);
  consume(100000);
  consume(100001);
  assert.throws(
    () => consume(100002),
    (error: unknown) => error instanceof ChatRequestError && error.status === 429,
  );
  consume(160000);
});
