import 'server-only';
import { developerDb } from '@/lib/developer/db';
import { isCronConfigured, isMailConfigured } from '@/lib/automation/config';
import type { ConnectionCheck } from '@/lib/developer/types';

export async function readConnections(): Promise<ConnectionCheck[]> {
  const started = Date.now();
  let database = false;
  try {
    await developerDb.query('SELECT 1');
    database = true;
  } catch {
    /* Return a safe status. */
  }
  const present = (...keys: string[]) => keys.every((k) => Boolean(process.env[k]?.trim()));
  return [
    {
      id: 'database',
      name: 'PostgreSQL',
      scope: 'Client + Admin + Developer',
      state: database ? 'connected' : 'error',
      detail: database ? 'Database query completed.' : 'Database query failed.',
      latencyMs: Date.now() - started,
    },
    {
      id: 'admin',
      name: 'Admin authentication',
      scope: 'Admin',
      state: present('AUTH_SECRET') ? 'configured' : 'missing',
      detail: 'Configuration check. Active staff sessions remain separate.',
    },
    {
      id: 'storage',
      name: 'Supabase Storage',
      scope: 'Client testimony photos',
      state:
        present('SUPABASE_URL', 'SUPABASE_TESTIMONY_PHOTOS_BUCKET') &&
        (present('SUPABASE_SECRET_KEY') || present('SUPABASE_SERVICE_ROLE_KEY'))
          ? 'configured'
          : 'missing',
      detail: 'Configuration check; no files uploaded or changed.',
    },
    {
      id: 'email',
      name: 'Email (Gmail SMTP)',
      scope: 'Inquiry, booking, reminder and digest emails',
      state: isMailConfigured() ? 'configured' : 'missing',
      detail: 'Configuration check; no email sent. Unsent messages stay queued in the outbox.',
    },
    {
      id: 'cron',
      name: 'Scheduled automation',
      scope: 'Retries, reminders and daily digest',
      state: isCronConfigured() ? 'configured' : 'missing',
      detail: 'CRON_SECRET check only. The scheduler itself runs on Vercel Cron or Supabase.',
    },
    {
      id: 'knowledge',
      name: 'Assistant knowledge feed',
      scope: 'Developer → approved consumer',
      state: (process.env.DEVELOPER_KNOWLEDGE_TOKEN || '').length >= 43 ? 'configured' : 'missing',
      detail: 'Published sources only. A consumer must be configured separately.',
    },
  ];
}
