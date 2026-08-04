import 'server-only';

export const EMAIL_SPAM_NOTICE =
  'Delivery notice: If you do not see our next email in your inbox, please check your Spam or Junk folder and mark Zion Events Place as a trusted sender.';

export function requireOutboundWebhookUrl(rawValue: string | undefined, label: string) {
  const value = rawValue?.trim();

  if (!value) {
    throw new Error(`${label} is not configured.`);
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid URL.`);
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`${label} must use HTTP or HTTPS.`);
  }

  if (process.env.NODE_ENV === 'production') {
    const localHosts = new Set(['localhost', '127.0.0.1', '::1']);
    if (url.protocol !== 'https:' || localHosts.has(url.hostname.toLowerCase())) {
      throw new Error(`${label} must use a non-local HTTPS URL in production.`);
    }
  }

  return url.toString();
}

export function requireOutboundWebhookSecret() {
  const secret = process.env.N8N_WEBHOOK_SECRET?.trim();

  if (!secret) {
    throw new Error('N8N_WEBHOOK_SECRET is not configured.');
  }

  return secret;
}

export function webhookTimeoutSignal() {
  const configured = Number(process.env.N8N_WEBHOOK_TIMEOUT_MS ?? 10_000);
  const timeoutMs = Number.isFinite(configured)
    ? Math.min(Math.max(Math.trunc(configured), 1_000), 30_000)
    : 10_000;

  return AbortSignal.timeout(timeoutMs);
}
