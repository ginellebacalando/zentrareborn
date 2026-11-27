import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Private links that need no stored token: `<record id>.<signature>`, where the signature is an
 * HMAC of the purpose and the id with AUTH_SECRET. A link cannot be guessed or moved to another
 * record or purpose, and it stays valid while the record exists. Used by the payment page
 * (lib/payment-link.ts) and the visit manage page (lib/visit-link.ts).
 */
const SIGNATURE_LENGTH = 32;
const RECORD_ID = /^[a-z0-9_-]{8,64}$/i;

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) throw new Error('AUTH_SECRET is not configured.');
  return value;
}

function signature(purpose: string, id: string) {
  return createHmac('sha256', secret())
    .update(`${purpose}:${id}`)
    .digest('base64url')
    .slice(0, SIGNATURE_LENGTH);
}

export function signedToken(purpose: string, id: string) {
  return `${id}.${signature(purpose, id)}`;
}

/** The record id a token stands for, or null when the token is not genuine for this purpose. */
export function idFromSignedToken(purpose: string, token: string) {
  const [id, given, ...rest] = token.split('.');
  if (rest.length || !id || !given || !RECORD_ID.test(id)) return null;
  const expected = Buffer.from(signature(purpose, id));
  const actual = Buffer.from(given);
  return actual.length === expected.length && timingSafeEqual(actual, expected) ? id : null;
}

const EXPIRY = /^[0-9a-z]{1,10}$/;

/**
 * A private link that also expires: `<record id>.<expiry>.<signature>`, the expiry in base-36
 * seconds and covered by the signature, so it cannot be extended. Used for client photo upload
 * links and the short-lived addresses photos are shown through (lib/client-photo-link.ts).
 */
export function signedExpiringToken(purpose: string, id: string, expiresAt: Date) {
  const expiry = Math.floor(expiresAt.getTime() / 1000).toString(36);
  return `${id}.${expiry}.${signature(purpose, `${id}.${expiry}`)}`;
}

/** The record id and expiry of a genuine, unexpired token for this purpose, or null. */
export function idFromSignedExpiringToken(purpose: string, token: string, now = new Date()) {
  const [id, expiry, given, ...rest] = token.split('.');
  if (rest.length || !id || !expiry || !given || !RECORD_ID.test(id) || !EXPIRY.test(expiry))
    return null;
  const expected = Buffer.from(signature(purpose, `${id}.${expiry}`));
  const actual = Buffer.from(given);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  const expiresAt = new Date(parseInt(expiry, 36) * 1000);
  return expiresAt.getTime() > now.getTime() ? { id, expiresAt } : null;
}
