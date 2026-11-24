import { isAuthorizedCronRequest } from '@/lib/automation/cron-auth';
import { runAutomation } from '@/lib/automation/run';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// Vercel Hobby allows up to 60 seconds; the run stops claiming new jobs well before that.
export const maxDuration = 60;

const noStore = { 'Cache-Control': 'no-store, max-age=0' };

/** Scheduled automation: Vercel Cron (GET) or Supabase pg_cron + pg_net (POST). Counts only. */
async function handle(request: Request) {
  if (!isAuthorizedCronRequest(request.headers))
    return Response.json(
      { error: 'Unauthorized.' },
      { status: 401, headers: { ...noStore, 'WWW-Authenticate': 'Bearer' } },
    );
  try {
    const summary = await runAutomation({ trigger: 'cron' });
    return Response.json({ ok: true, ...summary }, { headers: noStore });
  } catch (error) {
    console.error(
      'Scheduled automation run failed:',
      error instanceof Error ? error.name : 'unknown',
    );
    return Response.json(
      { ok: false, error: 'Automation run failed.' },
      { status: 503, headers: noStore },
    );
  }
}

export function GET(request: Request) {
  return handle(request);
}

export function POST(request: Request) {
  return handle(request);
}
