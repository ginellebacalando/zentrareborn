import { ZodError, z } from 'zod';
import { AuditAction, AuditStatus } from '@prisma/client';
import { AdminError, adminResponse, checkMutationOrigin, requireAdmin } from '@/lib/admin/access';
import { createAuditLog, getRequestContext } from '@/lib/audit';
import { ChatRequestError, createChatBudget } from '@/lib/chatbot/request';
import { getPublicSystemSettings } from '@/lib/system-settings';
import { zeniAdminOverview } from '@/services/chatbot/admin-overview';
import { resolveZeniGapGroup } from '@/services/chatbot/gaps';
import { previewReceptionistTurn } from '@/services/chatbot/receptionist';
import { visitorSources } from '@/services/chatbot/sources';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BODY_LIMIT = 4000;
// The test console may call the language model, so it gets a small budget of its own.
const consumePreview = createChatBudget(20, 60000);
const mutation = z.discriminatedUnion('op', [
  z.object({ op: z.literal('resolve'), hash: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
  z.object({ op: z.literal('preview'), question: z.string().trim().min(1).max(600) }).strict(),
]);

function failure(error: unknown) {
  if (error instanceof AdminError) return adminResponse({ error: error.message }, error.status);
  if (error instanceof ChatRequestError)
    return adminResponse({ error: 'Too many test questions. Try again in a minute.' }, 429);
  if (error instanceof ZodError)
    return adminResponse(
      {
        error: error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '),
      },
      400,
    );
  console.error(
    '[zeni] Admin Zeni operation failed:',
    error instanceof Error ? error.name : 'unknown',
  );
  return adminResponse(
    {
      error:
        'Zeni data is unavailable. Check the database connection and that prisma/receptionist.sql is installed.',
    },
    503,
  );
}

export async function GET() {
  try {
    await requireAdmin();
    return adminResponse(await zeniAdminOverview());
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    checkMutationOrigin(request);
    const actor = await requireAdmin();
    if (Number(request.headers.get('content-length') ?? 0) > BODY_LIMIT)
      throw new AdminError('Request is too large.', 413);
    const body = await request.text();
    if (body.length > BODY_LIMIT) throw new AdminError('Request is too large.', 413);
    let raw: unknown;
    try {
      raw = JSON.parse(body);
    } catch {
      throw new AdminError('Invalid JSON.');
    }
    const input = mutation.parse(raw);
    if (input.op === 'resolve') {
      const actorName = actor.fullName?.trim() || actor.username;
      const resolved = await resolveZeniGapGroup(input.hash, actorName);
      if (!resolved)
        throw new AdminError('This question was already resolved or no longer exists.', 404);
      await createAuditLog({
        userId: actor.id,
        userName: actorName,
        userRole: actor.role,
        action: AuditAction.UPDATE,
        module: 'Zeni',
        description: `Marked an unanswered Zeni question resolved (${resolved} occurrence${resolved === 1 ? '' : 's'}).`,
        status: AuditStatus.SUCCESS,
        source: 'zion-admin',
        ...getRequestContext(request),
      });
      return adminResponse({ resolved });
    }
    consumePreview();
    const settings = await getPublicSystemSettings();
    const sources = await visitorSources(settings);
    return adminResponse(await previewReceptionistTurn(input.question, sources, settings));
  } catch (error) {
    return failure(error);
  }
}
