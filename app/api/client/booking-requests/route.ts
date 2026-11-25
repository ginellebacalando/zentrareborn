import { scheduleAutomationDelivery } from '@/lib/automation/trigger';
import { requireClientFeature, settingsErrorResponse } from '@/lib/system-settings';
import { bookingRequestErrorResponse, submitBookingRequest } from '@/services/booking-requests';

export const dynamic = 'force-dynamic';
// Leaves time for the immediate email attempt that runs after the response (`after()`).
export const maxDuration = 30;

/** Saves a booking request from the public booking page as an admin booking with status Request. */
export async function POST(request: Request) {
  try {
    // Website requests follow the same on/off switch as client inquiries (Settings).
    await requireClientFeature('inquirySubmissions');
    const result = await submitBookingRequest(request);
    // The staff alert and the client acknowledgement are already saved with the request.
    scheduleAutomationDelivery(result.notificationIds);
    return Response.json({ reference: result.reference }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === 'ClientFeatureDisabledError')
      return settingsErrorResponse(error, 'Online booking requests are paused right now.');
    return bookingRequestErrorResponse(error);
  }
}
