import { BOOKING_PAYMENT_METHODS, type BookingPaymentMethod } from '@/config/booking';
import type { ChatSource } from './types';

export const PAYMENT_METHODS_SOURCE_ID = 'system-payment-methods';

const NAMES: Record<BookingPaymentMethod, string> = {
  GCASH: 'GCash',
  BANK_TRANSFER: 'bank transfer',
  CASH: 'cash at the venue',
};

function list(items: string[]) {
  return items.length < 3
    ? items.join(' and ')
    : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

/**
 * Zeni's answer to "Which payment methods do you accept?", from the methods the booking system
 * offers right now (cash always; GCash and bank transfer while their account is set up in
 * Settings > Online payments). It replaces the older FAQ list (cash, check, card) that other
 * published information contradicts, so Zeni answers the question instead of avoiding it.
 */
export function paymentMethodsSource(methods: readonly BookingPaymentMethod[]): ChatSource | null {
  const offered = BOOKING_PAYMENT_METHODS.map((option) => option.value).filter((method) =>
    methods.includes(method),
  );
  if (!offered.length) return null;
  const online = offered.filter((method) => method !== 'CASH').map((method) => NAMES[method]);
  return {
    id: PAYMENT_METHODS_SOURCE_ID,
    kind: 'faq',
    topic: 'payments',
    title: 'Which payment methods does Zion accept?',
    href: '/booking',
    text: [
      `You can pay by ${list(offered.map((method) => NAMES[method]))}. You choose the way you prefer when you send your booking request.`,
      online.length
        ? `For ${list(online)}, your private payment page shows Zion's account: pay there and upload your receipt, and our staff check it before the payment counts.`
        : '',
    ]
      .filter(Boolean)
      .join(' '),
    keywords: ['payment', 'methods', 'mode', 'pay', 'gcash', 'bank', 'transfer', 'cash', 'bayad'],
  };
}
