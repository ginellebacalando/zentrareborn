import 'server-only';

import { BRAND } from '@/config/brand';
import { EMAIL_SPAM_NOTICE } from '@/lib/email-delivery';
import { applicationUrl } from './config';
import { EMAIL_THEME, type EmailTone } from './email-theme';

/** A rendered message: HTML for capable clients and a complete plain-text alternative. */
export type RenderedEmail = { subject: string; text: string; html: string };
export type EmailDetail = readonly [label: string, value: string];
export type EmailSection = {
  heading?: string;
  paragraphs?: string[];
  details?: EmailDetail[];
  summary?: EmailSummary;
};

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
const AUTOMATED_NOTE = 'This is an automated message from the Zion Events Place system.';
const footerLines = [
  BRAND.legalName,
  ...BRAND.address.lines,
  `${BRAND.contact.phone} · ${BRAND.contact.email}`,
  AUTOMATED_NOTE,
];

const T = EMAIL_THEME;
const HAIRLINE = `1px solid ${T.line}`;
// One line height for labels and values, so their baselines line up across a row.
const LABEL = `font-size:13px;line-height:22px;color:${T.muted};`;
const VALUE = `font-size:15px;line-height:22px;color:${T.text};`;
const PANEL = `background:${T.surface};border-radius:12px;`;
const LINK = `color:${T.brand};text-decoration:underline;`;
/** Keeps the mail app's inbox preview to the preheader instead of the text that follows it. */
const PREHEADER_FILL = '&#847;&zwnj;&nbsp;'.repeat(40);

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Escaped text with line breaks kept; any emphasis phrase (an amount, a deadline) is set in bold.
 * Phrases are matched in one pass, longest first, so a bolded phrase is never matched again.
 */
function richText(text: string, emphasis: readonly string[] = []) {
  const html = escapeHtml(text).replace(/\r?\n/g, '<br>');
  const phrases = emphasis
    .map((phrase) => escapeHtml(phrase.trim()))
    .filter((phrase) => phrase.length > 2)
    .sort((a, b) => b.length - a.length);
  if (!phrases.length) return html;
  return html.replace(
    new RegExp(phrases.map(escapeRegExp).join('|'), 'g'),
    (match) => `<strong style="color:${T.text};">${match}</strong>`,
  );
}

function paragraphHtml(text: string, emphasis?: readonly string[]) {
  return `<p style="margin:0 0 16px;">${richText(text, emphasis)}</p>`;
}

const EMAIL_ADDRESS = /^[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,}$/i;
const PHONE_NUMBER = /^\+?\d[\d\s-]{6,18}\d$/;
const WEB_LINK = /^https?:\/\/\S+$/i;

/** What a link in the details reads as: maps links say so, other links show their site. */
function linkText(href: string) {
  try {
    const url = new URL(href);
    const maps =
      url.hostname === 'maps.app.goo.gl' ||
      (/(^|\.)google\.[a-z.]+$/.test(url.hostname) && url.pathname.startsWith('/maps'));
    return maps ? 'Open in Google Maps' : url.hostname.replace(/^www\./, '');
  } catch {
    return href;
  }
}

/**
 * A detail value; one that is wholly an email address, a phone number or a web address becomes a
 * link in the brand color, so mail apps do not style it in their own blue.
 */
function valueHtml(value: string) {
  const text = value.trim();
  if (EMAIL_ADDRESS.test(text))
    return `<a href="mailto:${escapeHtml(text)}" style="${LINK}">${escapeHtml(text)}</a>`;
  const digits = text.replace(/\D/g, '');
  if (PHONE_NUMBER.test(text) && digits.length >= 10 && digits.length <= 13)
    return `<a href="tel:${escapeHtml(text.startsWith('+') ? `+${digits}` : digits)}" style="${LINK}">${escapeHtml(text)}</a>`;
  if (WEB_LINK.test(text))
    return `<a href="${escapeHtml(text)}" style="${LINK}">${escapeHtml(linkText(text))}</a>`;
  return richText(value);
}

/**
 * Label and value rows on a soft panel, a hairline between rows; rows stack on small screens.
 * A list of counts (the daily digest) reads as a tally instead: the label in full on the left and
 * the number in bold on the right, side by side at every width.
 */
function detailsHtml(details: EmailDetail[]) {
  const shown = details.filter(([, value]) => value.trim());
  const tally = shown.every(([, value]) => /^\d[\d,]*$/.test(value.trim()));
  const rows = shown.map(([label, value], index) => {
    const rule = index ? `border-top:${HAIRLINE};` : '';
    return tally
      ? `<tr><th scope="row" align="left" valign="top" style="padding:10px 16px 10px 0;${rule}${LABEL}font-weight:normal;">${escapeHtml(label)}</th><td align="right" valign="top" style="padding:10px 0;${rule}${VALUE}font-weight:bold;white-space:nowrap;">${escapeHtml(value.trim())}</td></tr>`
      : `<tr class="zentra-row"><th scope="row" align="left" valign="top" width="34%" style="padding:12px 16px 12px 0;${rule}${LABEL}font-weight:normal;">${escapeHtml(label)}</th><td valign="top" style="padding:12px 0;${rule}${VALUE}">${valueHtml(value)}</td></tr>`;
  });
  return rows.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 28px;${PANEL}"><tr><td class="zentra-panel" style="padding:6px 24px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${rows.join('')}</table></td></tr></table>`
    : '';
}

/** A booking at a glance: its reference, status badges and the payment breakdown. */
export type EmailSummary = {
  reference: string;
  statuses: readonly { label: string; value: string; tone: EmailTone }[];
  /** `total` marks the closing line (the balance), set apart and in bold. */
  amounts: readonly { label: string; value: string; total?: boolean }[];
};

function badgeHtml(value: string, tone: EmailTone) {
  const colors = T.tones[tone];
  return `<span style="display:inline-block;padding:3px 12px;border-radius:999px;background:${colors.background};color:${colors.text};font-size:13px;line-height:1.5;font-weight:bold;white-space:nowrap;">${escapeHtml(value)}</span>`;
}

function rowsTable(rows: string[]) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${rows.join('')}</table>`;
}

function summaryHtml(summary: EmailSummary) {
  const statuses = summary.statuses.map(
    ({ label, value, tone }) =>
      `<tr><td style="padding:8px 0;${LABEL}">${escapeHtml(label)}</td><td align="right" style="padding:8px 0;">${badgeHtml(value, tone)}</td></tr>`,
  );
  const amounts = summary.amounts.map(({ label, value, total }) => {
    const accent = total
      ? `padding-top:14px;border-top:${HAIRLINE};font-size:16px;font-weight:bold;color:${T.text};`
      : '';
    return `<tr><td style="padding:6px 0;${LABEL}${accent}">${escapeHtml(label)}</td><td align="right" style="padding:6px 0;${VALUE}white-space:nowrap;${accent}">${escapeHtml(value)}</td></tr>`;
  });
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 28px;${PANEL}">
<tr><td class="zentra-panel" style="padding:22px 24px 18px;"><div style="font-size:12px;line-height:1.4;letter-spacing:1.5px;text-transform:uppercase;color:${T.muted};">Booking reference</div><div style="margin-top:6px;font-size:20px;line-height:1.3;font-weight:bold;letter-spacing:0.5px;color:${T.text};">${escapeHtml(summary.reference)}</div></td></tr>
${statuses.length ? `<tr><td class="zentra-panel" style="padding:10px 24px;border-top:${HAIRLINE};">${rowsTable(statuses)}</td></tr>` : ''}
${amounts.length ? `<tr><td class="zentra-panel" style="padding:10px 24px 18px;border-top:${HAIRLINE};">${rowsTable(amounts)}</td></tr>` : ''}
</table>`;
}

function sectionHtml(section: EmailSection, emphasis: readonly string[]) {
  return [
    section.heading
      ? `<h2 style="margin:32px 0 12px;font-size:16px;line-height:1.4;font-weight:bold;color:${T.text};">${escapeHtml(section.heading)}</h2>`
      : '',
    ...(section.paragraphs ?? []).map((text) => paragraphHtml(text, emphasis)),
    section.summary ? summaryHtml(section.summary) : '',
    detailsHtml(section.details ?? []),
  ].join('');
}

function sectionText(section: EmailSection) {
  const details = (section.details ?? [])
    .filter(([, value]) => value.trim())
    .map(([label, value]) => `${label}: ${value}`);
  const summary = section.summary
    ? [
        `Booking reference: ${section.summary.reference}`,
        ...section.summary.statuses.map(({ label, value }) => `${label}: ${value}`),
        ...section.summary.amounts.map(({ label, value }) => `${label}: ${value}`),
      ].join('\n')
    : '';
  return [
    section.heading
      ? `${section.heading}\n${'-'.repeat(Math.min(section.heading.length, 60))}`
      : '',
    ...(section.paragraphs ?? []),
    summary,
    details.join('\n'),
  ]
    .filter(Boolean)
    .join('\n\n');
}

/**
 * The centered header logo: the ZENTRA wordmark from the site's own address, linked to the site.
 * Without a known address (local runs, tests) the wordmark is set in type instead; the same type
 * styles the alternative text when a mail app blocks images.
 */
function logoHtml() {
  const origin = applicationUrl();
  const name = escapeHtml(T.wordmark);
  const type = `font-family:${T.wordmarkFont};font-size:28px;line-height:1.1;letter-spacing:6px;font-weight:bold;color:${T.brand};`;
  if (!origin) return `<div style="${type}">${name}</div>`;
  const { path, width, height } = T.logo;
  return `<a href="${escapeHtml(origin)}" style="display:inline-block;text-decoration:none;"><img src="${escapeHtml(`${origin}${path}`)}" width="${width}" height="${height}" alt="${name}" style="display:block;margin:0 auto;border:0;outline:none;text-decoration:none;${type}"></a>`;
}

const footerHtml = [
  `<div style="margin-bottom:4px;font-size:13px;font-weight:bold;color:${T.text};">${escapeHtml(BRAND.legalName)}</div>`,
  `<div>${escapeHtml(BRAND.address.lines.join(', '))}</div>`,
  `<div><a href="${escapeHtml(BRAND.contact.phoneHref)}" style="color:${T.muted};text-decoration:none;">${escapeHtml(BRAND.contact.phone)}</a> &nbsp;·&nbsp; <a href="${escapeHtml(BRAND.contact.emailHref)}" style="color:${T.muted};text-decoration:underline;">${escapeHtml(BRAND.contact.email)}</a></div>`,
  `<div style="margin-top:12px;">${escapeHtml(AUTOMATED_NOTE)}</div>`,
].join('\n');

/** Small-screen and mail-app adjustments; every essential style is also inline. */
const EMAIL_STYLE = `a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; font-size: inherit !important; font-family: inherit !important; font-weight: inherit !important; line-height: inherit !important; }
@media (max-width: 600px) {
  .zentra-outer { padding: 20px 10px !important; }
  .zentra-pad { padding-left: 22px !important; padding-right: 22px !important; }
  .zentra-panel { padding-left: 18px !important; padding-right: 18px !important; }
  .zentra-h1 { font-size: 22px !important; }
  .zentra-row th, .zentra-row td { display: block !important; width: auto !important; }
  .zentra-row th { padding: 12px 0 0 !important; }
  .zentra-row td { padding: 2px 0 12px !important; border-top: 0 !important; }
  .zentra-button { width: 100% !important; }
  .zentra-button a { display: block !important; text-align: center !important; }
}`;

/**
 * Branded layout shared by every automated email: a white card with the ZENTRA logo and the venue
 * name centered at the top, then the heading, sections (paragraphs, a booking summary, label and
 * value panels), one button and an optional closing note; the venue's address and contacts sit
 * centered below the card.
 */
export function renderEmail(input: {
  subject: string;
  preheader: string;
  heading: string;
  sections: EmailSection[];
  action?: { label: string; href: string };
  /** A short closing note in small type after the button, such as what approval does not mean. */
  note?: string;
  /** Phrases set in bold wherever they appear in the paragraphs: amounts, deadlines. */
  emphasis?: readonly string[];
}): RenderedEmail {
  const subject = singleLine(input.subject, 200);
  const emphasis = input.emphasis ?? [];
  // A border-drawn button keeps its shape in Outlook, which ignores padding on links.
  const action = input.action
    ? `<table role="presentation" class="zentra-button" cellpadding="0" cellspacing="0" style="margin:12px 0 8px;"><tr><td align="center" style="border-radius:10px;background:${T.brand};"><a href="${escapeHtml(input.action.href)}" style="display:inline-block;border-top:14px solid ${T.brand};border-bottom:14px solid ${T.brand};border-left:28px solid ${T.brand};border-right:28px solid ${T.brand};border-radius:10px;background:${T.brand};font-family:${T.bodyFont};font-size:15px;line-height:1.2;font-weight:bold;color:${T.onBrand};text-decoration:none;">${escapeHtml(input.action.label)}</a></td></tr></table>`
    : '';
  const note = input.note
    ? `<p style="margin:28px 0 0;padding-top:20px;border-top:${HAIRLINE};font-size:13px;line-height:1.6;color:${T.muted};">${richText(input.note)}</p>`
    : '';
  const html = `<!doctype html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no, url=no">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(subject)}</title>
<style>
${EMAIL_STYLE}
</style>
</head>
<body style="margin:0;padding:0;width:100%;background:${T.canvas};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
<div role="article" aria-roledescription="email" aria-label="${escapeHtml(subject)}" lang="en" dir="ltr" style="background:${T.canvas};">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;">${escapeHtml(input.preheader)}${PREHEADER_FILL}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${T.canvas};">
<tr><td class="zentra-outer" align="center" style="padding:40px 16px;">
<!--[if mso]><table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:${T.background};border:${HAIRLINE};border-radius:16px;font-family:${T.bodyFont};">
<tr><td class="zentra-pad" align="center" style="padding:24px 40px 26px;border-bottom:${HAIRLINE};">
${logoHtml()}
<div style="margin-top:6px;font-size:12px;line-height:1.4;letter-spacing:3px;text-transform:uppercase;color:${T.muted};">${escapeHtml(BRAND.legalName)}</div>
</td></tr>
<tr><td class="zentra-pad" style="padding:36px 40px 28px;font-size:15px;line-height:1.65;color:${T.text};">
<h1 class="zentra-h1" style="margin:0 0 16px;font-size:24px;line-height:1.3;font-weight:bold;letter-spacing:-0.2px;color:${T.text};">${escapeHtml(input.heading)}</h1>
${input.sections.map((section) => sectionHtml(section, emphasis)).join('\n')}
${action}
${note}
</td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
<tr><td class="zentra-pad" align="center" style="padding:28px 40px 8px;font-family:${T.bodyFont};font-size:12px;line-height:1.7;color:${T.muted};">
${footerHtml}
</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</div>
</body>
</html>`;
  const text = [
    `${T.wordmark}\n${BRAND.legalName}\n${'='.repeat(BRAND.legalName.length)}`,
    input.heading,
    ...input.sections.map(sectionText).filter(Boolean),
    input.action ? `${input.action.label}: ${input.action.href}` : '',
    input.note ?? '',
    `--\n${footerLines.join('\n')}`,
  ]
    .filter(Boolean)
    .join('\n\n');
  return { subject, text: `${text}\n`, html };
}

/**
 * A booking notice (lib/admin/domain.ts bookingEmail) in parts. The HTML shows the status at a
 * glance; the plain-text alternative stays the established notice text.
 */
export type BookingNoticeParts = {
  greeting: string;
  lead: string | null;
  reference: string;
  /** Booking states as stored (APPROVED, REQUESTED, UNPAID, ...); shown as badges. */
  approval: string;
  reservation: string;
  payment: string;
  total: string;
  /** The reservation fee, when the venue asks for one. */
  fee: string | null;
  received: string;
  balance: string;
  requirement: string;
  instructions: string;
  closing: string;
  /** Amounts and deadlines to set in bold. */
  emphasis: string[];
};

const STATUS_BADGES: Record<string, { value: string; tone: EmailTone }> = {
  PENDING: { value: 'Pending review', tone: 'waiting' },
  APPROVED: { value: 'Approved', tone: 'positive' },
  REJECTED: { value: 'Declined', tone: 'negative' },
  DECLINED: { value: 'Declined', tone: 'negative' },
  REQUESTED: { value: 'Requested', tone: 'waiting' },
  CONFIRMED: { value: 'Confirmed', tone: 'positive' },
  CANCELLED: { value: 'Cancelled', tone: 'negative' },
  EXPIRED: { value: 'Expired', tone: 'negative' },
  COMPLETED: { value: 'Completed', tone: 'neutral' },
  PAID: { value: 'Paid', tone: 'positive' },
  PARTIAL: { value: 'Partly paid', tone: 'waiting' },
  UNPAID: { value: 'Unpaid', tone: 'attention' },
};

function statusBadge(label: string, state: string) {
  const known = STATUS_BADGES[state];
  if (known) return { label, ...known };
  const words = state.replaceAll('_', ' ').toLowerCase();
  return { label, value: words.charAt(0).toUpperCase() + words.slice(1), tone: 'neutral' as const };
}

export function renderBookingNotice(input: {
  subject: string;
  heading: string;
  notice: { body: string; parts: BookingNoticeParts };
  /** Further paragraphs, such as the calendar invitation note. */
  extra?: string[];
  /** A button, for example to the client's private payment page. */
  action?: { label: string; href: string };
}): RenderedEmail {
  const { body, parts } = input.notice;
  const rendered = renderEmail({
    subject: input.subject,
    preheader: parts.lead ?? `${input.heading} for booking ${parts.reference}.`,
    heading: input.heading,
    emphasis: parts.emphasis,
    sections: [
      {
        paragraphs: [parts.greeting, parts.lead ?? ''].filter(Boolean),
        summary: {
          reference: parts.reference,
          statuses: [
            statusBadge('Approval', parts.approval),
            statusBadge('Reservation', parts.reservation),
            statusBadge('Payment', parts.payment),
          ],
          amounts: [
            { label: 'Total', value: parts.total },
            ...(parts.fee ? [{ label: 'Reservation fee', value: parts.fee }] : []),
            { label: 'Received', value: parts.received },
            { label: 'Balance', value: parts.balance, total: true },
          ],
        },
      },
      {
        paragraphs: [parts.requirement, parts.instructions, ...(input.extra ?? [])]
          .map((part) => part.trim())
          .filter(Boolean),
      },
    ],
    action: input.action,
    note: parts.closing,
  });
  // The stored body stays the established notice text, followed by any extra paragraphs and the
  // action's link, so plain-text mail readers see the link too.
  const link = input.action ? [`${input.action.label}: ${input.action.href}`] : [];
  return {
    ...rendered,
    text: [body.trimEnd(), ...(input.extra ?? []), ...link].join('\n\n'),
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

/** An invitation to the admin panel (lib/admin/team.ts): the link lets the person set a password. */
export function teamInvitationEmail(input: {
  fullName: string;
  roleLabel: string;
  invitedBy: string;
  link: string;
  expiresAt: Date;
}): RenderedEmail {
  const name = greetingName(input.fullName);
  const expires = manilaDateTime(input.expiresAt);
  return renderEmail({
    subject: `${BRAND.legalName} | Your admin panel invitation`,
    preheader: `${singleLine(input.invitedBy, 80)} invited you to the ZENTRA admin panel. Set up your account before ${expires}.`,
    heading: 'You are invited to the admin panel',
    sections: [
      {
        paragraphs: [
          name ? `Hello ${name},` : 'Hello,',
          `${singleLine(input.invitedBy, 80)} invited you to manage bookings and visits for ${BRAND.legalName} in the ZENTRA admin panel.`,
          'Use the button below to choose your password. The link works once and only for you, so please do not forward this email.',
        ],
        details: [
          ['Role', input.roleLabel],
          ['Invited by', singleLine(input.invitedBy, 80)],
          ['Link expires', `${expires} (Manila time)`],
        ],
      },
    ],
    action: { label: 'Set up your account', href: input.link },
    note: 'If you did not expect this invitation, you can ignore this email; no account opens until the link is used.',
    emphasis: [expires],
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
  /** The button to the client's private payment page (phase 2), when the site's address is known. */
  paymentAction?: { label: string; href: string } | null;
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
    action: outcome.paymentAction ?? undefined,
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
    /** The button to the client's private payment page (phase 2). */
    paymentAction?: { label: string; href: string } | null;
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
    action: booking.paymentAction ?? undefined,
  });
}

/**
 * Reminds a client with a confirmed booking to pay the rest before the full-payment date in
 * Zion's terms (phase 3): a week and a day before that date.
 */
export function balanceReminder(
  booking: ReminderBooking & {
    dueAt: Date;
    balanceCents: number;
    instructions: string;
    paymentAction?: { label: string; href: string } | null;
  },
): RenderedEmail {
  const name = greetingName(booking.clientName);
  const due = manilaDate(booking.dueAt);
  const amount = pesos(booking.balanceCents);
  return renderEmail({
    subject: `${BRAND.legalName} | Balance reminder | ${booking.reference}`,
    preheader: `Please pay the remaining ${amount} by ${due}.`,
    heading: 'Your remaining balance is due soon',
    sections: [
      {
        paragraphs: [
          name ? `Hello ${name},` : 'Hello,',
          `Your ${singleLine(booking.eventType)} reservation is confirmed. Please pay the remaining balance of ${amount} by ${due}, as our terms ask for full payment before the event.`,
          booking.instructions,
          `Questions? Call ${BRAND.contact.phone} or email ${BRAND.contact.email} and mention your booking reference.`,
        ].filter(Boolean),
        details: [
          ['Booking reference', booking.reference],
          ['Event date', manilaDate(booking.startsAt)],
          [
            'Time',
            `${manilaTime(booking.startsAt)} to ${manilaTime(booking.endsAt)} (Manila time)`,
          ],
          ['Remaining balance', amount],
          ['Pay by', due],
        ],
      },
    ],
    action: booking.paymentAction ?? undefined,
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
  /** The reservation fee of a held date, or the balance of a confirmed booking (phase 3). */
  stage: 'fee' | 'balance';
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
          input.stage === 'balance'
            ? 'Thank you. We will check your payment against our GCash or bank records, usually within one business day, and email you either way. Your reservation stays confirmed.'
            : 'Thank you. We will check your payment against our GCash or bank records, usually within one business day. Your date stays on hold while we check, and we will email you either way.',
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
          input.stage === 'balance'
            ? `A client uploaded a ${input.methodLabel} screenshot for the balance of a confirmed booking. Open the booking, compare it with your actual ${input.methodLabel} records, then press Verify payment or Reject with a reason. A screenshot alone is not proof: it can be edited.`
            : `A client uploaded a ${input.methodLabel} payment screenshot. Open the booking, compare it with your actual ${input.methodLabel} records, then press Verify payment (the booking confirms itself once the rule is met) or Reject with a reason. A screenshot alone is not proof: it can be edited.`,
          input.stage === 'balance'
            ? 'Reply to this email to contact the client.'
            : 'The date stays held while the screenshot waits for your decision. Reply to this email to contact the client.',
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

export type DigestVisit = { reference: string; clientName: string; startsAt: Date };

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
  /** Ocular visits scheduled for today (docs/visits.md). */
  visits?: DigestVisit[];
  adminUrl: string | null;
}): RenderedEmail {
  const visits = input.visits ?? [];
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
          ['Ocular visits today', String(visits.length)],
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
        heading: 'Ocular visits today',
        paragraphs: [
          visits.length
            ? visits
                .map(
                  (visit) =>
                    `${manilaTime(visit.startsAt)} · ${singleLine(visit.clientName, 80)} (${visit.reference})`,
                )
                .join('\n')
            : 'No visits scheduled.',
        ],
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
