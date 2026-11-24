/** A Manila (UTC+8, no daylight saving) value for datetime-local inputs, e.g. 2026-11-25T14:30. */
export function manilaInput(date: Date = new Date()) {
  return new Date(date.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 16);
}
