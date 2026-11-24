import 'server-only';
import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from 'node:crypto';
import type { ZeniErrorCode } from '@/config/chatbot-receptionist';

/** `code` lets the route answer in the guest's language; `message` stays the English default. */
export class ConversationError extends Error {
  constructor(
    message: string,
    public status = 503,
    public code?: ZeniErrorCode,
  ) {
    super(message);
  }
}

function encryptionKey() {
  const secret = process.env.RECEPTIONIST_STATE_KEY?.trim() || process.env.AUTH_SECRET?.trim();
  if (!secret || Buffer.byteLength(secret) < 32)
    throw new ConversationError(
      'Conversation memory is temporarily unavailable. Please contact the Zion team.',
      503,
      'unavailable',
    );
  // Purpose separation prevents these records from being used as authentication tokens.
  return Buffer.from(
    hkdfSync('sha256', secret, 'zion-receptionist-state-v1', 'encrypted-conversation-records', 32),
  );
}

export function hashSession(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
export function newSessionToken() {
  return randomBytes(32).toString('base64url');
}

export function sealConversation(value: unknown, binding: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  cipher.setAAD(Buffer.from(binding));
  const body = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map((part) => part.toString('base64url')).join('.');
}

export function openConversation(value: string, binding: string): unknown {
  try {
    const parts = value.split('.');
    if (parts.length !== 3 || value.length > 160000) throw new Error('Invalid envelope.');
    const [iv, tag, body] = parts.map((part) => Buffer.from(part, 'base64url'));
    if (iv.length !== 12 || tag.length !== 16) throw new Error('Invalid envelope.');
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv);
    decipher.setAAD(Buffer.from(binding));
    decipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8'));
  } catch {
    throw new ConversationError(
      'Your conversation could not be restored. Start a new chat or contact the Zion team.',
      409,
      'restore',
    );
  }
}

export function sessionCookieName() {
  return process.env.NODE_ENV === 'production' ? '__Host-zion-receptionist' : 'zion-receptionist';
}
export function sessionToken(request: Request) {
  const key = `${sessionCookieName()}=`;
  const token = request.headers
    .get('cookie')
    ?.split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(key))
    ?.slice(key.length);
  return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
}
export function sessionCookie(token: string, maxAge = 86400) {
  return `${sessionCookieName()}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
}
