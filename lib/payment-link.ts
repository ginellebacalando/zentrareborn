import 'server-only';

import { applicationUrl } from '@/lib/automation/config';
import { idFromSignedToken, signedToken } from '@/lib/signed-link';

/**
 * The private payment page of a booking (booking automation phase 2) is reached through a signed
 * link sent only to the client's email: /booking/pay/<booking id>.<signature> (lib/signed-link.ts).
 * The page itself shows nothing once the booking is closed.
 */
const PURPOSE = 'zentra-booking-payment-link:v1';

export function paymentLinkToken(bookingId: string) {
  return signedToken(PURPOSE, bookingId);
}

/** The booking id a payment link token stands for, or null when the token is not genuine. */
export function bookingIdFromPaymentToken(token: string) {
  return idFromSignedToken(PURPOSE, token);
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
