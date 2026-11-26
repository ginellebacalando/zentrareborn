import { ZodError, z } from 'zod';
import { AdminError, adminResponse, checkMutationOrigin, requireAdmin } from '@/lib/admin/access';
import { LIVE_CHAT_RULES } from '@/lib/chatbot/live-chat';
import {
  LiveChatError,
  claimLiveChat,
  finishLiveChat,
  sendStaffMessage,
  setStaffPresence,
  staffLiveChat,
  staffLiveOverview,
  waitingLiveChats,
} from '@/services/chatbot/live-chat';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BODY_LIMIT = 4000;
const chatId = z.uuid();
const mutation = z.discriminatedUnion('op', [
  z.object({ op: z.literal('presence'), available: z.boolean().nullable() }).strict(),
  z.object({ op: z.literal('claim'), id: chatId }).strict(),
  z
    .object({
      op: z.literal('send'),
      id: chatId,
      text: z.string().min(1).max(LIVE_CHAT_RULES.maxMessageLength),
    })
    .strict(),
  z
    .object({
      op: z.enum(['return', 'close']),
      id: chatId,
      outcome: z.string().max(1000).default(''),
    })
    .strict(),
]);

function failure(error: unknown) {
  if (error instanceof AdminError || error instanceof LiveChatError)
    return adminResponse({ error: error.message }, error.status);
  if (error instanceof ZodError)
    return adminResponse({ error: error.issues[0]?.message ?? 'Invalid request.' }, 400);
  console.error(
    '[live-chat] Admin live chat failed:',
    error instanceof Error ? error.name : 'unknown',
  );
  return adminResponse(
    {
      error:
        'Live chat is unavailable. Check the database connection and that prisma/live-chat.sql is installed.',
    },
    503,
  );
}

/**
 * ?view=count → waiting chats for the admin badge; ?chat=<id>&after=<messageId> → one chat;
 * otherwise the queue, active and recent chats. Reading also refreshes the staff member's presence.
 */
export async function GET(request: Request) {
  try {
    const actor = await requireAdmin({ page: 'live-chat' });
    const params = new URL(request.url).searchParams;
    // Every admin page checks the count, so an available staff member anywhere in the admin
    // stays counted as online.
    await setStaffPresence(actor, null);
    if (params.get('view') === 'count') return adminResponse(await waitingLiveChats());
    const id = params.get('chat');
    if (id) return adminResponse(await staffLiveChat(chatId.parse(id), params.get('after')));
    return adminResponse(await staffLiveOverview(actor));
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    checkMutationOrigin(request);
    const actor = await requireAdmin({ page: 'live-chat' });
    const body = await request.text();
    if (body.length > BODY_LIMIT) throw new AdminError('Request is too large.', 413);
    let raw: unknown;
    try {
      raw = JSON.parse(body);
    } catch {
      throw new AdminError('Invalid JSON.');
    }
    const input = mutation.parse(raw);
    if (input.op === 'presence') {
      await setStaffPresence(actor, input.available);
      return adminResponse(await staffLiveOverview(actor));
    }
    if (input.op === 'claim') {
      await setStaffPresence(actor, null);
      await claimLiveChat(input.id, actor);
      return adminResponse(await staffLiveChat(input.id, null));
    }
    if (input.op === 'send')
      return adminResponse({ message: await sendStaffMessage(input.id, actor, input.text) });
    await finishLiveChat(input.id, actor, input.op, input.outcome);
    return adminResponse(await staffLiveChat(input.id, null));
  } catch (error) {
    return failure(error);
  }
}
