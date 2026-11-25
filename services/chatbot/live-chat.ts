import 'server-only';

import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { zeniCopyFor } from '@/config/chatbot-receptionist';
import type { ReceptionistConversation } from '@/lib/chatbot/conversation';
import type { ZeniLanguage } from '@/lib/chatbot/language';
import {
  LIVE_CHAT_RULES,
  cleanLiveMessage,
  staffFirstName,
  type LiveChatStatus,
  type LiveMessage,
  type LiveSender,
  type StaffLiveChat,
  type StaffLiveChatDetail,
  type StaffLiveOverview,
  type VisitorLiveChat,
} from '@/lib/chatbot/live-chat';
import { receptionistPool } from './state-store';

/** Raised for requests the visitor or staff member can fix; carries an HTTP status. */
export class LiveChatError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = 'LiveChatError';
  }
}

export type LiveStaff = { id: string; fullName: string | null; username: string };

type ChatRow = {
  id: string;
  conversation_id: string;
  status: LiveChatStatus;
  visitor_name: string;
  language: string;
  summary: string;
  staff_user_id: string | null;
  staff_name: string | null;
  outcome: string;
  created_at: Date;
  claimed_at: Date | null;
  ended_at: Date | null;
  last_message_at: Date;
  last_message?: string | null;
};

type MessageRow = {
  id: string;
  sender: LiveSender;
  author: string;
  body: string;
  created_at: Date;
};

const LANGUAGES: readonly ZeniLanguage[] = ['en', 'fil', 'taglish'];

function chatLanguage(value: string): ZeniLanguage {
  return LANGUAGES.includes(value as ZeniLanguage) ? (value as ZeniLanguage) : 'en';
}

/** System messages follow the language the visitor was using with Zeni. */
function copyFor(language: string) {
  return zeniCopyFor(chatLanguage(language)).live;
}

function toMessage(row: MessageRow): LiveMessage {
  return {
    id: String(row.id),
    sender: row.sender,
    author: row.author,
    body: row.body,
    at: row.created_at.toISOString(),
  };
}

function toStaffChat(row: ChatRow): StaffLiveChat {
  return {
    id: row.id,
    status: row.status,
    visitorName: row.visitor_name,
    language: row.language,
    summary: row.summary,
    staffUserId: row.staff_user_id,
    staffName: row.staff_name,
    outcome: row.outcome,
    createdAt: row.created_at.toISOString(),
    claimedAt: row.claimed_at?.toISOString() ?? null,
    endedAt: row.ended_at?.toISOString() ?? null,
    lastMessageAt: row.last_message_at.toISOString(),
    lastMessage: (row.last_message ?? '').slice(0, 140),
  };
}

async function withClient<T>(work: (client: PoolClient) => Promise<T>) {
  const client = await receptionistPool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function addMessage(
  client: PoolClient,
  chatId: string,
  sender: LiveSender,
  author: string,
  body: string,
) {
  const { rows } = await client.query<MessageRow>(
    'INSERT INTO zion_live_chat_messages (chat_id, sender, author, body) VALUES ($1,$2,$3,$4) RETURNING id, sender, author, body, created_at',
    [chatId, sender, author, body],
  );
  await client.query('UPDATE zion_live_chats SET last_message_at=now() WHERE id=$1', [chatId]);
  return toMessage(rows[0]);
}

/**
 * Ends chats nobody took in time (MISSED) and quiet active chats (back to Zeni). Runs before
 * every read, so no scheduler is needed; each ended chat gets one system message.
 */
async function expireStaleChats() {
  await withClient(async (client) => {
    const missed = await client.query<ChatRow>(
      `UPDATE zion_live_chats SET status='MISSED', ended_at=now()
       WHERE status='WAITING' AND created_at < now() - make_interval(mins => $1)
       RETURNING id, language`,
      [LIVE_CHAT_RULES.waitLimitMinutes],
    );
    for (const chat of missed.rows)
      await addMessage(client, chat.id, 'SYSTEM', '', copyFor(chat.language).missed);
    const idle = await client.query<ChatRow>(
      `UPDATE zion_live_chats SET status='RETURNED', ended_at=now(),
         outcome=CASE WHEN outcome='' THEN 'Returned to Zeni after a quiet period.' ELSE outcome END
       WHERE status='ACTIVE' AND last_message_at < now() - make_interval(mins => $1)
       RETURNING id, language`,
      [LIVE_CHAT_RULES.idleLimitMinutes],
    );
    for (const chat of idle.rows)
      await addMessage(client, chat.id, 'SYSTEM', '', copyFor(chat.language).idle);
  });
}

/** Staff members who switched on live chat and still have the admin page open. */
export async function liveStaffOnline() {
  const { rows } = await receptionistPool.query<{ count: string }>(
    `SELECT count(*) FROM zion_live_chat_staff
     WHERE available AND last_seen_at > now() - make_interval(secs => $1)`,
    [LIVE_CHAT_RULES.presenceSeconds],
  );
  return Number(rows[0]?.count ?? 0);
}

/**
 * True when this conversation's last chat was missed in the past few minutes. Asking again then
 * goes to the email hand-off instead of putting the visitor back in a queue nobody answered.
 */
export async function recentlyMissedLiveChat(conversationId: string) {
  const { rows } = await receptionistPool.query<{ missed: boolean }>(
    `SELECT status='MISSED' AND ended_at > now() - $2::int * interval '1 minute' AS missed
     FROM zion_live_chats WHERE conversation_id=$1 ORDER BY last_message_at DESC, created_at DESC LIMIT 1`,
    [conversationId, LIVE_CHAT_RULES.recentMinutes],
  );
  return Boolean(rows[0]?.missed);
}

/** What staff should know before replying: what the visitor already told Zeni. */
function conversationSummary(state: ReceptionistConversation) {
  return [
    state.needs.goal && `Goal: ${state.needs.goal}`,
    state.booking.eventType && `Event: ${state.booking.eventType}`,
    state.booking.dates.length && `Dates: ${state.booking.dates.join(', ')}`,
    state.booking.timePreference && `Time: ${state.booking.timePreference}`,
    state.booking.guests && `Guests: ${state.booking.guests}`,
    state.booking.packageName && `Package discussed: ${state.booking.packageName}`,
    state.booking.venue && `Venue: ${state.booking.venue}`,
    state.lastKnowledgeQuestion && `Last question to Zeni: ${state.lastKnowledgeQuestion}`,
    state.objections.length && `Concerns: ${state.objections.join(', ')}`,
  ]
    .filter(Boolean)
    .join('\n')
    .slice(0, 2000);
}

/**
 * Puts the conversation in the staff queue, or returns its open chat if it already has one.
 * The visitor's own words and Zeni's notes stay in Zeni's encrypted memory; staff see only the
 * short summary above, plus what is typed in the live chat itself.
 */
export async function openLiveChat(state: ReceptionistConversation) {
  return withClient(async (client) => {
    const existing = await client.query<{ id: string }>(
      "SELECT id FROM zion_live_chats WHERE conversation_id=$1 AND status IN ('WAITING','ACTIVE')",
      [state.id],
    );
    if (existing.rows[0]) return existing.rows[0].id;
    const id = randomUUID();
    const language = chatLanguage(state.client.language);
    await client.query(
      'INSERT INTO zion_live_chats (id, conversation_id, visitor_name, language, summary) VALUES ($1,$2,$3,$4,$5)',
      [id, state.id, (state.client.name || '').slice(0, 100), language, conversationSummary(state)],
    );
    await addMessage(client, id, 'SYSTEM', '', copyFor(language).waiting);
    return id;
  });
}

/** The conversation's open chat, or one that ended recently enough to still show the visitor. */
async function latestChatFor(conversationId: string) {
  const { rows } = await receptionistPool.query<ChatRow>(
    `SELECT * FROM zion_live_chats WHERE conversation_id=$1
       AND (status IN ('WAITING','ACTIVE') OR ended_at > now() - $2::int * interval '1 minute')
     ORDER BY last_message_at DESC, created_at DESC LIMIT 1`,
    [conversationId, LIVE_CHAT_RULES.recentMinutes],
  );
  return rows[0] ?? null;
}

async function queuePosition(chat: ChatRow) {
  if (chat.status !== 'WAITING') return null;
  const { rows } = await receptionistPool.query<{ count: string }>(
    "SELECT count(*) FROM zion_live_chats WHERE status='WAITING' AND created_at <= $1",
    [chat.created_at],
  );
  return Number(rows[0]?.count ?? 1);
}

async function messagesAfter(chatId: string, afterId: string | null) {
  const after = afterId && /^\d+$/.test(afterId) ? afterId : '0';
  const { rows } = await receptionistPool.query<MessageRow>(
    'SELECT id, sender, author, body, created_at FROM zion_live_chat_messages WHERE chat_id=$1 AND id > $2 ORDER BY id LIMIT 200',
    [chatId, after],
  );
  return rows.map(toMessage);
}

/** The visitor's view of their latest chat; null when there is none open or recently finished. */
export async function visitorLiveChat(
  conversationId: string,
  afterId: string | null,
): Promise<VisitorLiveChat | null> {
  await expireStaleChats();
  const chat = await latestChatFor(conversationId);
  if (!chat) return null;
  return {
    status: chat.status,
    staffName: chat.staff_name,
    position: await queuePosition(chat),
    messages: await messagesAfter(chat.id, afterId),
  };
}

export async function sendVisitorMessage(conversationId: string, text: string) {
  const body = cleanLiveMessage(text);
  if (!body) throw new LiveChatError('Please type a message.');
  return withClient(async (client) => {
    const { rows } = await client.query<ChatRow>(
      "SELECT * FROM zion_live_chats WHERE conversation_id=$1 AND status IN ('WAITING','ACTIVE') FOR UPDATE",
      [conversationId],
    );
    const chat = rows[0];
    if (!chat) throw new LiveChatError('This chat has ended. Zeni can help you from here.', 409);
    const recent = await client.query<{ count: string }>(
      "SELECT count(*) FROM zion_live_chat_messages WHERE chat_id=$1 AND sender='VISITOR' AND created_at > now() - interval '1 minute'",
      [chat.id],
    );
    if (Number(recent.rows[0]?.count ?? 0) >= LIVE_CHAT_RULES.visitorMessagesPerMinute)
      throw new LiveChatError('You are sending messages very quickly. Please wait a moment.', 429);
    return addMessage(client, chat.id, 'VISITOR', chat.visitor_name, body);
  });
}

/** The visitor ends the chat; Zeni takes over again. */
export async function endVisitorChat(conversationId: string) {
  await withClient(async (client) => {
    const { rows } = await client.query<ChatRow>(
      `UPDATE zion_live_chats SET status='RETURNED', ended_at=now(),
         outcome=CASE WHEN outcome='' THEN 'The visitor ended the chat.' ELSE outcome END
       WHERE conversation_id=$1 AND status IN ('WAITING','ACTIVE') RETURNING id, language`,
      [conversationId],
    );
    for (const chat of rows)
      await addMessage(client, chat.id, 'SYSTEM', '', copyFor(chat.language).visitorEnded);
  });
}

/* ---------- Staff side ---------- */

function displayName(staff: LiveStaff) {
  return staffFirstName(staff.fullName || staff.username);
}

/** Switches live chat on or off for a staff member and refreshes their presence. */
export async function setStaffPresence(staff: LiveStaff, available: boolean | null) {
  await receptionistPool.query(
    `INSERT INTO zion_live_chat_staff (user_id, display_name, available, last_seen_at)
     VALUES ($1, $2, COALESCE($3, false), now())
     ON CONFLICT (user_id) DO UPDATE SET display_name=$2,
       available=COALESCE($3, zion_live_chat_staff.available), last_seen_at=now()`,
    [staff.id, displayName(staff), available],
  );
}

export async function staffLiveOverview(staff: LiveStaff): Promise<StaffLiveOverview> {
  await expireStaleChats();
  const withLast = `SELECT c.*, (SELECT m.body FROM zion_live_chat_messages m WHERE m.chat_id=c.id AND m.sender <> 'SYSTEM' ORDER BY m.id DESC LIMIT 1) AS last_message FROM zion_live_chats c`;
  const [open, recent, me, online] = await Promise.all([
    receptionistPool.query<ChatRow>(
      `${withLast} WHERE c.status IN ('WAITING','ACTIVE') ORDER BY c.created_at LIMIT 50`,
    ),
    receptionistPool.query<ChatRow>(
      `${withLast} WHERE c.status IN ('RETURNED','CLOSED','MISSED') AND c.created_at > now() - interval '7 days' ORDER BY c.created_at DESC LIMIT 20`,
    ),
    receptionistPool.query<{ available: boolean; fresh: boolean }>(
      `SELECT available, last_seen_at > now() - make_interval(secs => $2) AS fresh
       FROM zion_live_chat_staff WHERE user_id=$1`,
      [staff.id, LIVE_CHAT_RULES.presenceSeconds],
    ),
    liveStaffOnline(),
  ]);
  const chats = open.rows.map(toStaffChat);
  return {
    available: Boolean(me.rows[0]?.available && me.rows[0]?.fresh),
    staffOnline: online,
    waiting: chats.filter((chat) => chat.status === 'WAITING'),
    active: chats.filter((chat) => chat.status === 'ACTIVE'),
    recent: recent.rows.map(toStaffChat),
  };
}

/** Waiting chats only, for the admin badge that every admin page refreshes. */
export async function waitingLiveChats() {
  await expireStaleChats();
  const { rows } = await receptionistPool.query<{ count: string; newest: Date | null }>(
    "SELECT count(*), max(created_at) AS newest FROM zion_live_chats WHERE status='WAITING'",
  );
  return {
    waiting: Number(rows[0]?.count ?? 0),
    newest: rows[0]?.newest?.toISOString() ?? null,
  };
}

export async function staffLiveChat(
  chatId: string,
  afterId: string | null,
): Promise<StaffLiveChatDetail> {
  const { rows } = await receptionistPool.query<ChatRow>(
    'SELECT * FROM zion_live_chats WHERE id=$1',
    [chatId],
  );
  if (!rows[0]) throw new LiveChatError('This chat no longer exists.', 404);
  return { chat: toStaffChat(rows[0]), messages: await messagesAfter(chatId, afterId) };
}

/** Takes a waiting chat; only one staff member can win it. */
export async function claimLiveChat(chatId: string, staff: LiveStaff) {
  const name = displayName(staff);
  await withClient(async (client) => {
    const { rows } = await client.query<ChatRow>(
      `UPDATE zion_live_chats SET status='ACTIVE', staff_user_id=$2, staff_name=$3, claimed_at=now()
       WHERE id=$1 AND status='WAITING' RETURNING id, language`,
      [chatId, staff.id, name],
    );
    if (!rows[0])
      throw new LiveChatError('Another staff member already took this chat, or it ended.', 409);
    await addMessage(client, chatId, 'SYSTEM', '', copyFor(rows[0].language).joined(name));
  });
}

async function lockActiveChat(client: PoolClient, chatId: string, staff: LiveStaff) {
  const { rows } = await client.query<ChatRow>(
    'SELECT * FROM zion_live_chats WHERE id=$1 FOR UPDATE',
    [chatId],
  );
  const chat = rows[0];
  if (!chat) throw new LiveChatError('This chat no longer exists.', 404);
  if (chat.status !== 'ACTIVE') throw new LiveChatError('This chat is not active.', 409);
  if (chat.staff_user_id !== staff.id)
    throw new LiveChatError('Another staff member is handling this chat.', 403);
  return chat;
}

export async function sendStaffMessage(chatId: string, staff: LiveStaff, text: string) {
  const body = cleanLiveMessage(text);
  if (!body) throw new LiveChatError('Type a message first.');
  return withClient(async (client) => {
    const chat = await lockActiveChat(client, chatId, staff);
    return addMessage(client, chatId, 'STAFF', chat.staff_name ?? displayName(staff), body);
  });
}

/**
 * Ends the staff part of the chat. "return" hands the visitor back to Zeni (the normal ending);
 * "close" is for spam or abuse. The outcome note is for staff only.
 */
export async function finishLiveChat(
  chatId: string,
  staff: LiveStaff,
  how: 'return' | 'close',
  outcome: string,
) {
  await withClient(async (client) => {
    const chat = await lockActiveChat(client, chatId, staff);
    await client.query(
      'UPDATE zion_live_chats SET status=$2, ended_at=now(), outcome=$3 WHERE id=$1',
      [chatId, how === 'return' ? 'RETURNED' : 'CLOSED', outcome.trim().slice(0, 1000)],
    );
    const copy = copyFor(chat.language);
    await addMessage(
      client,
      chatId,
      'SYSTEM',
      '',
      how === 'return' ? copy.returned(chat.staff_name ?? displayName(staff)) : copy.closed,
    );
  });
}
