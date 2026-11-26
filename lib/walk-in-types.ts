/**
 * Browser-safe vocabulary for walk-in bookings at the Front desk (docs/walk-ins.md), shared by
 * the walk-in page and the server.
 */
import type { BookingPaymentMethod } from '@/config/booking';

export const CONSENT_METHODS = ['PRINTED_FORM', 'ON_SCREEN'] as const;
export type ConsentMethod = (typeof CONSENT_METHODS)[number];

export const CONSENT_LABELS: Record<ConsentMethod, string> = {
  PRINTED_FORM: 'The client signed the printed consent form',
  ON_SCREEN: 'The client agreed on this screen',
};

export type WalkInPackage = {
  id: string;
  name: string;
  price: number;
  paxIncluded: number;
  excessPaxFee: number;
  reservationFee: number;
};

export type WalkInCategory = { slug: string; name: string; packages: WalkInPackage[] };

/** What the walk-in page needs to price, check and explain a booking before it is sent. */
export type WalkInOptions = {
  categories: WalkInCategory[];
  /** The booking window, Manila dates (YYYY-MM-DD). */
  earliest: string;
  latest: string;
  /** Dates held or confirmed for an event, and dates with an open request. */
  booked: string[];
  inquired: string[];
  times: string[];
  extras: string[];
  minGuests: number;
  maxGuests: number;
  reviewGuestLimit: number | null;
  paymentDeadlineDays: number;
  policy: { paymentRule: string; reviewed: boolean; cashInstructions: string };
  /** Whether the client's payment page takes GCash or bank transfer screenshots. */
  onlinePayments: boolean;
  /** The ways to pay later offered now: GCash and bank transfer only while their account is set up. */
  paymentMethods: BookingPaymentMethod[];
};

/** A client's details carried into the walk-in page from a visit or an earlier booking. */
export type WalkInPrefill = {
  source: 'visit' | 'booking';
  reference: string;
  visitId: string | null;
  clientName: string;
  email: string;
  phone: string;
  eventType: string;
  eventDate: string | null;
  guests: number | null;
};

/**
 * CONFIRMED: the payment met the rule and the date is secured. HELD: approved, the date is held
 * until the payment deadline. REVIEW: saved for a staff decision on Bookings.
 */
export type WalkInOutcome = 'CONFIRMED' | 'HELD' | 'REVIEW';

export type WalkInResult = {
  id: string;
  reference: string;
  outcome: WalkInOutcome;
  holdExpiresAt: string | null;
  totalCents: number;
  paidCents: number;
  amountDueCents: number;
  reviewReasons: string[];
  /** The client's private payment page, to upload a GCash or bank screenshot at the desk. */
  paymentPath: string | null;
  /** The acknowledgment receipt of the cash recorded now. */
  receiptPath: string | null;
};
