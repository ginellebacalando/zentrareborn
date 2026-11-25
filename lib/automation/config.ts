import 'server-only';

import { isEmailAddress } from '@/lib/email-address';
import { STAFF_RECIPIENT_LIMITS, type StaffRecipientSource } from './catalog';

/** Delivery policy. Gmail allows about 500 messages per rolling day on a personal account. */
/** The automation state row that records the last scheduled run (read by the overview). */
export const LAST_RUN_STATE_KEY = 'last-run';

export const AUTOMATION_POLICY = {
  maxAttempts: 5,
  /** Exponential backoff: 2, 8, 32 and 128 minutes, capped at six hours. */
  retryBaseMs: 2 * 60_000,
  retryFactor: 4,
  retryMaxMs: 6 * 60 * 60_000,
  /** A job still PROCESSING after this long may have reached the server; it is never auto-resent. */
  interruptedAfterMs: 10 * 60_000,
  dailySendLimit: 450,
  quotaBackoffMs: 60 * 60_000,
  scheduledBatch: 40,
  scheduledTimeBudgetMs: 45_000,
  immediateBatch: 6,
  immediateTimeBudgetMs: 20_000,
  /** Manual retries get a small fresh budget instead of an unlimited loop. */
  retryExtraAttempts: 3,
  acknowledgementTtlMs: 3 * 24 * 60 * 60_000,
  /** Abuse guards for the public inquiry form; staff still see every inquiry in the admin inbox. */
  acknowledgementsPerRecipientPerDay: 3,
  staffAlertsPerDay: 40,
  inquirySweepLookbackMs: 3 * 24 * 60 * 60_000,
  /** Reminders and the digest are prepared from this Manila hour onward. */
  morningHourManila: 7,
} as const;

export const SMTP_DEFAULT_HOST = 'smtp.gmail.com';
export const SMTP_DEFAULT_PORT = 465;
export const MAIL_NOT_CONFIGURED_MESSAGE =
  'Email is not configured (SMTP_USER and SMTP_PASSWORD). This message is waiting and has not been sent.';

const HOST = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i;

function env(name: string) {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : '';
}

/** Accepts `address@example.com` or `Display Name <address@example.com>`. */
export function parseMailbox(value: string) {
  const match = value.match(/^\s*(?:"?([^"<>\r\n]*?)"?\s*)?<([^<>\s]+)>\s*$/);
  const address = (match ? match[2] : value).trim().toLowerCase();
  if (!isEmailAddress(address)) return null;
  const name = (match?.[1] ?? '').replace(/[\r\n"]/g, '').trim();
  return { name, address };
}

/**
 * The server default for staff inboxes, used while Settings has none: STAFF_NOTIFICATION_EMAIL
 * (comma-separated), else the sending account. The list is all or nothing, and an invalid
 * STAFF_NOTIFICATION_EMAIL disables the default instead of quietly falling back to SMTP_USER.
 */
export function serverStaffRecipients(): { emails: string[]; source: StaffRecipientSource } {
  const configured = env('STAFF_NOTIFICATION_EMAIL');
  const addresses = (configured || env('SMTP_USER'))
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  if (
    !addresses.length ||
    addresses.length > STAFF_RECIPIENT_LIMITS.emails ||
    !addresses.every(isEmailAddress) ||
    addresses.join(', ').length > STAFF_RECIPIENT_LIMITS.listLength
  )
    return { emails: [], source: 'none' };
  return { emails: addresses, source: configured ? 'environment' : 'sending-account' };
}

export type MailSettings =
  | { configured: false; reason: string }
  | {
      configured: true;
      host: string;
      port: number;
      secure: boolean;
      user: string;
      password: string;
      from: { name: string; address: string };
    };

export function readMailSettings(): MailSettings {
  const user = env('SMTP_USER');
  const rawPassword = env('SMTP_PASSWORD');
  if (!user || !rawPassword) return { configured: false, reason: MAIL_NOT_CONFIGURED_MESSAGE };
  const host = (env('SMTP_HOST') || SMTP_DEFAULT_HOST).toLowerCase();
  if (!HOST.test(host))
    return { configured: false, reason: 'SMTP_HOST must be a host name such as smtp.gmail.com.' };
  const port = env('SMTP_PORT') ? Number(env('SMTP_PORT')) : SMTP_DEFAULT_PORT;
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    return { configured: false, reason: 'SMTP_PORT must be a port number such as 465.' };
  const from = parseMailbox(env('MAIL_FROM') || user);
  if (!from)
    return {
      configured: false,
      reason: 'MAIL_FROM must look like "Zion Events Place <address@example.com>".',
    };
  return {
    configured: true,
    host,
    port,
    // 465 uses implicit TLS; other ports must upgrade with STARTTLS (enforced by the transport).
    secure: port === 465,
    user,
    // Google shows App Passwords in groups of four; the spaces are not part of the password.
    password: host === SMTP_DEFAULT_HOST ? rawPassword.replace(/\s+/g, '') : rawPassword,
    from: { name: from.name || 'Zion Events Place', address: from.address },
  };
}

export function isMailConfigured() {
  return readMailSettings().configured;
}

/** Scheduled runs authenticate with `Authorization: Bearer ${CRON_SECRET}`. */
export function readCronSecret() {
  const secret = env('CRON_SECRET');
  return secret.length >= 32 ? secret : null;
}

export function isCronConfigured() {
  return readCronSecret() !== null;
}

/**
 * Public origin used for links in emails: NEXT_PUBLIC_APP_URL or AUTH_URL when set, else the
 * production domain Vercel provides to every deployment (VERCEL_PROJECT_PRODUCTION_URL, a host
 * name without a scheme). Links are left out of emails when none resolves.
 */
export function applicationUrl() {
  const vercelHost = env('VERCEL_PROJECT_PRODUCTION_URL');
  const raw =
    env('NEXT_PUBLIC_APP_URL') || env('AUTH_URL') || (vercelHost ? `https://${vercelHost}` : '');
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return ['http:', 'https:'].includes(url.protocol) ? url.origin : null;
  } catch {
    return null;
  }
}
