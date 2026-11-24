import { z } from 'zod';
import {
  assertDeveloperGate,
  DeveloperError,
  developerResponse,
  equalSecret,
  readDeveloperJson,
} from '@/lib/developer/security';
import { rateLimit } from '@/lib/developer/db';
import {
  publishedKnowledge,
  reportKnowledgeGap,
  reviewTopics,
} from '@/services/developer/knowledge';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
async function authorize(request: Request) {
  assertDeveloperGate(request.headers);
  const secret = process.env.DEVELOPER_KNOWLEDGE_TOKEN || '';
  if (
    secret.length < 43 ||
    !equalSecret(request.headers.get('authorization') || '', `Bearer ${secret}`)
  )
    throw new DeveloperError('Not found.', 404);
  await rateLimit('knowledge-feed', 120, 60);
}
function failure(error: unknown) {
  return developerResponse(
    {
      error: error instanceof DeveloperError ? error.message : 'Knowledge feed unavailable.',
    },
    error instanceof DeveloperError ? error.status : 503,
  );
}
export async function GET(request: Request) {
  try {
    await authorize(request);
    return developerResponse(await publishedKnowledge());
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    await authorize(request);
    const parsed = z
      .object({ topic: z.enum(reviewTopics) })
      .strict()
      .safeParse(await readDeveloperJson(request));
    if (!parsed.success)
      throw new DeveloperError(
        'Send a controlled topic only. Raw conversations are not accepted.',
        422,
      );
    await reportKnowledgeGap(parsed.data.topic);
    return developerResponse({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
