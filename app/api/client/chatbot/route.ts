import { getPublicSystemSettings } from '@/lib/system-settings';
import { randomUUID } from 'node:crypto';
import { zeniCopyFor } from '@/config/chatbot-receptionist';
import {
  ChatRequestError,
  createChatBudget,
  readChatRequest,
  requireChatOrigin,
} from '@/lib/chatbot/request';
import {
  ConversationError,
  hashSession,
  sessionCookie,
  sessionToken,
} from '@/lib/chatbot/session-security';
import { conversationSummary, operationalSnapshot } from '@/lib/chatbot/conversation';
import { containsSensitiveDetails } from '@/lib/chatbot/intent';
import { detectLanguage, type ZeniLanguage } from '@/lib/chatbot/language';
import type { ChatReply, ChatSource } from '@/lib/chatbot/types';
import { visitorSources } from '@/services/chatbot/sources';
import {
  ensureConversation,
  eraseConversation,
  findConversation,
  runConversationTurn,
  type ConversationSession,
} from '@/services/chatbot/state-store';
import { executeReceptionistTurn } from '@/services/chatbot/receptionist';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const consumeBudget = createChatBudget();
const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };

function failure(error: unknown, session?: ConversationSession, language: ZeniLanguage = 'en') {
  const copy = zeniCopyFor(language);
  const responseHeaders = {
    ...headers,
    ...(session?.created ? { 'Set-Cookie': sessionCookie(session.token) } : {}),
  };
  if (error instanceof ChatRequestError || error instanceof ConversationError)
    return Response.json(
      {
        error: error.code ? copy.errors[error.code] : error.message,
        refresh: error.status === 409,
      },
      {
        status: error.status,
        headers: { ...responseHeaders, ...(error.status === 429 ? { 'Retry-After': '60' } : {}) },
      },
    );
  console.error('[zeni] The conversation service is unavailable.');
  return Response.json(
    { error: copy.errors.unavailable },
    { status: 503, headers: responseHeaders },
  );
}

/** Evidence shown to the visitor must still match the currently published source text. */
function currentEvidence(reply: ChatReply, sources: ChatSource[]): ChatReply {
  const valid = reply.sources.every((item) =>
    sources.some(
      (source) =>
        source.title === item.title &&
        source.href === item.href &&
        (source.text === item.excerpt ||
          source.text.startsWith(item.excerpt.split('… Read the full source')[0])),
    ),
  );
  if (valid) return reply;
  const copy = zeniCopyFor(reply.language);
  return {
    kind: 'handoff',
    message: copy.knowledgeConflict,
    sources: [],
    suggestions: [],
    actions: [{ type: 'request_human', label: copy.labels.talkToStaff }],
    language: reply.language,
    context: reply.context,
  };
}

export async function POST(request: Request) {
  let session: ConversationSession | undefined;
  let language: ZeniLanguage = 'en';
  try {
    const input = await readChatRequest(request);
    language = detectLanguage(input.question);
    consumeBudget();
    const settings = await getPublicSystemSettings();
    if (settings.client.maintenanceMode)
      return Response.json({ error: settings.client.disabledMessage }, { status: 503, headers });
    const sources = await visitorSources(settings);
    session = await ensureConversation(request);
    // Recovery records must never retain attempted credentials, even during a crashed turn.
    const withheld = containsSensitiveDetails(input.question);
    const command = {
      question: withheld ? 'Sensitive detail withheld: password.' : input.question,
      turnId: input.turnId ?? randomUUID(),
      action: withheld ? undefined : input.action,
    };
    const result = await runConversationTurn(
      session,
      {
        turnId: command.turnId,
        fingerprint: hashSession(
          JSON.stringify({ question: command.question, action: command.action }),
        ),
        expectedRevision: input.expectedRevision,
        recovery: command,
      },
      (state) => executeReceptionistTurn(state, command, sources, settings),
    );
    return Response.json(currentEvidence(result, sources), {
      headers: {
        ...headers,
        ...(session.created ? { 'Set-Cookie': sessionCookie(session.token) } : {}),
      },
    });
  } catch (error) {
    return failure(error, session, language);
  }
}

export async function GET(request: Request) {
  try {
    if (
      request.headers.get('sec-fetch-site') === 'cross-site' ||
      (request.headers.has('origin') &&
        request.headers.get('origin') !== new URL(request.url).origin)
    )
      throw new ChatRequestError('Please use Zeni on the Zion website.', 403, 'origin');
    const saved = await findConversation(request);
    if (!saved)
      return Response.json(
        { reply: null },
        {
          headers: {
            ...headers,
            ...(sessionToken(request) ? { 'Set-Cookie': sessionCookie('', 0) } : {}),
          },
        },
      );
    const state = saved.state;
    const copy = zeniCopyFor(state.client.language);
    const snapshot = operationalSnapshot(state);
    const reply: ChatReply = {
      kind: 'discovery',
      message: snapshot.stale
        ? `${copy.welcomeBack(state.client.name || undefined)} ${copy.staleResult}`
        : copy.welcomeBack(state.client.name || undefined),
      sources: [],
      suggestions: copy.suggestions.welcome,
      language: state.client.language,
      context: conversationSummary(state),
      actions: snapshot.stale
        ? [
            {
              type: 'check_availability',
              label: copy.labels.checkAnotherDate,
              ...(state.booking.dates[0] ? { value: state.booking.dates[0] } : {}),
            },
          ]
        : state.flags.needsHuman && state.awaiting
          ? [{ type: 'resume', label: copy.labels.continue }]
          : [],
    };
    return Response.json(
      { reply, ...(saved.pending ? { retry: saved.pending } : {}) },
      { headers },
    );
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(request: Request) {
  try {
    requireChatOrigin(request);
    consumeBudget();
    await eraseConversation(request);
    return Response.json(
      {
        message:
          'This conversation’s saved details were cleared. Existing bookings and submitted inquiries were not cancelled.',
      },
      { headers: { ...headers, 'Set-Cookie': sessionCookie('', 0) } },
    );
  } catch (error) {
    return failure(error);
  }
}
