import { scheduleAutomationDelivery } from '@/lib/automation/trigger';
import { requireClientFeature, settingsErrorResponse } from '@/lib/system-settings';
import { readPublicVisitDays, scheduleWebsiteVisit, visitErrorResponse } from '@/services/visits';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// Leaves time for the immediate email attempt that runs after the response (`after()`).
export const maxDuration = 30;

/** The open ocular visit times (dates and times only, never who booked them). */
export async function GET() {
  try {
    return Response.json(await readPublicVisitDays(), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return visitErrorResponse(error);
  }
}

/** Schedules an ocular visit from the public visit page (docs/visits.md). */
export async function POST(request: Request) {
  try {
    // Visits follow the same on/off switch as client inquiries and booking requests (Settings).
    await requireClientFeature('inquirySubmissions');
    const { result, notificationIds } = await scheduleWebsiteVisit(request);
    scheduleAutomationDelivery(notificationIds);
    return Response.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === 'ClientFeatureDisabledError')
      return settingsErrorResponse(error, 'Online visit scheduling is paused right now.');
    return visitErrorResponse(error);
  }
}
