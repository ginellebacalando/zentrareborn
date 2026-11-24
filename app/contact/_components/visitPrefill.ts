import { z } from 'zod';

/**
 * Optional ocular-visit request from a Zeni link: /contact?topic=visit&date=2027-02-14&source=zeni
 * Only `topic=visit` starts a visit request; an invalid or past date is left out, never guessed.
 */
export type VisitPrefill = { subject: string; message: string };

const MAX_DAYS_AHEAD = 366;
const dateSchema = z.iso.date();

function readableDate(date: string) {
  return new Intl.DateTimeFormat('en-PH', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));
}

export function parseVisitPrefill(search: string | URLSearchParams, today: string) {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;
  if (params.get('topic')?.trim().toLowerCase() !== 'visit') return null;
  const date = dateSchema.safeParse(params.get('date')?.trim());
  const days = date.success
    ? (Date.parse(`${date.data}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000
    : -1;
  const preferred = date.success && days >= 0 && days <= MAX_DAYS_AHEAD ? date.data : undefined;
  return {
    subject: 'General Message',
    message: preferred
      ? `I would like to schedule an ocular visit at Zion Events Place. My preferred date is ${readableDate(preferred)}. Please let me know which visiting time is available.`
      : 'I would like to schedule an ocular visit at Zion Events Place. Please let me know which dates and visiting times are available.',
  } satisfies VisitPrefill;
}
