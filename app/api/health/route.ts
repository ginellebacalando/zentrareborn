import { prisma } from '@/lib/prisma';
import { readOrchestrationSettings } from '@/services/orchestration/developer-settings';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function safeWebhookHost(value: string | undefined) {
  if (!value?.trim()) return null;

  try {
    return new URL(value).host;
  } catch {
    return null;
  }
}

export async function GET() {
  let database = false;
  let databaseError = false;

  try {
    const result = await prisma.$queryRaw<Array<{ database: boolean }>>`
      SELECT TRUE AS "database"
    `;
    database = result[0]?.database === true;
  } catch {
    databaseError = true;
  }

  let notificationsEnabled = false;
  try {
    notificationsEnabled = (await readOrchestrationSettings()).value.inquiryEnabled;
  } catch {
    databaseError = true;
  }
  const webhookUrl = process.env.N8N_INQUIRY_WEBHOOK_URL;
  const configurationIssues = notificationsEnabled
    ? [
        !webhookUrl?.trim() ? 'N8N_INQUIRY_WEBHOOK_URL is missing.' : null,
        !process.env.N8N_WEBHOOK_SECRET?.trim() ? 'N8N_WEBHOOK_SECRET is missing.' : null,
        webhookUrl?.trim() && !safeWebhookHost(webhookUrl)
          ? 'N8N_INQUIRY_WEBHOOK_URL is invalid.'
          : null,
      ].filter((issue): issue is string => Boolean(issue))
    : [];
  const inquiryNotificationsReady = !notificationsEnabled || configurationIssues.length === 0;
  const ready = !databaseError && database && inquiryNotificationsReady;

  return Response.json(
    {
      status: ready ? 'ok' : 'degraded',
      service: 'zion-client',
      ready,
      // Detailed diagnostics are available only in the authenticated developer panel.
      checkedAt: new Date().toISOString(),
    },
    {
      status: ready ? 200 : 503,
      headers: { 'cache-control': 'no-store, max-age=0' },
    },
  );
}
