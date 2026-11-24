import { requireDeveloper, verifyDeveloperChange } from '@/lib/developer/auth';
import {
  assertDeveloperOrigin,
  DeveloperError,
  developerResponse,
  readDeveloperJson,
} from '@/lib/developer/security';
import { audit, rateLimit } from '@/lib/developer/db';
import {
  readOverview,
  mutateDeveloper,
  mutationSchema,
  sourceTest,
  testQuestionSchema,
} from '@/services/developer/control';
import { listContent, readFaqs } from '@/services/developer/content';
import { documentHistory, publishedKnowledge } from '@/services/developer/knowledge';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
function failure(error: unknown) {
  const duplicate = (error as { code?: string }).code === '23505';
  return developerResponse(
    {
      error:
        error instanceof DeveloperError
          ? error.message
          : duplicate
            ? 'This name or revision already exists. Reload and try again.'
            : 'Developer data is unavailable. Check the schema and connection configuration.',
    },
    error instanceof DeveloperError ? error.status : duplicate ? 409 : 503,
  );
}
export async function GET(request: Request) {
  try {
    const actor = await requireDeveloper(request);
    await rateLimit(`read:${actor.id}`, 120, 60);
    const query = new URL(request.url).searchParams;
    switch (query.get('section') || 'overview') {
      case 'overview':
        return developerResponse(await readOverview(actor));
      case 'content':
        return developerResponse(await listContent());
      case 'faqs':
        return developerResponse(await readFaqs());
      case 'history':
        return developerResponse(await documentHistory(query.get('id') || ''));
      case 'coverage': {
        const source = await publishedKnowledge();
        return developerResponse({
          knowledge: source.documents.filter((d) => d.kind === 'knowledge').length,
          templates: source.documents.filter((d) => d.kind === 'template').length,
          faqs: source.faqs.length,
          content: source.content.length,
          packages: source.packages.length,
        });
      }
      default:
        throw new DeveloperError('Section not found.', 404);
    }
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    assertDeveloperOrigin(request);
    const actor = await requireDeveloper(request, true);
    await rateLimit(`write:${actor.id}`, 40, 60);
    const input = await readDeveloperJson(request);
    const test = testQuestionSchema.safeParse(input);
    if (test.success) return developerResponse(await sourceTest(test.data.question));
    const parsed = mutationSchema.safeParse(input);
    if (!parsed.success) throw new DeveloperError('Invalid developer action.', 422);
    try {
      await verifyDeveloperChange(actor, parsed.data.code, request.headers);
    } catch (error) {
      await audit(actor.id, 'MFA_VERIFY', parsed.data.op, 'denied');
      throw error;
    }
    return developerResponse(await mutateDeveloper(parsed.data, actor));
  } catch (error) {
    return failure(error);
  }
}
