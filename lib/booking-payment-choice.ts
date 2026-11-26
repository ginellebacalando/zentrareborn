import { BOOKING_PAYMENT_METHODS, type BookingPaymentMethod } from '@/config/booking';
import type { OnlinePaymentMethod } from '@/lib/admin/payment-accounts';

/**
 * The way a client chose to pay, on the booking page or at the Front desk. Bookings have no column
 * for it: both write it into the booking notes as "Preferred payment: Bank transfer.", and the
 * emails, the payment page and the booking detail read it back from that line. Browser-safe.
 */
const PREFERRED_PAYMENT = /Preferred payment: ([^.\n]+)\./;

/** The online methods inside a sentence: "pay by bank transfer", "pay by GCash". */
const ONLINE_NAMES: Record<OnlinePaymentMethod, string> = {
  BANK_TRANSFER: 'bank transfer',
  GCASH: 'GCash',
};

function isOffered(method: BookingPaymentMethod, online: readonly OnlinePaymentMethod[]) {
  return method !== 'CASH' && online.includes(method);
}

export function onlineMethodName(method: OnlinePaymentMethod) {
  return ONLINE_NAMES[method];
}

/** The notes line that records the client's choice. */
export function preferredPaymentNote(method: BookingPaymentMethod) {
  const label = BOOKING_PAYMENT_METHODS.find((option) => option.value === method)?.label ?? method;
  return `Preferred payment: ${label}.`;
}

/** The client's choice, read back from the notes; null when staff removed or changed the line. */
export function preferredPaymentMethod(
  notes: string | null | undefined,
): BookingPaymentMethod | null {
  const label = PREFERRED_PAYMENT.exec(notes ?? '')?.[1]?.trim();
  return BOOKING_PAYMENT_METHODS.find((option) => option.label === label)?.value ?? null;
}

/**
 * The ways a client can choose now: GCash and bank transfer only while Zion's account for them is
 * set up in Settings → Online payments, and cash always.
 */
export function offeredBookingPaymentMethods(
  online: readonly OnlinePaymentMethod[],
): BookingPaymentMethod[] {
  return BOOKING_PAYMENT_METHODS.map((option) => option.value).filter(
    (method) => method === 'CASH' || isOffered(method, online),
  );
}

/** The GCash or bank transfer choice of a client, when Zion offers that method now. */
export function chosenOnlineMethod(
  preferred: BookingPaymentMethod | null,
  online: readonly OnlinePaymentMethod[],
): OnlinePaymentMethod | null {
  return preferred && isOffered(preferred, online) ? (preferred as OnlinePaymentMethod) : null;
}

/**
 * How to pay, in the client's emails. A client who chose GCash or bank transfer (offered now) is
 * told to transfer and attach the receipt on the payment page, with no cash text; a client who
 * chose cash gets Zion's cash instructions; anyone else gets the cash instructions and the online
 * ways Zion offers.
 */
export function howToPay(
  cashInstructions: string,
  preferred: BookingPaymentMethod | null,
  online: readonly OnlinePaymentMethod[],
) {
  const chosen = chosenOnlineMethod(preferred, online);
  if (chosen)
    return `Pay by ${ONLINE_NAMES[chosen]} to the Zion Events Place account shown on your payment page, then attach your receipt there. We check every receipt against our records before we count the payment.`;
  if (preferred === 'CASH' || !online.length) return cashInstructions;
  const others = online.map((method) => ONLINE_NAMES[method]).join(' or ');
  return `${cashInstructions} You can also pay by ${others} and attach your receipt on your payment page.`.trim();
}
