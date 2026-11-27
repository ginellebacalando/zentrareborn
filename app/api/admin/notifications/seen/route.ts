import { z } from 'zod';
import { AdminError, adminResponse, checkMutationOrigin, requireAdmin } from '@/lib/admin/access';
import { afterLook, SEEN_TARGETS } from '@/lib/admin/header-numbers';
import { markSeen } from '@/lib/admin/notification-seen';
import { readNotificationSummary } from '@/lib/admin/service';

const body = z.object({ target: z.enum(SEEN_TARGETS) }).strict();

/**
 * Records that this admin opened the notification bell or Messages, so that header number clears
 * until something new comes in (docs/admin-panel.md, "Header numbers"). Any admin, for themself.
 * The reply is the summary as of the look, with what it revealed, so nothing that arrived since
 * the header's last refresh is counted as seen without being shown.
 */
export async function POST(request: Request) {
  try {
    checkMutationOrigin(request);
    const actor = await requireAdmin();
    const parsed = body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return adminResponse({ error: 'Choose the bell or Messages.' }, 400);
    // Taken before the read: anything arriving while it runs stays new for the next look.
    const at = new Date();
    const summary = await readNotificationSummary(actor);
    await markSeen(actor.id, parsed.data.target, at);
    return adminResponse(afterLook(summary, parsed.data.target));
  } catch (error) {
    return adminResponse(
      { error: error instanceof AdminError ? error.message : 'Your last look was not saved.' },
      error instanceof AdminError ? error.status : 503,
    );
  }
}
