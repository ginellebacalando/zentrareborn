import 'server-only';
import { randomUUID, createHmac } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
import { developerDb, audit } from '@/lib/developer/db';
import { DeveloperError } from '@/lib/developer/security';
import type { DeveloperActor } from '@/lib/developer/auth';
import type { Workflow, ConnectionCheck } from '@/lib/developer/types';

const privateRanges = new BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.168.0.0', 16],
  ['100.64.0.0', 10],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const)
  privateRanges.addSubnet(address, prefix, 'ipv4');
for (const [address, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
  ['::ffff:0:0', 96],
] as const)
  privateRanges.addSubnet(address, prefix, 'ipv6');

export async function approvedIntegrationUrl(raw: string | undefined) {
  let url: URL;
  try {
    url = new URL(raw || '');
  } catch {
    throw new DeveloperError('Connection URL is not configured.', 503);
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash || url.search)
    throw new DeveloperError('Connections require a clean HTTPS URL.', 422);
  const allowed = (process.env.DEVELOPER_OUTBOUND_HOSTS || '')
    .split(',')
    .map((v) => v.trim().toLowerCase());
  if (!allowed.includes(url.hostname.toLowerCase()))
    throw new DeveloperError('Connection host is not approved in server configuration.', 422);
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(host)
    ? [{ address: host, family: isIP(host) }]
    : await lookup(host, { all: true });
  if (
    !addresses.length ||
    addresses.some((a) => privateRanges.check(a.address, a.family === 6 ? 'ipv6' : 'ipv4'))
  )
    throw new DeveloperError('Private network destinations are not allowed.', 422);
  return url;
}

export function allowedWorkflows() {
  return (process.env.N8N_DEVELOPER_WORKFLOW_IDS || '')
    .split(',')
    .map((v) => v.trim())
    .filter((v) => /^[a-zA-Z0-9_-]{1,100}$/.test(v))
    .slice(0, 20);
}
async function n8nRequest(path: string, method = 'GET') {
  const base = await approvedIntegrationUrl(process.env.N8N_API_BASE_URL);
  if (!process.env.N8N_API_KEY) throw new DeveloperError('n8n API key is not configured.', 503);
  const response = await fetch(`${base.toString().replace(/\/$/, '')}/${path}`, {
    method,
    headers: {
      'X-N8N-API-KEY': process.env.N8N_API_KEY,
      accept: 'application/json',
      ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(method === 'POST' ? { body: '{}' } : {}),
    redirect: 'error',
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new DeveloperError(`n8n returned HTTP ${response.status}.`, 502);
  }
  return response;
}
export async function readWorkflows(): Promise<Workflow[]> {
  if (!process.env.N8N_API_BASE_URL || !process.env.N8N_API_KEY) return [];
  return Promise.all(
    allowedWorkflows().map(async (id) => {
      const r = await n8nRequest(`workflows/${encodeURIComponent(id)}`);
      const value = (await r.json()) as { name?: string; active?: boolean };
      const base = new URL(process.env.N8N_API_BASE_URL!);
      return {
        id,
        name: String(value.name || id).slice(0, 180),
        active: value.active === true,
        editorUrl: `${base.origin}${base.pathname.replace(/\/api\/v1\/?$/, '')}/workflow/${encodeURIComponent(id)}`,
      };
    }),
  );
}
export async function changeWorkflow(actor: DeveloperActor, id: string, active: boolean) {
  if (!allowedWorkflows().includes(id)) throw new DeveloperError('Workflow is not approved.', 403);
  await audit(actor.id, active ? 'WORKFLOW_ACTIVATE' : 'WORKFLOW_PAUSE', id, 'pending');
  try {
    const response = await n8nRequest(
      `workflows/${encodeURIComponent(id)}/${active ? 'activate' : 'deactivate'}`,
      'POST',
    );
    await response.body?.cancel();
    await audit(actor.id, active ? 'WORKFLOW_ACTIVATE' : 'WORKFLOW_PAUSE', id);
  } catch (error) {
    await audit(actor.id, 'WORKFLOW_CHANGE', id, 'failed');
    throw error;
  }
}

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
  const checks: ConnectionCheck[] = [
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
      name: 'Resend',
      scope: 'Admin notifications',
      state: present('ADMIN_RESEND_API_KEY', 'ADMIN_MAIL_FROM') ? 'configured' : 'missing',
      detail: 'Configuration check; no email sent.',
    },
    {
      id: 'webhook',
      name: 'Inquiry webhook',
      scope: 'Client → n8n',
      state: present('N8N_INQUIRY_WEBHOOK_URL', 'N8N_WEBHOOK_SECRET') ? 'configured' : 'missing',
      detail: 'Delivery history below shows actual execution results.',
    },
    {
      id: 'knowledge',
      name: 'Assistant knowledge feed',
      scope: 'Developer → chatbot',
      state: (process.env.DEVELOPER_KNOWLEDGE_TOKEN || '').length >= 43 ? 'configured' : 'missing',
      detail: 'Published sources only. A consuming chatbot must be configured separately.',
    },
  ];
  if (present('N8N_API_BASE_URL', 'N8N_API_KEY')) {
    const time = Date.now();
    try {
      const response = await n8nRequest('workflows?limit=1');
      await response.body?.cancel();
      checks.push({
        id: 'n8n',
        name: 'n8n API',
        scope: 'Orchestration',
        state: 'connected',
        detail: 'Authenticated API request completed.',
        latencyMs: Date.now() - time,
      });
    } catch {
      checks.push({
        id: 'n8n',
        name: 'n8n API',
        scope: 'Orchestration',
        state: 'error',
        detail: 'Connection failed. Check the approved host, credentials, and API availability.',
      });
    }
  } else
    checks.push({
      id: 'n8n',
      name: 'n8n API',
      scope: 'Orchestration',
      state: 'missing',
      detail: 'Set the approved n8n API URL and a scoped server-side API key.',
    });
  return checks;
}

export async function syncKnowledge(actor: DeveloperActor, payload: unknown) {
  const url = await approvedIntegrationUrl(process.env.N8N_KNOWLEDGE_SYNC_URL);
  const secret = process.env.N8N_KNOWLEDGE_SYNC_SECRET || '';
  if (secret.length < 43)
    throw new DeveloperError('Knowledge sync credentials are not configured.', 503);
  const id = randomUUID(),
    timestamp = String(Math.floor(Date.now() / 1000));
  const body = JSON.stringify({
    id,
    event: 'knowledge.published',
    ...(payload as object),
  });
  const signature = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  await audit(actor.id, 'KNOWLEDGE_SYNC', id, 'pending');
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-zion-timestamp': timestamp,
        'x-zion-signature': signature,
        'x-zion-idempotency-key': id,
      },
      body,
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });
    const value = response.ok ? ((await response.json()) as { accepted?: boolean }) : null;
    if (!response.ok || value?.accepted !== true)
      throw new DeveloperError(
        'The receiver did not confirm acceptance. Check n8n before retrying.',
        502,
      );
    await audit(actor.id, 'KNOWLEDGE_SYNC', id);
    return {
      message:
        'n8n accepted the published knowledge snapshot. Check its workflow for downstream indexing.',
    };
  } catch (error) {
    await audit(actor.id, 'KNOWLEDGE_SYNC', id, 'failed');
    throw error;
  }
}
