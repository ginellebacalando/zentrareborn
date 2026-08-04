export const VENUE_TIMEZONE = 'Asia/Manila';
export const VENUE_UTC_OFFSET = '+08:00';

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function assertDateKey(value: string) {
  if (!DATE_KEY_PATTERN.test(value)) {
    throw new Error('Date must use YYYY-MM-DD format.');
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error('Date is invalid.');
  }

  return value;
}

export function assertTime(value: string) {
  if (!TIME_PATTERN.test(value)) {
    throw new Error('Time must use 24-hour HH:mm format.');
  }
  return value;
}

export function venueDateTime(dateKey: string, time: string) {
  return new Date(`${assertDateKey(dateKey)}T${assertTime(time)}:00${VENUE_UTC_OFFSET}`);
}

export function venueDayRange(dateKey: string) {
  return {
    start: venueDateTime(dateKey, '00:00'),
    end: venueDateTime(nextDateKey(dateKey), '00:00'),
  };
}

export function nextDateKey(dateKey: string) {
  const date = new Date(`${assertDateKey(dateKey)}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export function minutesFromTime(time: string) {
  const [hour, minute] = assertTime(time).split(':').map(Number);
  return hour * 60 + minute;
}

export function timeFromMinutes(totalMinutes: number) {
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function venueDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: VENUE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function displayTime(time: string) {
  const [hour, minute] = assertTime(time).split(':').map(Number);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, '0')} ${suffix}`;
}
