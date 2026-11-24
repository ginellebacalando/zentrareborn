const EMAIL_IN_TEXT = /[^\s@<>"'(),;:]+@[^\s@<>"'(),;:]+\.[^\s@<>"'(),;:]+/g;

/** `juan@gmail.com` becomes `j***@gmail.com`; the domain stays visible for delivery triage. */
export function maskEmail(value: string) {
  const address = value.trim();
  const at = address.lastIndexOf('@');
  if (at < 1 || at === address.length - 1) return address ? '***' : '';
  return `${address[0]}***${address.slice(at)}`;
}

/** Masks a single address or a comma-separated list of addresses. */
export function maskRecipients(value: string) {
  return value
    .split(',')
    .map((part) => maskEmail(part))
    .filter(Boolean)
    .join(', ');
}

/**
 * Stored delivery errors are written from fixed messages, but legacy rows may contain provider
 * text. Display only a bounded, single-line message with any email address masked.
 */
export function sanitizeErrorMessage(value: string | null | undefined) {
  if (!value) return null;
  const singleLine = value
    .replace(/[\p{Cc}\s]+/gu, ' ')
    .replace(EMAIL_IN_TEXT, (match) => maskEmail(match))
    .trim();
  return singleLine.length > 300 ? `${singleLine.slice(0, 297)}...` : singleLine;
}
