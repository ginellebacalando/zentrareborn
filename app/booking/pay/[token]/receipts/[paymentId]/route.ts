import { bookingIdFromPaymentToken } from '@/lib/payment-link';
import { acknowledgmentReceipt, receiptResponse } from '@/lib/payment-receipts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const plain = (message: string, status: number) =>
  new Response(message, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });

/**
 * A client's acknowledgment receipt, linked from their private payment page and payment emails.
 * The signed payment link proves the booking; the receipt must belong to it and not be voided.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string; paymentId: string }> },
) {
  try {
    const { token, paymentId } = await params;
    const bookingId = bookingIdFromPaymentToken(token);
    const receipt = bookingId
      ? await acknowledgmentReceipt(paymentId, { bookingId, includeVoided: false })
      : null;
    return receipt ? receiptResponse(receipt) : plain('Receipt not found.', 404);
  } catch (error) {
    console.error('Unable to prepare a client receipt.', error instanceof Error ? error.name : '');
    return plain('The receipt is unavailable right now. Please try again later.', 503);
  }
}
