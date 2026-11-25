/**
 * The address shape every automated recipient must have: outbox recipients, calendar
 * participants and the staff notification setting. It rejects whitespace and the characters that
 * could break out of an email header or a calendar property. Browser-safe, so the admin Settings
 * form checks addresses with the same rule the server applies.
 */
export const EMAIL_ADDRESS_PATTERN =
  /^[^\s@<>"(),:;\\[\]]+@[^\s@<>"(),:;\\[\]]+\.[^\s@<>"(),:;\\[\]]+$/;

/** The longest address a mail server accepts (the RFC 5321 path limit). */
export const MAX_EMAIL_ADDRESS_LENGTH = 254;

export function isEmailAddress(value: string) {
  return value.length <= MAX_EMAIL_ADDRESS_LENGTH && EMAIL_ADDRESS_PATTERN.test(value);
}
