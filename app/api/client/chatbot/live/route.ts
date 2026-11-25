import { ChatRequestError, createChatBudget, requireChatOrigin } from '@/lib/chatbot/request';
import { hashSession, sessionToken } from '@/lib/chatbot/session-security';
import {
  LiveChatError,
  endVisitorChat,
  sendVisitorMessage,
  visitorLiveChat,
} from '@/services/chatbot/live-chat';
import { receptionistPool } from '@/services/chatbot/state-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const BODY_LIMIT = 2000;
// Visitors' messages; reads are cheap polls and have their own per-chat checks.
const consumeSends = createChatBudget(240, 60_000);

/** The visitor's Zeni conversation, from the same session cookie Zeni uses. */
async function conversationId(request: Request) {
  const token = sessionToken(request);
  if (!token) return null;
  const { rows } = await receptionistPool.query<{ id: string }>(
    'SELECT id FROM zion_receptionist_conversations WHERE token_hash=$1 AND expires_at>now()',
    [hashSession(token)],
  );
  return rows[0]?.id ?? null;
}

function failure(error: unknown) {
  if (error instanceof LiveChatError || error instanceof ChatRequestError)
    return Response.json({ error: error.message }, { status: error.status, headers });
  console.error('[zeni] Live chat is unavailable.');
  return Response.json(
    { error: 'Live chat is unavailable right now. Please try again in a moment.' },
    { status: 503, headers },
  );
}

/** New live chat messages for the visitor's window (polled while the chat is open). */
export async function GET(request: Request) {
  try {
    const id = await conversationId(request);
    if (!id) return Response.json({ chat: null }, { headers });
    const after = new URL(request.url).searchParams.get('after');
    return Response.json({ chat: await visitorLiveChat(id, after) }, { headers });
  } catch (error) {
    return failure(error);
  }
}

/** A visitor message to the staff member in the chat. */
export async function POST(request: Request) {
  try {
    requireChatOrigin(request);
    consumeSends();
    const body = await request.text();
    if (body.length > BODY_LIMIT) throw new LiveChatError('Please keep your message shorter.', 413);
    let text: unknown;
    try {
      text = (JSON.parse(body) as { text?: unknown }).text;
    } catch {
      throw new LiveChatError('Please send your message as text.');
    }
    if (typeof text !== 'string') throw new LiveChatError('Please send your message as text.');
    const id = await conversationId(request);
    if (!id) throw new LiveChatError('This chat has ended. Zeni can help you from here.', 409);
    return Response.json({ message: await sendVisitorMessage(id, text) }, { headers });
  } catch (error) {
    return failure(error);
  }
}

/** The visitor ends the chat with staff; Zeni takes over again. */
export async function DELETE(request: Request) {
  try {
    requireChatOrigin(request);
    const id = await conversationId(request);
    if (id) await endVisitorChat(id);
    return Response.json({ ended: true }, { headers });
  } catch (error) {
    return failure(error);
  }
}
