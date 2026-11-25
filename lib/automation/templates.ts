import 'server-only';

import { BRAND } from '@/config/brand';
import { EMAIL_SPAM_NOTICE } from '@/lib/email-delivery';
import { EMAIL_THEME } from './email-theme';

/** A rendered message: HTML for capable clients and a complete plain-text alternative. */
export type RenderedEmail = { subject: string; text: string; html: string };
export type EmailDetail = readonly [label: string, value: string];
export type EmailSection = { heading?: string; paragraphs?: string[]; details?: EmailDetail[] };

const MANILA = 'Asia/Manila';

export function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** Header values must stay on one line; nodemailer encodes the rest. */
export function singleLine(value: string, max = 180) {
  const line = value.replace(/[\p{Cc}\s]+/gu, ' ').trim();
  return line.length > max ? `${line.slice(0, max - 3)}...` : line;
}

export function manilaDateTime(value: Date) {
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: MANILA,
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(value);
}

export function manilaDate(value: Date) {
  return new Intl.DateTimeFormat('en-PH', { timeZone: MANILA, dateStyle: 'full' }).format(value);
}

export function manilaTime(value: Date) {
  return new Intl.DateTimeFormat('en-PH', { timeZone: MANILA, timeStyle: 'short' }).format(value);
}

/** Visitor-typed names are echoed only when they look like a name, never as free text. */
export function greetingName(value: string | null | undefined) {
  const name = (value ?? '').replace(/\s+/g, ' ').trim();
  return /^[\p{L}][\p{L}\p{M}' .-]{0,59}$/u.test(name) ? name : '';
}

const venueAddress = `${BRAND.legalName}, ${BRAND.address.full}`;
const footerLines = [
  BRAND.legalName,
  ...BRAND.address.lines,
  `${BRAND.contact.phone} · ${BRAND.contact.email}`,
  'This is an automated message from the Zion Events Place system.',
];

function paragraphHtml(text: string) {
  return `<p style="margin:0 0 16px;">${escapeHtml(text).replace(/\r?\n/g, '<br>')}</p>`;
}

function detailsHtml(details: EmailDetail[]) {
  const rows = details
    .filter(([, value]) => value.trim())
    .map(
      ([label, value]) =>
        `<tr><th scope="row" align="left" valign="top" style="padding:8px 12px 8px 0;border-bottom:1px solid ${EMAIL_THEME.line};color:${EMAIL_THEME.muted};font-weight:normal;font-size:14px;white-space:nowrap;">${escapeHtml(label)}</th><td style="padding:8px 0;border-bottom:1px solid ${EMAIL_THEME.line};color:${EMAIL_THEME.text};font-size:15px;">${escapeHtml(value).replace(/\r?\n/g, '<br>')}</td></tr>`,
    )
    .join('');
  return rows
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 20px;border-top:1px solid ${EMAIL_THEME.line};">${rows}</table>`
    : '';
}

function sectionHtml(section: EmailSection) {
  return [
    section.heading
      ? `<h2 style="margin:24px 0 12px;font-size:18px;line-height:1.3;color:${EMAIL_THEME.brand};">${escapeHtml(section.heading)}</h2>`
      : '',
    ...(section.paragraphs ?? []).map(paragraphHtml),
    detailsHtml(section.details ?? []),
  ].join('');
}

function sectionText(section: EmailSection) {
  const details = (section.details ?? [])
    .filter(([, value]) => value.trim())
    .map(([label, value]) => `${label}: ${value}`);
  return [
    section.heading
      ? `${section.heading}\n${'-'.repeat(Math.min(section.heading.length, 60))}`
      : '',
    ...(section.paragraphs ?? []),
    details.join('\n'),
  ]
    .filter(Boolean)
    .join('\n\n');
}

/** Branded wrapper: "ZENTRA" over "Zion Events Place", deep green on white. */
export function renderEmail(input: {
  subject: string;
  preheader: string;
  heading: string;
  sections: EmailSection[];
  action?: { label: string; href: string };
}): RenderedEmail {
  const subject = singleLine(input.subject, 200);
  const action = input.action
    ? `<p style="margin:8px 0 24px;"><a href="${escapeHtml(input.action.href)}" style="display:inline-block;padding:12px 20px;background:${EMAIL_THEME.brand};color:${EMAIL_THEME.onBrand};text-decoration:none;border-radius:6px;font-weight:bold;">${escapeHtml(input.action.label)}</a></p>`
    : '';
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${EMAIL_THEME.background};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(input.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${EMAIL_THEME.background};">
<tr><td align="center" style="padding:24px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;font-family:${EMAIL_THEME.bodyFont};">
<tr><td align="center" style="padding:8px 0 18px;border-bottom:3px solid ${EMAIL_THEME.brand};">
<div style="font-family:${EMAIL_THEME.wordmarkFont};font-size:30px;line-height:1.1;letter-spacing:8px;font-weight:bold;color:${EMAIL_THEME.brand};">${escapeHtml(EMAIL_THEME.wordmark)}</div>
<div style="margin-top:6px;font-size:13px;letter-spacing:3px;text-transform:uppercase;color:${EMAIL_THEME.muted};">${escapeHtml(BRAND.legalName)}</div>
</td></tr>
<tr><td style="padding:28px 0 8px;font-size:16px;line-height:1.6;color:${EMAIL_THEME.text};">
<h1 style="margin:0 0 20px;font-size:24px;line-height:1.25;color:${EMAIL_THEME.brand};">${escapeHtml(input.heading)}</h1>
${input.sections.map(sectionHtml).join('\n')}
${action}
</td></tr>
<tr><td style="padding:16px 0 0;border-top:1px solid ${EMAIL_THEME.line};font-size:13px;line-height:1.5;color:${EMAIL_THEME.muted};">
${footerLines.map((line) => escapeHtml(line)).join('<br>')}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
  const text = [
    `${EMAIL_THEME.wordmark}\n${BRAND.legalName}\n${'='.repeat(BRAND.legalName.length)}`,
    input.heading,
    ...input.sections.map(sectionText).filter(Boolean),
    input.action ? `${input.action.label}: ${input.action.href}` : '',
    `--\n${footerLines.join('\n')}`,
  ]
    .filter(Boolean)
    .join('\n\n');
  return { subject, text: `${text}\n`, html };
}

/** Reuses an existing plain-text notice (for example a booking decision) inside the layout. */
export function renderPlainNotice(input: {
  subject: string;
  heading: string;
  body: string;
  extra?: string[];
  /** A button, for example to the client's private payment page. */
  action?: { label: string; href: string };
}): RenderedEmail {
  const paragraphs = [...input.body.split(/\r?\n\s*\r?\n/), ...(input.extra ?? [])]
    .map((part) => part.trim())
    .filter(Boolean);
  const rendered = renderEmail({
    subject: input.subject,
    preheader: input.heading,
    heading: input.heading,
    sections: [{ paragraphs }],
    action: input.action,
  });
  // The stored body stays the established notice text, followed by any extra paragraphs and the
  // action's link, so plain-text mail readers see the link too.
  const link = input.action ? [`${input.action.label}: ${input.action.href}`] : [];
  return {
    ...rendered,
    text: [input.body.trimEnd(), ...(input.extra ?? []), ...link].join('\n\n'),
  };
}

export function inquiryStaffAlert(input: {
  reference: string;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  eventInterest: string | null;
  packageInterest: string | null;
  preferredContactTime: string | null;
  sourcePage: string;
  message: string;
  submittedAt: Date;
  inboxUrl: string | null;
}): RenderedEmail {
  const message =
    input.message.length > 2000 ? `${input.message.slice(0, 1997)}...` : input.message;
  return renderEmail({
    subject: `New inquiry ${input.reference} | ${singleLine(input.fullName, 80)}`,
    preheader: `A new inquiry was submitted from ${input.sourcePage}.`,
    heading: 'New inquiry received',
    sections: [
      {
        paragraphs: [
          'A new inquiry was saved in the admin inbox. Reply to this email to answer the client directly.',
        ],
        details: [
          ['Reference', input.reference],
          ['Name', singleLine(input.fullName)],
          ['Email', input.email],
          ['Phone', input.phoneNumber ?? ''],
          ['Event interest', input.eventInterest ?? ''],
          ['Package interest', input.packageInterest ?? ''],
          ['Preferred contact time', input.preferredContactTime ?? ''],
          ['Received through', input.sourcePage.replaceAll('_', ' ')],
          ['Submitted', manilaDateTime(input.submittedAt)],
        ],
      },
      { heading: 'Message', paragraphs: [message] },
    ],
    action: input.inboxUrl ? { label: 'Open the inquiry inbox', href: input.inboxUrl } : undefined,
  });
}

export function inquiryAcknowledgement(input: {
  reference: string;
  fullName: string;
}): RenderedEmail {
  const name = greetingName(input.fullName);
  return renderEmail({
    subject: `${BRAND.legalName} | Inquiry received | ${input.reference}`,
    preheader: 'We received your inquiry. Our team will contact you soon.',
    heading: 'We received your inquiry',
    sections: [
      {
        paragraphs: [
          name ? `Hello ${name},` : 'Hello,',
          `Thank you for contacting ${BRAND.legalName}. Your inquiry is saved and our team will reply using the contact details you provided.`,
          'An inquiry does not reserve a date. Dates are secured only after our staff review and confirm a reservation with you.',
          EMAIL_SPAM_NOTICE,
        ],
        details: [['Inquiry reference', input.reference]],
      },
    ],
  });
}

/** A booking request sent from the public booking page (an admin booking with status Request). */
export type BookingRequestEmailSource = {
  reference: string;
  clientName: string;
  email: string;
  phone: string;
  eventType: string;
  packageName: string;
  startsAt: Date;
  endsAt: Date;
  guests: number;
  totalCents: number;
  depositCents: number;
  notes: string;
  createdAt: Date;
};

function pesos(cents: number) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function bookingRequestDetails(input: BookingRequestEmailSource): EmailDetail[] {
  return [
    ['Booking reference', input.reference],
    ['Event', singleLine(input.eventType)],
    ['Package', singleLine(input.packageName)],
    ['Date', manilaDate(input.startsAt)],
    ['Time', `${manilaTime(input.startsAt)} to ${manilaTime(input.endsAt)}`],
    ['Guests', String(input.guests)],
    [
      'Estimate',
      input.totalCents > 0 ? pesos(input.totalCents) : 'Custom proposal; Zion will send a quote',
    ],
    ['Reservation fee', input.depositCents > 0 ? pesos(input.depositCents) : ''],
  ];
}

/**
 * What the system decided for a website request (docs/booking-automation.md): a payment deadline
 * when it approved the request and holds the date, or the reasons it needs staff review.
 */
export type BookingRequestOutcome = {
  holdExpiresAt: Date | null;
  amountDueCents: number;
  paymentInstructions: string;
  reviewReasons: string[];
  /** The client's private payment page (phase 2), when the site's address is known. */
  paymentUrl?: string | null;
};

export function bookingRequestStaffAlert(
  input: BookingRequestEmailSource & { bookingsUrl: string | null; outcome: BookingRequestOutcome },
): RenderedEmail {
  const notes = input.notes.length > 2000 ? `${input.notes.slice(0, 1997)}...` : input.notes;
  const { holdExpiresAt, amountDueCents, reviewReasons } = input.outcome;
  const name = singleLine(input.clientName, 80);
  return renderEmail({
    subject: holdExpiresAt
      ? `New booking ${input.reference} | ${name} | waiting for payment`
      : `Booking request ${input.reference} | ${name} | needs review`,
    preheader: `${singleLine(input.eventType)} on ${manilaDate(input.startsAt)} for ${input.guests} guests.`,
    heading: holdExpiresAt
      ? 'New booking waiting for payment'
      : 'Booking request needs your review',
    sections: [
      {
        paragraphs: [
          holdExpiresAt
            ? `A visitor booked from the website. The system approved it and holds the date until ${manilaDateTime(holdExpiresAt)} for the payment of ${pesos(amountDueCents)}. When the client pays, record the cash in Bookings and the booking confirms itself. If no payment arrives by the deadline, the date is released automatically.`
            : `A visitor sent a booking request that needs a staff decision: ${reviewReasons.join('; ')}. Open Bookings to approve or reject it; approving holds the date while the client pays.`,
          'Reply to this email to answer the client directly.',
        ],
        details: [
          ['Name', singleLine(input.clientName)],
          ['Email', input.email],
          ['Phone', input.phone],
          ...bookingRequestDetails(input),
          ['Pay by', holdExpiresAt ? manilaDateTime(holdExpiresAt) : ''],
          ['Submitted', manilaDateTime(input.createdAt)],
        ],
      },
      ...(notes ? [{ heading: 'Notes from the client', paragraphs: [notes] }] : []),
    ],
    action: input.bookingsUrl ? { label: 'Open bookings', href: input.bookingsUrl } : undefined,
  });
}

/** The client's email when the system approved the request and holds the date for the payment. */
function heldBookingAcknowledgement(
  input: BookingRequestEmailSource,
  outcome: BookingRequestOutcome & { holdExpiresAt: Date },
): RenderedEmail {
  const name = greetingName(input.clientName);
  const amount = pesos(outcome.amountDueCents);
  const deadline = manilaDateTime(outcome.holdExpiresAt);
  return renderEmail({
    subject: `${BRAND.legalName} | Your date is on hold | ${input.reference}`,
    preheader: `Pay ${amount} by ${deadline} to confirm your date.`,
    heading: 'Your date is on hold',
    sections: [
      {
        paragraphs: [
          name ? `Hello ${name},` : 'Hello,',
          `Thank you for choosing ${BRAND.legalName}. Your booking is approved and your date is on hold for you until ${deadline} (Manila time).`,
          `To confirm it, please pay ${amount} before the deadline. ${outcome.paymentInstructions}`.trim(),
          'If we do not receive your payment by then, the hold ends and the date opens to other clients.',
          EMAIL_SPAM_NOTICE,
        ],
        details: [
          ...bookingRequestDetails(input),
          ['Amount to pay now', amount],
          ['Pay by', deadline],
        ],
      },
      {
        heading: 'What happens next',
        paragraphs: [
          `1. Pay ${amount} by ${deadline}.`,
          '2. We record your payment and confirm your date right away.',
          '3. You receive a confirmation email with a calendar invitation.',
          `Questions? Call ${BRAND.contact.phone} or email ${BRAND.contact.email} and mention your booking reference.`,
        ],
      },
    ],
    action: outcome.paymentUrl
      ? { label: 'See how to pay or upload your payment', href: outcome.paymentUrl }
      : undefined,
  });
}

export function bookingRequestAcknowledgement(
  input: BookingRequestEmailSource,
  outcome?: BookingRequestOutcome,
): RenderedEmail {
  if (outcome?.holdExpiresAt)
    return heldBookingAcknowledgement(input, { ...outcome, holdExpiresAt: outcome.holdExpiresAt });
  const name = greetingName(input.clientName);
  return renderEmail({
    subject: `${BRAND.legalName} | Booking request received | ${input.reference}`,
    preheader: 'We received your booking request. Our team will review it and contact you.',
    heading: 'We received your booking request',
    sections: [
      {
        paragraphs: [
          name ? `Hello ${name},` : 'Hello,',
          `Thank you for choosing ${BRAND.legalName}. Your booking request is saved and our team will review it.`,
          'Your date is not reserved yet. After we approve your request we send the reservation fee details, and your date is confirmed once the payment is received and verified.',
          EMAIL_SPAM_NOTICE,
        ],
        details: bookingRequestDetails(input),
      },
      {
        heading: 'What happens next',
        paragraphs: [
          '1. We review your request, usually within one to two days.',
          '2. We contact you with the reservation fee details.',
          '3. We confirm your date once your payment is verified.',
          `Questions? Call ${BRAND.contact.phone} or email ${BRAND.contact.email} and mention your booking reference.`,
        ],
      },
    ],
  });
}

/** A booking as the staff calendar email describes it. */
export type StaffCalendarBooking = {
  reference: string;
  clientName: string;
  email: string;
  phone: string;
  eventType: string;
  packageName: string;
  guests: number;
  startsAt: Date;
  endsAt: Date;
};

/**
 * Which staff calendar email to write: a booking request shown as pending, a confirmed
 * reservation, or the removal of either from the staff calendars.
 */
export type StaffCalendarNoticeKind =
  | 'PENDING'
  | 'CONFIRMED'
  | 'CONFIRMED_CANCELLED'
  | 'REQUEST_DECLINED'
  | 'REQUEST_CANCELLED'
  | 'REQUEST_EXPIRED';

const STAFF_CALENDAR_COPY: Record<
  StaffCalendarNoticeKind,
  { subject: string; heading: string; preheader: string; paragraph: string }
> = {
  PENDING: {
    subject: 'Pending request',
    heading: 'Booking request added to your calendar',
    preheader:
      'is waiting for review; the attached invitation shows it in your calendar as pending.',
    paragraph:
      'A booking request is waiting for review. The attached invitation (invite.ics) shows it in your calendar as a pending event, marked [Pending], so you can see the requested date. The date is not reserved yet: the same event becomes the confirmed reservation when staff confirm it, and is removed if the request is declined or cancelled.',
  },
  CONFIRMED: {
    subject: 'Confirmed',
    heading: 'Reservation confirmed',
    preheader: 'is confirmed; the attached invitation adds it to your calendar.',
    paragraph:
      'This reservation is confirmed. A calendar invitation (invite.ics) is attached so the event appears in your calendar.',
  },
  CONFIRMED_CANCELLED: {
    subject: 'Cancelled',
    heading: 'Confirmed reservation cancelled',
    preheader: 'was cancelled; the attached update removes it from your calendar.',
    paragraph:
      'This confirmed reservation was cancelled. The calendar update (cancel.ics) removes the event from calendars that received its invitation.',
  },
  REQUEST_DECLINED: {
    subject: 'Request declined',
    heading: 'Booking request declined',
    preheader: 'was declined; the attached update removes its pending event from your calendar.',
    paragraph:
      'This booking request was declined. The calendar update (cancel.ics) removes its pending event from calendars that received it.',
  },
  REQUEST_CANCELLED: {
    subject: 'Request cancelled',
    heading: 'Booking request cancelled',
    preheader: 'was cancelled; the attached update removes its pending event from your calendar.',
    paragraph:
      'This booking request was cancelled before it was confirmed. The calendar update (cancel.ics) removes its pending event from calendars that received it.',
  },
  REQUEST_EXPIRED: {
    subject: 'Payment deadline passed',
    heading: 'Held date released',
    preheader:
      'passed its payment deadline; the attached update removes its pending event from your calendar.',
    paragraph:
      'The payment deadline passed without the payment, so the system released the date for other clients. The calendar update (cancel.ics) removes the pending event from calendars that received it.',
  },
};

/** Carries the staff copy of a booking's calendar event: pending, confirmed, or removed. */
export function staffCalendarNotice(
  booking: StaffCalendarBooking,
  kind: StaffCalendarNoticeKind,
  bookingsUrl: string | null,
): RenderedEmail {
  const copy = STAFF_CALENDAR_COPY[kind];
  const reserved = kind === 'CONFIRMED' || kind === 'CONFIRMED_CANCELLED';
  const label = reserved ? 'Reservation' : 'Booking request';
  const date = manilaDate(booking.startsAt);
  return renderEmail({
    subject: `${copy.subject}: ${singleLine(booking.eventType, 60)} for ${singleLine(booking.clientName, 80)}, ${date}`,
    preheader: `${label} ${booking.reference} ${copy.preheader}`,
    heading: copy.heading,
    sections: [
      {
        paragraphs: [copy.paragraph, 'Reply to this email to contact the client.'],
        details: [
          [label, booking.reference],
          ['Client', singleLine(booking.clientName)],
          ['Email', booking.email],
          ['Phone', booking.phone],
          ['Event', singleLine(booking.eventType)],
          ['Package', singleLine(booking.packageName)],
          ['Date', date],
          [
            'Time',
            `${manilaTime(booking.startsAt)} to ${manilaTime(booking.endsAt)} (Manila time)`,
          ],
          ['Guests', String(booking.guests)],
        ],
      },
    ],
    action: bookingsUrl ? { label: 'Open bookings', href: bookingsUrl } : undefined,
  });
}

export type ReminderBooking = {
  reference: string;
  clientName: string;
  eventType: string;
  packageName: string;
  guests: number;
  startsAt: Date;
  endsAt: Date;
};

export function eventReminder(booking: ReminderBooking, lead: 'week' | 'day'): RenderedEmail {
  const when = lead === 'day' ? 'tomorrow' : 'in about one week';
  return renderEmail({
    subject: `${BRAND.legalName} | Event reminder | ${booking.reference}`,
    preheader: `Your ${booking.eventType} at ${BRAND.legalName} is ${when}.`,
    heading: lead === 'day' ? 'Your event is tomorrow' : 'Your event is one week away',
    sections: [
      {
        paragraphs: [
          `Hello ${booking.clientName},`,
          `This is a friendly reminder that your confirmed ${booking.eventType} at ${BRAND.legalName} is ${when}.`,
          `If anything has changed, please contact us at ${BRAND.contact.phone} or ${BRAND.contact.email}.`,
        ],
        details: [
          ['Reservation', booking.reference],
          ['Date', manilaDate(booking.startsAt)],
          [
            'Time',
            `${manilaTime(booking.startsAt)} to ${manilaTime(booking.endsAt)} (Manila time)`,
          ],
          ['Package', booking.packageName],
          ['Guests', String(booking.guests)],
          ['Venue', venueAddress],
        ],
      },
    ],
  });
}

/** Reminds a client whose date is held that the payment deadline is near (booking automation). */
export function holdReminder(
  booking: ReminderBooking & {
    holdExpiresAt: Date;
    amountDueCents: number;
    instructions: string;
    paymentUrl?: string | null;
  },
): RenderedEmail {
  const name = greetingName(booking.clientName);
  const deadline = manilaDateTime(booking.holdExpiresAt);
  const amount = pesos(booking.amountDueCents);
  return renderEmail({
    subject: `${BRAND.legalName} | Payment reminder | ${booking.reference}`,
    preheader: `Pay ${amount} by ${deadline} to keep your date.`,
    heading: 'Your payment is due soon',
    sections: [
      {
        paragraphs: [
          name ? `Hello ${name},` : 'Hello,',
          `Your ${singleLine(booking.eventType)} date is still on hold for you until ${deadline} (Manila time). Please pay ${amount} before then to confirm it.`,
          booking.instructions,
          'If we do not receive your payment by then, the hold ends and the date opens to other clients.',
          `Questions? Call ${BRAND.contact.phone} or email ${BRAND.contact.email} and mention your booking reference.`,
        ].filter(Boolean),
        details: [
          ['Booking reference', booking.reference],
          ['Event date', manilaDate(booking.startsAt)],
          [
            'Time',
            `${manilaTime(booking.startsAt)} to ${manilaTime(booking.endsAt)} (Manila time)`,
          ],
          ['Amount to pay now', amount],
          ['Pay by', deadline],
        ],
      },
    ],
    action: booking.paymentUrl
      ? { label: 'See how to pay or upload your payment', href: booking.paymentUrl }
      : undefined,
  });
}

/** Tells staff that a finished event still has a balance, so it was not marked completed. */
export function balanceAfterEventAlert(input: {
  reference: string;
  clientName: string;
  email: string;
  phone: string;
  eventType: string;
  startsAt: Date;
  balanceCents: number;
  bookingsUrl: string | null;
}): RenderedEmail {
  return renderEmail({
    subject: `Balance still due ${input.reference} | ${singleLine(input.clientName, 80)}`,
    preheader: `${pesos(input.balanceCents)} is still due for an event that has ended.`,
    heading: 'Balance still due after the event',
    sections: [
      {
        paragraphs: [
          'This event has ended, but its balance is not fully paid, so it was not marked completed. Record the remaining payment in Bookings; the event is completed on the next morning run once it is fully paid.',
          'Reply to this email to contact the client.',
        ],
        details: [
          ['Reservation', input.reference],
          ['Client', singleLine(input.clientName)],
          ['Email', input.email],
          ['Phone', input.phone],
          ['Event', singleLine(input.eventType)],
          ['Event date', manilaDate(input.startsAt)],
          ['Balance due', pesos(input.balanceCents)],
        ],
      },
    ],
    action: input.bookingsUrl ? { label: 'Open bookings', href: input.bookingsUrl } : undefined,
  });
}

/** A payment screenshot as the client entered it (booking automation phase 2). */
export type PaymentProofEmailSource = {
  reference: string;
  clientName: string;
  email: string;
  phone: string;
  eventType: string;
  startsAt: Date;
  methodLabel: string;
  amountCents: number;
  referenceNumber: string;
  paidOn: string;
  deadline: Date | null;
};

function paymentProofDetails(input: PaymentProofEmailSource): EmailDetail[] {
  return [
    ['Booking reference', input.reference],
    ['Event', `${singleLine(input.eventType)}, ${manilaDate(input.startsAt)}`],
    ['Paid by', input.methodLabel],
    ['Amount', pesos(input.amountCents)],
    ['Transfer reference', input.referenceNumber],
    ['Date paid', input.paidOn],
  ];
}

/** Tells the client their screenshot arrived and that the date stays held while staff check it. */
export function paymentProofReceived(input: PaymentProofEmailSource): RenderedEmail {
  const name = greetingName(input.clientName);
  return renderEmail({
    subject: `${BRAND.legalName} | Payment screenshot received | ${input.reference}`,
    preheader: 'We received your payment screenshot and will verify it with our records.',
    heading: 'We received your payment screenshot',
    sections: [
      {
        paragraphs: [
          name ? `Hello ${name},` : 'Hello,',
          'Thank you. We will check your payment against our GCash or bank records, usually within one business day. Your date stays on hold while we check, and we will email you either way.',
          EMAIL_SPAM_NOTICE,
        ],
        details: paymentProofDetails(input),
      },
    ],
  });
}

/** Asks staff to verify a screenshot against Zion's actual GCash or bank records. */
export function paymentProofStaffAlert(
  input: PaymentProofEmailSource & { bookingsUrl: string | null },
): RenderedEmail {
  return renderEmail({
    subject: `Payment screenshot to verify ${input.reference} | ${singleLine(input.clientName, 80)}`,
    preheader: `${input.methodLabel} payment of ${pesos(input.amountCents)} to check against your records.`,
    heading: 'Payment screenshot to verify',
    sections: [
      {
        paragraphs: [
          `A client uploaded a ${input.methodLabel} payment screenshot. Open the booking, compare it with your actual ${input.methodLabel} records, then press Verify payment (the booking confirms itself once the rule is met) or Reject with a reason. A screenshot alone is not proof: it can be edited.`,
          'The date stays held while the screenshot waits for your decision. Reply to this email to contact the client.',
        ],
        details: [
          ['Client', singleLine(input.clientName)],
          ['Email', input.email],
          ['Phone', input.phone],
          ...paymentProofDetails(input),
        ],
      },
    ],
    action: input.bookingsUrl ? { label: 'Open bookings', href: input.bookingsUrl } : undefined,
  });
}

export type DigestEvent = {
  reference: string;
  clientName: string;
  eventType: string;
  startsAt: Date;
};
export type DigestInquiry = {
  reference: string;
  fullName: string;
  eventInterest: string | null;
};

function eventLines(events: DigestEvent[], empty: string) {
  return events.length
    ? events.map(
        (event) =>
          `${manilaTime(event.startsAt)} · ${event.eventType} · ${singleLine(event.clientName, 80)} (${event.reference})`,
      )
    : [empty];
}

export function dailyDigest(input: {
  day: Date;
  today: DigestEvent[];
  tomorrow: DigestEvent[];
  newInquiries: number;
  inquiries: DigestInquiry[];
  awaitingApproval: number;
  /** Requests the system approved that hold their date until the client pays. */
  waitingForPayment: number;
  deadlinesToday: number;
  /** GCash or bank screenshots waiting for staff to check against Zion's records (phase 2). */
  paymentScreenshots: number;
  failedEmails: number;
  adminUrl: string | null;
}): RenderedEmail {
  const inquiryLines = input.inquiries.map(
    (inquiry) =>
      `${inquiry.reference} · ${singleLine(inquiry.fullName, 80)}${inquiry.eventInterest ? ` · ${singleLine(inquiry.eventInterest, 80)}` : ''}`,
  );
  return renderEmail({
    subject: `${BRAND.legalName} | Daily digest | ${manilaDate(input.day)}`,
    preheader: `${input.today.length} event(s) today, ${input.newInquiries} new inquiry(ies), ${input.awaitingApproval} request(s) under review, ${input.waitingForPayment} waiting for payment.`,
    heading: `Daily digest for ${manilaDate(input.day)}`,
    sections: [
      {
        details: [
          ['Confirmed events today', String(input.today.length)],
          ['Confirmed events tomorrow', String(input.tomorrow.length)],
          ['New inquiries (last 24 hours)', String(input.newInquiries)],
          ['Requests under review', String(input.awaitingApproval)],
          ['Waiting for payment', String(input.waitingForPayment)],
          ['Payment deadlines today', String(input.deadlinesToday)],
          ['Payment screenshots to verify', String(input.paymentScreenshots)],
          ['Emails that failed delivery', String(input.failedEmails)],
        ],
      },
      {
        heading: 'Today',
        paragraphs: [eventLines(input.today, 'No confirmed events.').join('\n')],
      },
      {
        heading: 'Tomorrow',
        paragraphs: [eventLines(input.tomorrow, 'No confirmed events.').join('\n')],
      },
      {
        heading: 'New inquiries',
        paragraphs: [
          inquiryLines.length
            ? [
                ...inquiryLines,
                ...(input.newInquiries > inquiryLines.length
                  ? [`and ${input.newInquiries - inquiryLines.length} more in the admin inbox.`]
                  : []),
              ].join('\n')
            : 'No new inquiries in the last 24 hours.',
        ],
      },
      ...(input.failedEmails
        ? [
            {
              paragraphs: [
                `${input.failedEmails} email(s) need attention. Review them on the Automation page of the admin panel.`,
              ],
            },
          ]
        : []),
    ],
    action: input.adminUrl ? { label: 'Open the admin panel', href: input.adminUrl } : undefined,
  });
}

export const VENUE_LOCATION = venueAddress;
