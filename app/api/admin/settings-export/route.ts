import { AdminError, adminResponse, requireAdmin } from '@/lib/admin/access';
import { activityCsv } from '@/lib/admin/preferences';

export const runtime = 'nodejs';
export async function GET(request: Request) {
  try {
    const actor = await requireAdmin({ page: 'settings', action: 'export-data' });
    const csv = await activityCsv(actor, new URL(request.url).searchParams.get('timeZone'));
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="zion-activity-logs.csv"',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return adminResponse(
      { error: error instanceof AdminError ? error.message : 'Unable to export activity logs.' },
      error instanceof AdminError ? error.status : 503,
    );
  }
}
