import 'server-only';

import { BRAND } from '@/config/brand';
import { EMAIL_SPAM_NOTICE } from '@/lib/email-delivery';
import { EMAIL_THEME } from './email-theme';
import type { CalendarMethod } from './ics';

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
}): RenderedEmail {
  const paragraphs = [...input.body.split(/\r?\n\s*\r?\n/), ...(input.extra ?? [])]
    .map((part) => part.trim())
    .filter(Boolean);
  const rendered = renderEmail({
    subject: input.subject,
    preheader: input.heading,
    heading: input.heading,
    sections: [{ paragraphs }],
  });
  // The stored body stays the established notice text, followed by any extra paragraphs.
  return { ...rendered, text: [input.body.trimEnd(), ...(input.extra ?? [])].join('\n\n') };
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

export function bookingRequestStaffAlert(
  input: BookingRequestEmailSource & { bookingsUrl: string | null },
): RenderedEmail {
  const notes = input.notes.length > 2000 ? `${input.notes.slice(0, 1997)}...` : input.notes;
  return renderEmail({
    subject: `New booking request ${input.reference} | ${singleLine(input.clientName, 80)}`,
    preheader: `${singleLine(input.eventType)} on ${manilaDate(input.startsAt)} for ${input.guests} guests.`,
    heading: 'New booking request from the website',
    sections: [
      {
        paragraphs: [
          'A visitor sent a booking request from the website. It is waiting in Bookings as a Request. The date is not reserved until staff approve it and the reservation is confirmed. Reply to this email to answer the client directly.',
        ],
        details: [
          ['Name', singleLine(input.clientName)],
          ['Email', input.email],
          ['Phone', input.phone],
          ...bookingRequestDetails(input),
          ['Submitted', manilaDateTime(input.createdAt)],
        ],
      },
      ...(notes ? [{ heading: 'Notes from the client', paragraphs: [notes] }] : []),
    ],
    action: input.bookingsUrl ? { label: 'Open bookings', href: input.bookingsUrl } : undefined,
  });
}

export function bookingRequestAcknowledgement(input: BookingRequestEmailSource): RenderedEmail {
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

/** A confirmed booking as the staff calendar email describes it. */
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

/** Carries the staff copy of a booking's calendar invitation, or its cancellation. */
export function staffCalendarNotice(
  booking: StaffCalendarBooking,
  method: CalendarMethod,
  bookingsUrl: string | null,
): RenderedEmail {
  const cancelled = method === 'CANCEL';
  const date = manilaDate(booking.startsAt);
  return renderEmail({
    subject: `${cancelled ? 'Cancelled' : 'Confirmed'}: ${singleLine(booking.eventType, 60)} for ${singleLine(booking.clientName, 80)}, ${date}`,
    preheader: cancelled
      ? `Reservation ${booking.reference} was cancelled; the attached update removes it from your calendar.`
      : `Reservation ${booking.reference} is confirmed; the attached invitation adds it to your calendar.`,
    heading: cancelled ? 'Confirmed reservation cancelled' : 'Reservation confirmed',
    sections: [
      {
        paragraphs: [
          cancelled
            ? 'This confirmed reservation was cancelled. The calendar update (cancel.ics) removes the event from calendars that received its invitation.'
            : 'This reservation is confirmed. A calendar invitation (invite.ics) is attached so the event appears in your calendar.',
          'Reply to this email to contact the client.',
        ],
        details: [
          ['Reservation', booking.reference],
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
  failedEmails: number;
  adminUrl: string | null;
}): RenderedEmail {
  const inquiryLines = input.inquiries.map(
    (inquiry) =>
      `${inquiry.reference} · ${singleLine(inquiry.fullName, 80)}${inquiry.eventInterest ? ` · ${singleLine(inquiry.eventInterest, 80)}` : ''}`,
  );
  return renderEmail({
    subject: `${BRAND.legalName} | Daily digest | ${manilaDate(input.day)}`,
    preheader: `${input.today.length} event(s) today, ${input.newInquiries} new inquiry(ies), ${input.awaitingApproval} request(s) awaiting approval.`,
    heading: `Daily digest for ${manilaDate(input.day)}`,
    sections: [
      {
        details: [
          ['Confirmed events today', String(input.today.length)],
          ['Confirmed events tomorrow', String(input.tomorrow.length)],
          ['New inquiries (last 24 hours)', String(input.newInquiries)],
          ['Requests awaiting approval', String(input.awaitingApproval)],
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
