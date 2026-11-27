import { photoFromViewToken } from '@/lib/client-photo-link';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NOT_FOUND_HEADERS = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' };

/**
 * A client photo (docs/client-photos.md), only through a genuine, unexpired signed address made
 * by the server for staff or for the client themself (lib/client-photo-link.ts). Anything else is
 * not found, so a photo's address cannot be guessed, reused after it expires, or kept after the
 * photo changes or is deleted. The image is served inert and is never cached or shared.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const found = photoFromViewToken(token);
    if (!found) return new Response('Not found', { status: 404, headers: NOT_FOUND_HEADERS });
    const photo = await prisma.adminClientPhoto.findUnique({
      where: { id: found.id },
      select: { data: true, updatedAt: true },
    });
    if (!photo || photo.updatedAt.getTime().toString(36) !== found.version)
      return new Response('Not found', { status: 404, headers: NOT_FOUND_HEADERS });
    return new Response(Buffer.from(photo.data), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Disposition': 'inline; filename="photo.jpg"',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'Cross-Origin-Resource-Policy': 'same-origin',
        'Referrer-Policy': 'no-referrer',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  } catch {
    return new Response('Unavailable', { status: 503, headers: NOT_FOUND_HEADERS });
  }
}
