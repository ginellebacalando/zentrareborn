import { scheduleAutomationDelivery } from '@/lib/automation/trigger';
import { inquiryErrorResponse, submitInquiry } from '@/lib/inquiry-service';
import { requireClientFeature, settingsErrorResponse } from '@/lib/system-settings';

export const dynamic = 'force-dynamic';
// Leaves time for the immediate email attempt that runs after the response (`after()`).
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    await requireClientFeature('inquirySubmissions');
    const result = await submitInquiry(request);
    // The staff alert and acknowledgement are already saved in the outbox with the inquiry.
    scheduleAutomationDelivery(result.notificationIds);
    return Response.json(
      {
        id: result.id,
        inquiryReference: result.inquiryReference,
        message: result.message,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'ClientFeatureDisabledError') {
      return settingsErrorResponse(error, 'Unable to submit your inquiry.');
    }

    return inquiryErrorResponse(error, 'Unable to submit your inquiry.');
  }
}
