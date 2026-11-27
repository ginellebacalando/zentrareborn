import { scheduleAutomationDelivery } from '@/lib/automation/trigger';
import {
  PaymentLinkError,
  paymentLinkErrorResponse,
  requestPaymentLink,
} from '@/services/payment-link-requests';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// Leaves time for the immediate email attempt that runs after the response (`after()`).
export const maxDuration = 30;

/**
 * "Find my payment page": emails the link to a booking's private payment page when the booking
 * reference and email match (services/payment-link-requests.ts). The answer never says whether
 * anything matched.
 */
export async function POST(request: Request) {
  try {
    // Like the screenshot upload: only this site's own form may ask (services/payment-proofs.ts).
    if (request.headers.get('sec-fetch-site') === 'cross-site')
      throw new PaymentLinkError('Ask for your link on Find my payment page.', 403);
    const { notificationIds } = await requestPaymentLink(await request.json());
    scheduleAutomationDelivery(notificationIds);
    return Response.json({ ok: true }, { status: 202 });
  } catch (error) {
    return paymentLinkErrorResponse(error);
  }
}
