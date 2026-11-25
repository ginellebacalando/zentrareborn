import type { OnlinePaymentMethod, PaymentAccounts } from '@/lib/admin/payment-accounts';

/**
 * What a client's private payment page shows (booking automation phase 2). Built on the server
 * from a signed link; holds only what the client already knows about their own booking.
 */
export type PaymentProofSummary = {
  status: 'SUBMITTED' | 'VERIFIED' | 'REJECTED';
  method: OnlinePaymentMethod;
  amountCents: number;
  submittedAt: string;
  reviewReason: string;
};

/** A payment Zion recorded, with its acknowledgment receipt (phase 3). */
export type RecordedPayment = {
  id: string;
  amountCents: number;
  receivedAt: string;
  method: OnlinePaymentMethod | 'CASH';
  acknowledgmentNumber: string | null;
};

export type PaymentPageView =
  | { state: 'invalid' }
  | {
      /** waiting: held until the deadline; review: not approved yet; closed: cancelled. */
      state: 'waiting' | 'review' | 'confirmed' | 'closed';
      reference: string;
      clientName: string;
      eventType: string;
      packageName: string;
      startsAt: string;
      endsAt: string;
      /**
       * What the page takes now: the reservation fee of a held date, the remaining balance of a
       * confirmed booking, or nothing.
       */
      paying: 'fee' | 'balance' | null;
      amountDueCents: number;
      /** The payment deadline of a held date. */
      deadline: string | null;
      /** When full payment is due (Zion's terms), for a confirmed booking with a balance. */
      balanceDueAt: string | null;
      totalCents: number;
      paidCents: number;
      cashInstructions: string;
      methods: OnlinePaymentMethod[];
      accounts: PaymentAccounts;
      proof: PaymentProofSummary | null;
      payments: RecordedPayment[];
    };

/** The reasons staff can give when a screenshot cannot be verified. */
export const PAYMENT_REJECTION_REASONS = {
  AMOUNT_MISMATCH: 'The amount does not match what we received.',
  UNREADABLE: 'The screenshot is unclear or cut off.',
  WRONG_ACCOUNT: 'The payment was not sent to our account.',
  NOT_RECEIVED: 'We could not find this payment in our records.',
  DUPLICATE: 'This screenshot or reference number was already used.',
  OTHER: 'We could not verify this payment.',
} as const;

export type PaymentRejectionReason = keyof typeof PAYMENT_REJECTION_REASONS;
