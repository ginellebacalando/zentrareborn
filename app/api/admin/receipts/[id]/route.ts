import { AdminError, adminResponse, requireAdmin } from '@/lib/admin/access';
import { acknowledgmentReceipt, receiptResponse } from '@/lib/payment-receipts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** A payment's acknowledgment receipt (PDF) for signed-in staff; a voided one is marked voided. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin({ page: 'payments' });
    const { id } = await params;
    const receipt = await acknowledgmentReceipt(id, { includeVoided: true });
    if (!receipt) throw new AdminError('Receipt not found.', 404);
    return receiptResponse(receipt);
  } catch (error) {
    if (error instanceof AdminError) return adminResponse({ error: error.message }, error.status);
    console.error('Unable to prepare a receipt.', error instanceof Error ? error.name : '');
    return adminResponse({ error: 'The receipt is unavailable right now.' }, 503);
  }
}
