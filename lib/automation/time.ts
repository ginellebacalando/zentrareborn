/** Asia/Manila has no daylight saving time, so a fixed offset gives exact local days. */
const MANILA_OFFSET_MS = 8 * 60 * 60_000;
const DAY_MS = 24 * 60 * 60_000;

/** Calendar day in Manila as `YYYY-MM-DD`. */
export function manilaDay(value: Date) {
  return new Date(value.getTime() + MANILA_OFFSET_MS).toISOString().slice(0, 10);
}

export function manilaHour(value: Date) {
  return new Date(value.getTime() + MANILA_OFFSET_MS).getUTCHours();
}

/** The instant a Manila calendar day begins. */
export function manilaDayStart(day: string) {
  return new Date(`${day}T00:00:00+08:00`);
}

export function addDays(day: string, days: number) {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

export function daysBetween(fromDay: string, toDay: string) {
  return Math.round(
    (Date.parse(`${toDay}T00:00:00Z`) - Date.parse(`${fromDay}T00:00:00Z`)) / DAY_MS,
  );
}

export const ONE_DAY_MS = DAY_MS;
