import { getPublicSystemSettings } from '@/lib/system-settings';
import { randomUUID } from 'node:crypto';
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

function failure(error: unknown, session?: ConversationSession) {
  const responseHeaders = {
    ...headers,
    ...(session?.created ? { 'Set-Cookie': sessionCookie(session.token) } : {}),
  };
  if (error instanceof ChatRequestError || error instanceof ConversationError)
    return Response.json(
      { error: error.message, refresh: error.status === 409 },
      {
        status: error.status,
        headers: { ...responseHeaders, ...(error.status === 429 ? { 'Retry-After': '60' } : {}) },
      },
    );
  console.error('[receptionist] The conversation service is unavailable.');
  return Response.json(
    {
      error:
        'Zeni is temporarily unavailable. Your message has been kept below; please retry or contact the Zion team.',
    },
    { status: 503, headers: responseHeaders },
  );
}

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
  return valid
    ? reply
    : {
        kind: 'handoff',
        message:
          'The published information changed while this conversation was open. Please ask again for the current details or contact the team.',
        sources: [],
        suggestions: [],
        actions: [],
        context: reply.context,
      };
}

export async function POST(request: Request) {
  let session: ConversationSession | undefined;
  try {
    const input = await readChatRequest(request);
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
    return failure(error, session);
  }
}

export async function GET(request: Request) {
  try {
    if (
      request.headers.get('sec-fetch-site') === 'cross-site' ||
      (request.headers.has('origin') &&
        request.headers.get('origin') !== new URL(request.url).origin)
    )
      throw new ChatRequestError('Please use Zeni on the Zion website.', 403);
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
    const snapshot = operationalSnapshot(state);
    const staleAvailability = snapshot.stale && state.booking.intent === 'availability_check';
    const reply: ChatReply = {
      kind: 'discovery',
      message: snapshot.stale
        ? `Welcome back${state.client.name ? `, ${state.client.name}` : ''}. Your saved details are here, but the previous result needs a fresh check; this does not cancel any booking. ${staleAvailability ? 'Shall I check the schedule again?' : 'Would you like the Zion team to verify the current status?'}`
        : `Welcome back${state.client.name ? `, ${state.client.name}` : ''}. I have retained the details for this short-lived conversation; previous message bubbles are not restored. What would you like to continue?`,
      sources: [],
      suggestions: [],
      context: conversationSummary(state),
      actions: snapshot.stale
        ? [
            {
              type: staleAvailability ? 'check_availability' : 'request_human',
              label: staleAvailability ? 'Check the schedule again' : 'Ask the team to verify',
            },
          ]
        : state.flags.needsHuman
          ? [{ type: 'request_human', label: 'Ask the team' }]
          : state.booking.intent
            ? [{ type: 'resume', label: 'Continue my request' }]
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
