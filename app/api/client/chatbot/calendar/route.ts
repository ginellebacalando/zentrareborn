import { ChatRequestError, createChatBudget } from '@/lib/chatbot/request';
import { readCalendarMonth } from '@/services/chatbot/receptionist';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };
const budget = createChatBudget(240);

/**
 * One month of Zeni's calendar card, loaded when the guest opens it: dates that are held or
 * booked, nothing else (docs/chatbot.md). Months outside the booking window are refused, so
 * the card can never read beyond the furthest bookable date.
 */
export async function GET(request: Request) {
  try {
    budget();
  } catch (error) {
    if (error instanceof ChatRequestError)
      return Response.json({ error: error.message }, { status: error.status, headers: NO_STORE });
    throw error;
  }
  const month = new URL(request.url).searchParams.get('month') ?? '';
  try {
    const result = await readCalendarMonth(month);
    if (!result)
      return Response.json(
        { error: 'Choose a month inside the booking window, as YYYY-MM.' },
        { status: 400, headers: NO_STORE },
      );
    return Response.json(result, { headers: NO_STORE });
  } catch {
    console.error('[zeni] A calendar month could not be read.');
    return Response.json(
      { error: 'The calendar is temporarily unavailable.' },
      { status: 503, headers: NO_STORE },
    );
  }
}
