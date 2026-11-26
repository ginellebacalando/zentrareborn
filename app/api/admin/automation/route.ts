import { z, ZodError } from 'zod';
import { AdminError, adminResponse, checkMutationOrigin, requireAdmin } from '@/lib/admin/access';
import { AUTOMATION_STATUSES } from '@/lib/automation/catalog';
import { readAutomationOverview, retryAutomationJob } from '@/lib/automation/overview';
import { runAutomation } from '@/lib/automation/run';
import { setAutomationSwitch } from '@/lib/automation/switches';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const BODY_LIMIT = 2000;
const filterSchema = z.enum(AUTOMATION_STATUSES).nullable();
const actionSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('retry'), id: z.string().trim().min(1).max(100) }).strict(),
  z.object({ op: z.literal('run') }).strict(),
  z
    .object({
      op: z.literal('switch'),
      key: z.string().trim().min(1).max(60),
      enabled: z.boolean(),
    })
    .strict(),
]);

function failure(error: unknown) {
  if (error instanceof AdminError) return adminResponse({ error: error.message }, error.status);
  if (error instanceof ZodError)
    return adminResponse({ error: 'Invalid automation request.' }, 400);
  console.error(
    'Automation admin request failed:',
    error instanceof Error ? error.name : 'unknown',
  );
  return adminResponse(
    {
      error:
        'Automation data is unavailable. Check the database connection and the automation schema (npm run db:automation:check).',
    },
    503,
  );
}

export async function GET(request: Request) {
  try {
    await requireAdmin({ page: 'automation' });
    const filter = filterSchema.parse(new URL(request.url).searchParams.get('status') || null);
    return adminResponse(await readAutomationOverview(filter));
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    checkMutationOrigin(request);
    const actor = await requireAdmin({ page: 'automation', action: 'run-automation' });
    if (Number(request.headers.get('content-length') ?? 0) > BODY_LIMIT)
      throw new AdminError('Request is too large.', 413);
    const text = await request.text();
    if (text.length > BODY_LIMIT) throw new AdminError('Request is too large.', 413);
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      throw new AdminError('Invalid JSON.');
    }
    const input = actionSchema.parse(raw);
    const audit = (description: string) =>
      prisma.auditLog.create({
        data: {
          userId: actor.id,
          userName: actor.fullName || actor.username,
          userRole: actor.role,
          action: 'UPDATE',
          module: 'Notifications',
          description,
          status: 'SUCCESS',
          source: 'zion-admin',
        },
      });
    if (input.op === 'switch') {
      const outcome = await setAutomationSwitch(input.key, input.enabled);
      if (!outcome.ok) throw new AdminError(outcome.reason, 409);
      await audit(
        `${input.enabled ? 'Turned on' : 'Turned off'} the automation "When ${outcome.automation.when.toLowerCase()}, ${outcome.automation.action.toLowerCase()}".`,
      );
      return adminResponse({
        status: 'switched',
        message: input.enabled
          ? `${outcome.automation.action} is on again.`
          : `${outcome.automation.action} is off. Its emails are skipped until you turn it on.`,
      });
    }
    if (input.op === 'retry') {
      const outcome = await retryAutomationJob(input.id);
      if (!outcome)
        throw new AdminError('Only failed emails can be retried. Reload the list.', 409);
      await audit(`Retried automation email ${input.id}: ${outcome.status}.`);
      return adminResponse(outcome);
    }
    const summary = await runAutomation({ trigger: 'admin' });
    const { delivery, scheduled } = summary;
    await audit(
      `Ran due automation jobs: ${delivery.sent} sent, ${delivery.retrying} retrying, ${delivery.failed} failed, ${delivery.waiting} waiting; ${scheduled.inquiries + scheduled.reminders + scheduled.digest} prepared.`,
    );
    return adminResponse({
      status: 'ran',
      message: delivery.mailConfigured
        ? `Run complete: ${delivery.sent} sent, ${delivery.retrying} will retry, ${delivery.failed} failed, ${delivery.skipped} skipped.`
        : `Email is not configured, so nothing was sent. ${delivery.waiting} email(s) are waiting.`,
      summary,
    });
  } catch (error) {
    return failure(error);
  }
}
