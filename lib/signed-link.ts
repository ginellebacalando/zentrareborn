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
