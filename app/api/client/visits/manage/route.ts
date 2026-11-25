import { scheduleAutomationDelivery } from '@/lib/automation/trigger';
import { manageWebsiteVisit, visitErrorResponse } from '@/services/visits';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// Leaves time for the immediate email attempt that runs after the response (`after()`).
export const maxDuration = 30;

/** Moves or cancels an ocular visit from its private manage link (docs/visits.md). */
export async function POST(request: Request) {
  try {
    const { result, notificationIds } = await manageWebsiteVisit(request);
    scheduleAutomationDelivery(notificationIds);
    return Response.json(result);
  } catch (error) {
    return visitErrorResponse(error);
  }
}
