/**
 * Contact numbers on the booking page and the Front desk walk-in form: Philippine mobile numbers
 * only, written 09XXXXXXXXX or +639XXXXXXXXX. Spaces and dashes between the digits are allowed
 * ("0917 123 4567") and removed before the number is saved. Browser-safe, so both forms check a
 * number with the same rule their servers apply.
 */
const PHILIPPINE_MOBILE = /^(?:09\d{9}|\+639\d{9})$/;

export const PHILIPPINE_MOBILE_ERROR =
  'Enter a Philippine mobile number, for example 0917 123 4567 or +63 917 123 4567.';

/** The number without spaces or dashes when it is a Philippine mobile number, otherwise null. */
export function philippineMobile(value: string): string | null {
  const compact = value.trim().replace(/[\s-]/g, '');
  return PHILIPPINE_MOBILE.test(compact) ? compact : null;
}
