import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';
import { applicationUrl } from '@/lib/automation/config';

/**
 * The private payment page of a booking (booking automation phase 2) is reached through a signed
 * link sent only to the client's email: /booking/pay/<booking id>.<signature>. The signature is an
 * HMAC of the booking id with AUTH_SECRET, so the link cannot be guessed or changed, needs no
 * stored token, and stays valid while the booking exists. The page itself shows nothing once the
 * booking is closed.
 */
const PURPOSE = 'zentra-booking-payment-link:v1';
const SIGNATURE_LENGTH = 32;
const BOOKING_ID = /^[a-z0-9_-]{8,64}$/i;

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) throw new Error('AUTH_SECRET is not configured.');
  return value;
}

function signature(bookingId: string) {
  return createHmac('sha256', secret())
    .update(`${PURPOSE}:${bookingId}`)
    .digest('base64url')
    .slice(0, SIGNATURE_LENGTH);
}

export function paymentLinkToken(bookingId: string) {
  return `${bookingId}.${signature(bookingId)}`;
}

/** The booking id a payment link token stands for, or null when the token is not genuine. */
export function bookingIdFromPaymentToken(token: string) {
  const [bookingId, given, ...rest] = token.split('.');
  if (rest.length || !bookingId || !given || !BOOKING_ID.test(bookingId)) return null;
  const expected = Buffer.from(signature(bookingId));
  const actual = Buffer.from(given);
  return actual.length === expected.length && timingSafeEqual(actual, expected) ? bookingId : null;
}

/** The page's path, or null when AUTH_SECRET is missing, so a saved booking never fails on it. */
export function paymentPagePath(bookingId: string) {
  try {
    return `/booking/pay/${paymentLinkToken(bookingId)}`;
  } catch {
    return null;
  }
}

/**
 * The absolute link for emails, or null when the site's public address or AUTH_SECRET is missing,
 * so an email without the link is still sent.
 */
export function paymentPageUrl(bookingId: string) {
  const origin = applicationUrl();
  const path = paymentPagePath(bookingId);
  return origin && path ? `${origin}${path}` : null;
}
