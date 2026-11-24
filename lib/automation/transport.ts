import 'server-only';

import nodemailer, { type SendMailOptions } from 'nodemailer';
import type { CalendarMethod } from './ics';
import type { MailSettings } from './config';

export type OutgoingMail = {
  /** Stable per outbox job so a recipient-side duplicate can be recognized. */
  messageId: string;
  from: { name: string; address: string };
  to: string;
  replyTo?: string | null;
  subject: string;
  text: string;
  html?: string | null;
  calendar?: { method: CalendarMethod; content: string } | null;
};

export type DeliveryReceipt = { accepted: string[]; rejected: string[] };

/** The processor depends on this narrow contract so tests can substitute a fake server. */
export type MailTransport = {
  send(message: OutgoingMail): Promise<DeliveryReceipt>;
  close(): void;
};

function address(entry: string | { address: string }) {
  return typeof entry === 'string' ? entry : entry.address;
}

/** Nodemailer message, including the calendar part Gmail shows as an invitation. */
export function toMailOptions(message: OutgoingMail): SendMailOptions {
  return {
    messageId: message.messageId,
    from: { name: message.from.name, address: message.from.address },
    to: message.to,
    ...(message.replyTo ? { replyTo: message.replyTo } : {}),
    subject: message.subject,
    text: message.text,
    ...(message.html ? { html: message.html } : {}),
    ...(message.calendar
      ? {
          icalEvent: {
            method: message.calendar.method,
            filename: message.calendar.method === 'CANCEL' ? 'cancel.ics' : 'invite.ics',
            content: message.calendar.content,
          },
        }
      : {}),
    // Automatic replies (vacation responders) must not answer system notifications.
    headers: { 'Auto-Submitted': 'auto-generated', 'X-Auto-Response-Suppress': 'All' },
    disableFileAccess: true,
    disableUrlAccess: true,
  };
}

export function createSmtpTransport(
  settings: Extract<MailSettings, { configured: true }>,
): MailTransport {
  const transporter = nodemailer.createTransport({
    pool: true,
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    requireTLS: !settings.secure,
    auth: { user: settings.user, pass: settings.password },
    maxConnections: 1,
    maxMessages: 100,
    rateLimit: 5,
    rateDelta: 1000,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 30_000,
  });
  return {
    async send(message) {
      const info = await transporter.sendMail(toMailOptions(message));
      return {
        accepted: (info.accepted ?? []).map(address),
        rejected: (info.rejected ?? []).map(address),
      };
    },
    close() {
      transporter.close();
    },
  };
}

export type DeliveryFailureKind = 'transient' | 'permanent' | 'configuration' | 'quota';
export type DeliveryFailure = { kind: DeliveryFailureKind; message: string };

const CONFIGURATION_CODES = new Set([
  'EAUTH',
  'ENOAUTH',
  'EOAUTH2',
  'ECONFIG',
  'ETLS',
  'EREQUIRETLS',
]);
const QUOTA_RESPONSE =
  /\b5\.4\.5\b|daily (?:user )?sending (?:quota|limit)|sending limit|rate limit|too many (?:messages|emails)/i;

/** Stored messages never echo the server response, which can contain addresses. */
export function classifyDeliveryError(error: unknown): DeliveryFailure {
  const details = (error && typeof error === 'object' ? error : {}) as {
    code?: unknown;
    responseCode?: unknown;
    response?: unknown;
    permanent?: unknown;
  };
  const code = typeof details.code === 'string' ? details.code : '';
  const responseCode = typeof details.responseCode === 'number' ? details.responseCode : null;
  const response = typeof details.response === 'string' ? details.response : '';
  const reference = responseCode ? `SMTP ${responseCode}` : code || 'unknown error';
  if (QUOTA_RESPONSE.test(response))
    return {
      kind: 'quota',
      message:
        'The mail account reached its sending limit. Delivery continues automatically later.',
    };
  if (CONFIGURATION_CODES.has(code) || [530, 534, 535].includes(responseCode ?? 0))
    return {
      kind: 'configuration',
      message: `The mail server refused the sign-in or connection settings (${reference}). Check SMTP_USER, SMTP_PASSWORD (a Gmail App Password) and SMTP_PORT.`,
    };
  if (
    code === 'EENVELOPE' ||
    details.permanent === true ||
    (responseCode !== null && responseCode >= 500 && responseCode !== 503)
  )
    return {
      kind: 'permanent',
      message: `The mail server rejected this message (${reference}). Check the recipient address before retrying.`,
    };
  return {
    kind: 'transient',
    message: `Temporary delivery problem (${reference}). Retrying automatically.`,
  };
}
