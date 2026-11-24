import { z } from 'zod';

export class ChatRequestError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

const input = z
  .object({
    question: z.string().trim().min(1).max(600),
    previousQuestion: z.string().trim().max(600).optional(),
    turnId: z.uuid().optional(),
    expectedRevision: z.number().int().nonnegative().optional(),
    action: z
      .object({
        type: z.enum([
          'start_booking',
          'check_availability',
          'select_package',
          'accept_terms',
          'confirm_handoff',
          'decline',
          'request_human',
          'confirm_escalation',
          'confirm_change',
          'resume',
        ]),
        value: z.string().max(180).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export function requireChatOrigin(request: Request) {
  if (
    request.headers.get('origin') !== new URL(request.url).origin ||
    request.headers.get('sec-fetch-site') === 'cross-site'
  ) {
    throw new ChatRequestError('Please use the chatbot on the Zion website.', 403);
  }
}

export async function readChatRequest(request: Request) {
  requireChatOrigin(request);
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') {
    throw new ChatRequestError('Send a JSON question.', 415);
  }
  const reader = request.body?.getReader();
  if (!reader) throw new ChatRequestError('Enter a question.');
  let body = '';
  let size = 0;
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) {
        await reader.cancel();
        throw new ChatRequestError('Your question is too long.', 413);
      }
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
  } finally {
    reader.releaseLock();
  }
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    throw new ChatRequestError('Send a valid question.');
  }
  const parsed = input.safeParse(json);
  if (!parsed.success) throw new ChatRequestError('Enter a question of 1–600 characters.', 422);
  return parsed.data;
}

// A bounded, process-local budget avoids accepting unlimited public database work.
// Deployments with multiple instances also need a shared ingress rate limit.
export function createChatBudget(limit = 120, windowMs = 60000) {
  let start = 0;
  let count = 0;
  return (now = Date.now()) => {
    if (now >= start + windowMs) {
      start = now;
      count = 0;
    }
    if (count >= limit)
      throw new ChatRequestError(
        'The assistant is busy. Please try again in a minute or contact the team.',
        429,
      );
    count += 1;
  };
}
