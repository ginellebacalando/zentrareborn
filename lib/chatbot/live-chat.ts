/**
 * Live chat between a website visitor and Zion staff (client-safe types and pure helpers). Zeni
 * opens a chat when the visitor asks for a person while staff are available; staff take it in the
 * admin and hand the visitor back to Zeni when they are done.
 */
export const LIVE_CHAT_STATUSES = ['WAITING', 'ACTIVE', 'RETURNED', 'CLOSED', 'MISSED'] as const;
export type LiveChatStatus = (typeof LIVE_CHAT_STATUSES)[number];
export type LiveSender = 'VISITOR' | 'STAFF' | 'SYSTEM';

export const LIVE_CHAT_RULES = {
  maxMessageLength: 600,
  /** A waiting chat nobody takes in this time is marked missed and goes back to Zeni. */
  waitLimitMinutes: 5,
  /** An active chat with no message for this long returns to Zeni. */
  idleLimitMinutes: 20,
  /**
   * A finished chat stays in the visitor's window for this long, and asking for staff again within
   * this time after a missed chat goes to the email hand-off instead of the same unanswered queue.
   */
  recentMinutes: 15,
  /** A staff member counts as available while the admin page keeps refreshing within this. */
  presenceSeconds: 90,
  visitorMessagesPerMinute: 12,
  /** How often the visitor's window and the admin page ask for new messages. */
  pollMs: 3000,
} as const;

export type LiveMessage = {
  id: string;
  sender: LiveSender;
  author: string;
  body: string;
  at: string;
};

/** What the visitor's chat window shows; only the staff member's first name is shared. */
export type VisitorLiveChat = {
  status: LiveChatStatus;
  staffName: string | null;
  /** 1 when this chat is next in line; null once a staff member joined. */
  position: number | null;
  messages: LiveMessage[];
};

export type StaffLiveChat = {
  id: string;
  status: LiveChatStatus;
  visitorName: string;
  language: string;
  summary: string;
  staffUserId: string | null;
  staffName: string | null;
  outcome: string;
  createdAt: string;
  claimedAt: string | null;
  endedAt: string | null;
  lastMessageAt: string;
  lastMessage: string;
};

export type StaffLiveOverview = {
  available: boolean;
  staffOnline: number;
  waiting: StaffLiveChat[];
  active: StaffLiveChat[];
  recent: StaffLiveChat[];
};

export type StaffLiveChatDetail = { chat: StaffLiveChat; messages: LiveMessage[] };

export function isOpenLiveChat(status: LiveChatStatus) {
  return status === 'WAITING' || status === 'ACTIVE';
}

/** The first name a visitor sees for a staff member ("Maria", never a full name or email). */
export function staffFirstName(fullName: string | null | undefined, fallback = 'Zion staff') {
  const first = (fullName ?? '').trim().split(/\s+/)[0] ?? '';
  return /^[\p{L}][\p{L}'’.-]{0,39}$/u.test(first) ? first : fallback;
}

/** Plain text only: control characters removed, whitespace tidied, length capped. */
export function cleanLiveMessage(value: string) {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, LIVE_CHAT_RULES.maxMessageLength);
}
