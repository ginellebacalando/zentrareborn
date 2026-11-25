import { onlinePaymentsOffered } from '@/lib/automation/payment-proofs';
import { scheduleAutomationDelivery } from '@/lib/automation/trigger';
import { paymentPagePath } from '@/lib/payment-link';
import { prisma } from '@/lib/prisma';
import { requireClientFeature, settingsErrorResponse } from '@/lib/system-settings';
import { bookingRequestErrorResponse, submitBookingRequest } from '@/services/booking-requests';

export const dynamic = 'force-dynamic';
// Leaves time for the immediate email attempt that runs after the response (`after()`).
export const maxDuration = 30;

/**
 * Saves a booking request from the public booking page. The response tells the page whether the
 * date is now held until a payment deadline or waits for staff review (docs/booking-automation.md).
 */
export async function POST(request: Request) {
  try {
    // Website requests follow the same on/off switch as client inquiries (Settings).
    await requireClientFeature('inquirySubmissions');
    const result = await submitBookingRequest(request);
    // The staff alert and the client acknowledgement are already saved with the request.
    scheduleAutomationDelivery(result.notificationIds);
    const held = Boolean(result.holdExpiresAt);
    return Response.json(
      {
        reference: result.reference,
        holdExpiresAt: result.holdExpiresAt?.toISOString() ?? null,
        amountDueCents: result.holdExpiresAt ? result.amountDueCents : null,
        // The client's private payment page, so they can pay before the email arrives.
        paymentPath: held ? paymentPagePath(result.id) : null,
        // Whether that page takes GCash or bank transfer screenshots, or shows cash only.
        onlinePayment: held ? await onlinePaymentsOffered(prisma) : false,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'ClientFeatureDisabledError')
      return settingsErrorResponse(error, 'Online booking requests are paused right now.');
    return bookingRequestErrorResponse(error);
  }
}
