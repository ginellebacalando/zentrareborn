import { AdminError, adminResponse, checkMutationOrigin, requireAdmin } from '@/lib/admin/access';
import { processAdminNotifications } from '@/lib/admin/notifications';
import { prisma } from '@/lib/prisma';
import { adminRead } from '@/lib/admin/service';

export async function GET() {
  try {
    const actor = await requireAdmin();
    return adminResponse(await adminRead('notifications', new URLSearchParams(), actor));
  } catch (error) {
    return adminResponse(
      {
        error:
          error instanceof AdminError
            ? error.message
            : 'Notifications are temporarily unavailable.',
      },
      error instanceof AdminError ? error.status : 503,
    );
  }
}

export async function POST(request: Request) {
  try {
    checkMutationOrigin(request);
    const actor = await requireAdmin({ page: 'automation', action: 'run-automation' });
    const result = await processAdminNotifications();
    await prisma.auditLog.create({
      data: {
        userId: actor.id,
        userName: actor.fullName || actor.username,
        userRole: actor.role,
        action: 'UPDATE',
        module: 'Notifications',
        description: `Processed ${result.processed} queued notices; ${result.accepted} accepted by the mail server, ${result.retrying} scheduled for retry, ${result.failed} need review. Delivery to the inbox is not assumed.`,
        status: 'SUCCESS',
        source: 'zion-admin',
      },
    });
    return adminResponse(result);
  } catch (error) {
    return adminResponse(
      {
        error: error instanceof AdminError ? error.message : 'Notification dispatch unavailable.',
      },
      error instanceof AdminError ? error.status : 503,
    );
  }
}
