import { z } from 'zod';
import { readPublicDateAvailability } from '@/lib/public-availability';

export const dynamic = 'force-dynamic';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const query = z.object({ from: isoDate, to: isoDate });
const MAX_SPAN_DAYS = 400;

/** Booked and inquired dates for the booking date picker (dates only, no client details). */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const parsed = query.safeParse({ from: params.get('from'), to: params.get('to') });
  if (!parsed.success) {
    return Response.json({ error: 'Use from and to dates as YYYY-MM-DD.' }, { status: 400 });
  }
  const { from, to } = parsed.data;
  const spanDays = (Date.parse(to) - Date.parse(from)) / 86_400_000;
  if (!Number.isFinite(spanDays) || spanDays < 0 || spanDays > MAX_SPAN_DAYS) {
    return Response.json({ error: 'Choose a range of up to 400 days.' }, { status: 400 });
  }
  try {
    return Response.json(await readPublicDateAvailability(from, to), {
      headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' },
    });
  } catch {
    return Response.json({ error: 'Availability is temporarily unavailable.' }, { status: 503 });
  }
}
