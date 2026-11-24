import { readAutomationHealth } from '@/lib/automation/overview';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  let database = false;

  try {
    const result = await prisma.$queryRaw<Array<{ database: boolean }>>`
      SELECT TRUE AS "database"
    `;
    database = result[0]?.database === true;
  } catch {
    database = false;
  }

  // Booleans and counts only: no addresses, hosts, secrets or message content.
  let automation: Awaited<ReturnType<typeof readAutomationHealth>> | null = null;
  if (database) {
    try {
      automation = await readAutomationHealth();
    } catch {
      automation = null;
    }
  }
  const ready = database && automation !== null;

  return Response.json(
    {
      status: ready ? 'ok' : 'degraded',
      service: 'zion-client',
      ready,
      automation: automation ?? { available: false },
      checkedAt: new Date().toISOString(),
    },
    {
      status: ready ? 200 : 503,
      headers: { 'cache-control': 'no-store, max-age=0' },
    },
  );
}
