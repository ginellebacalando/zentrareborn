import { scheduleAutomationDelivery } from '@/lib/automation/trigger';
import { paymentProofErrorResponse, submitPaymentProof } from '@/services/payment-proofs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// Leaves time for the immediate email attempt that runs after the response (`after()`).
export const maxDuration = 30;

/** Receives a client's GCash or bank transfer screenshot from their private payment page. */
export async function POST(request: Request) {
  try {
    const result = await submitPaymentProof(request);
    scheduleAutomationDelivery(result.notificationIds);
    return Response.json({ status: result.status }, { status: 201 });
  } catch (error) {
    return paymentProofErrorResponse(error);
  }
}
