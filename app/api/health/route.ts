import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function configured(...names: string[]) {
  return names.some((name) => Boolean(process.env[name]?.trim()));
}

function inquiryNotificationsEnabled() {
  return process.env.N8N_WEBHOOK_ENABLED?.trim().toLowerCase() === 'true';
}

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

  const notificationsEnabled = inquiryNotificationsEnabled();
  const webhookUrl = process.env.N8N_INQUIRY_WEBHOOK_URL;
  const configurationIssues = notificationsEnabled
    ? [
        !webhookUrl?.trim() ? 'N8N_INQUIRY_WEBHOOK_URL is missing.' : null,
        !process.env.N8N_WEBHOOK_SECRET?.trim() ? 'N8N_WEBHOOK_SECRET is missing.' : null,
        webhookUrl?.trim() && !safeWebhookHost(webhookUrl) ? 'N8N_INQUIRY_WEBHOOK_URL is invalid.' : null,
      ].filter((issue): issue is string => Boolean(issue))
    : [];
  const inquiryNotificationsReady = !notificationsEnabled || configurationIssues.length === 0;
  const ready = !databaseError && database && inquiryNotificationsReady;

  return Response.json({
    status: ready ? 'ok' : 'degraded',
    service: 'zion-client',
    ready,
    inquiryIntakeReady: database,
    checks: {
      database,
      testimonyStorageConfiguration: configured('SUPABASE_URL')
        && configured('SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY')
        && configured('SUPABASE_TESTIMONY_PHOTOS_BUCKET'),
      inquiryNotificationConfiguration: inquiryNotificationsReady,
    },
    inquiryNotifications: {
      enabled: notificationsEnabled,
      configured: inquiryNotificationsReady,
      webhookHost: notificationsEnabled ? safeWebhookHost(webhookUrl) : null,
      configurationIssues,
    },
    deployment: process.env.VERCEL_ENV || process.env.DEPLOYMENT_ENV || 'local',
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || null,
    checkedAt: new Date().toISOString(),
  }, {
    status: ready ? 200 : 503,
    headers: { 'cache-control': 'no-store, max-age=0' },
  });
}
