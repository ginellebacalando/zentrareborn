import { BRAND } from '@/config/brand';
import {
  BOOKING_PAYMENT_METHODS,
  FIND_PAYMENT_PAGE_PATH,
  type BookingPaymentMethod,
} from '@/config/booking';
import type { ChatSource } from './types';

export const PAYMENT_METHODS_SOURCE_ID = 'system-payment-methods';
/** Every answer of the payment guide below has an id with this prefix. */
export const PAYMENT_GUIDE_PREFIX = 'system-payment-';

export const isPaymentGuideSource = (source: ChatSource) =>
  source.id.startsWith(PAYMENT_GUIDE_PREFIX);

const NAMES: Record<BookingPaymentMethod, string> = {
  GCASH: 'GCash',
  BANK_TRANSFER: 'bank transfer',
  CASH: 'cash at the venue',
};

function list(items: string[], last = 'and') {
  return items.length < 3
    ? items.join(` ${last} `)
    : `${items.slice(0, -1).join(', ')} ${last} ${items.at(-1)}`;
}

const FIND_PAGE = `Can’t find your payment page? Use “Find my payment page” and we email you the link again.`;

/** The methods the booking system offers now, in the booking form's order. */
function offeredMethods(methods: readonly BookingPaymentMethod[]) {
  return BOOKING_PAYMENT_METHODS.map((option) => option.value).filter((method) =>
    methods.includes(method),
  );
}

/**
 * Zeni's answer to "Which payment methods do you accept?", from the methods the booking system
 * offers right now (cash always; GCash and bank transfer while their account is set up in
 * Settings > Online payments). It replaces the older FAQ list (cash, check, card) that other
 * published information contradicts, so Zeni answers the question instead of avoiding it.
 */
export function paymentMethodsSource(methods: readonly BookingPaymentMethod[]): ChatSource | null {
  const offered = offeredMethods(methods);
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
        ? `For ${list(online)}, your private payment page shows Zion's account: pay there and upload your receipt, and our staff verify it before the payment counts.`
        : '',
    ]
      .filter(Boolean)
      .join(' '),
    keywords: ['payment', 'methods', 'mode', 'pay', 'gcash', 'bank', 'transfer', 'cash', 'bayad'],
  };
}

/**
 * Zeni's payment guide (docs/chatbot.md, "Payment guide"): the accepted methods, then where and how
 * to pay, where the proof of payment goes, paying cash and where Zion's account details are, all
 * from what the booking system offers now. It follows docs/booking-automation.md: a held date
 * comes with "Your date is on hold" and a link to the client's private payment page, which shows
 * Zion's account and takes the receipt screenshot. Account numbers stay on that page; Zeni never
 * gives them. Each answer names its subject without "where" or "saan", which search reads as
 * "location", so a question about the venue's location still finds the location.
 */
export function paymentGuideSources(methods: readonly BookingPaymentMethod[]): ChatSource[] {
  const methodsSource = paymentMethodsSource(methods);
  if (!methodsSource) return [];
  const offered = offeredMethods(methods);
  const online = offered.filter((method) => method !== 'CASH');
  const onlineNames = list(online.map((method) => NAMES[method]));
  const accounts = list(online.map((method) => (method === 'GCASH' ? 'GCash' : 'bank')));
  const cash = offered.includes('CASH');
  const guide = (
    id: string,
    title: string,
    subject: string,
    lines: string[],
    keywords: string[],
  ): ChatSource => ({
    id: `${PAYMENT_GUIDE_PREFIX}${id}`,
    kind: 'faq',
    topic: 'payments',
    title,
    subject,
    href: FIND_PAYMENT_PAGE_PATH,
    text: lines.filter(Boolean).join('\n'),
    keywords,
  });
  return [
    methodsSource,
    guide(
      'where',
      'Where and how do I pay?',
      'pay payment',
      [
        'You pay once Zion holds your date: the email “Your date is on hold” gives the amount, the deadline and the link to your private payment page, and the screen after your booking request shows the same link.',
        online.length
          ? `For ${onlineNames}: open your payment page, pay to Zion's account shown there, then upload a screenshot of your receipt on the same page. Our staff verify it before the payment counts.`
          : '',
        cash
          ? 'For cash: pay at Zion Events Place; staff record it and give you an acknowledgment receipt.'
          : '',
        FIND_PAGE,
      ],
      // "Saan ko ipapadala ang bayad?" sends the payment itself, not a proof of it.
      ['pay', 'payment', 'bayad', 'magbayad', 'hulog', 'send', 'payment page', 'payment link'],
    ),
    ...(online.length
      ? [
          guide(
            'proof',
            'Where do I send my proof of payment?',
            // Short, so a question naming part of it still counts as asking this (retrieval.ts).
            'send upload proof payment',
            [
              `Upload your proof of payment, the screenshot of your ${list(
                online.map((method) => NAMES[method]),
                'or',
              )} receipt, on your private payment page so it is attached to your booking.`,
              'Open the link in the email “Your date is on hold” or in a payment reminder, choose how you paid, enter the reference number, the amount and the date, and attach the screenshot.',
              'Our staff verify it against Zion’s records. You get an email when it is verified, or the reason if it is not accepted.',
              FIND_PAGE,
            ],
            [
              'proof',
              'payment',
              'screenshot',
              'receipt',
              'resibo',
              'send',
              'upload',
              'attach',
              'payment page',
            ],
          ),
          guide(
            'account',
            // No "Zion's" in the title: search would read the "s" as a word of its own.
            `${accounts} account details for payments`,
            'account number details gcash bank',
            [
              `Zion's ${accounts} account details are on your private payment page, with the exact amount and the deadline, once Zion holds your date. Pay only to the account shown there.`,
              FIND_PAGE,
            ],
            ['account', 'number', 'details', 'gcash', 'bank'],
          ),
        ]
      : []),
    guide(
      'receipt',
      'Do I get a receipt for each payment?',
      'receipt',
      [
        `Yes. Every payment Zion records${
          online.length
            ? `, cash or a verified ${list(
                online.map((method) => NAMES[method]),
                'or',
              )},`
            : ''
        } gets an acknowledgment receipt with its own number.`,
        `Download it from your private payment page; ${list(
          [cash ? '“Cash receipt recorded”' : '', online.length ? '“Payment verified”' : ''].filter(
            Boolean,
          ),
        )} ${cash && online.length ? 'emails link' : 'email links'} it too.`,
        'It acknowledges your payment and is not an official receipt; ask our team if you need Zion’s official receipt.',
      ],
      ['receipt', 'resibo', 'acknowledgment', 'download'],
    ),
    ...(cash
      ? [
          guide(
            'cash',
            'Can I pay in cash, and where?',
            'pay cash',
            [
              `Yes. Cash is paid at Zion Events Place: ${BRAND.address.full}.`,
              'Staff record your payment and give you an acknowledgment receipt. Your payment page shows the amount and the deadline.',
            ],
            ['cash', 'pay', 'payment', 'bayad', 'magbayad', 'venue'],
          ),
        ]
      : []),
  ];
}
