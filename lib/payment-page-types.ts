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
      amountDueCents: number;
      deadline: string | null;
      cashInstructions: string;
      methods: OnlinePaymentMethod[];
      accounts: PaymentAccounts;
      proof: PaymentProofSummary | null;
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
