import { AdminError, adminResponse, checkMutationOrigin, requireAdmin } from '@/lib/admin/access';
import { saveStaffClientPhoto } from '@/lib/admin/client-photos';
import { errorMetadata } from '@/lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * A client photo taken or uploaded by staff at the venue, after asking the client and ticking
 * the consent box (docs/client-photos.md). Only roles with the 'client-photos' action.
 */
export async function POST(request: Request) {
  try {
    checkMutationOrigin(request);
    const actor = await requireAdmin({ action: 'client-photos' });
    return adminResponse(await saveStaffClientPhoto(request, actor), 201);
  } catch (error) {
    if (error instanceof AdminError) return adminResponse({ error: error.message }, error.status);
    console.error('Unable to save a client photo.', errorMetadata(error));
    return adminResponse({ error: 'The photo could not be saved right now. Try again.' }, 503);
  }
}
