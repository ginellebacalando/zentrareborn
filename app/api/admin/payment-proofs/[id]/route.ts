import { AdminError, adminResponse, requireAdmin } from '@/lib/admin/access';
import { PAYMENT_PROOF_TYPES } from '@/lib/payment-proof-file';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

/**
 * A client's payment screenshot, for signed-in staff only. The file came from the public, so it
 * is served as an inert, sandboxed document that is never cached or shared: an image shows in
 * the booking detail, and a PDF downloads instead of opening inside the admin panel.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    if (!/^[a-z0-9]{10,40}$/i.test(id)) throw new AdminError('Screenshot not found.', 404);
    const proof = await prisma.adminPaymentProof.findUnique({
      where: { id },
      select: { data: true, contentType: true, booking: { select: { reference: true } } },
    });
    if (!proof || !PAYMENT_PROOF_TYPES.includes(proof.contentType))
      throw new AdminError('Screenshot not found.', 404);
    const pdf = proof.contentType === 'application/pdf';
    const reference = proof.booking.reference.replace(/[^A-Za-z0-9-]/g, '');
    const fileName = `${reference}-payment.${EXTENSIONS[proof.contentType]}`;
    return new Response(Buffer.from(proof.data), {
      headers: {
        'Content-Type': proof.contentType,
        'Content-Disposition': `${pdf ? 'attachment' : 'inline'}; filename="${fileName}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; img-src 'self'; sandbox",
        'Cross-Origin-Resource-Policy': 'same-origin',
        'Referrer-Policy': 'no-referrer',
      },
    });
  } catch (error) {
    if (error instanceof AdminError) return adminResponse({ error: error.message }, error.status);
    console.error('Unable to load a payment screenshot.', error instanceof Error ? error.name : '');
    return adminResponse({ error: 'The screenshot is unavailable right now.' }, 503);
  }
}
