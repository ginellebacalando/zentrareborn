import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { AdminError, adminResponse, checkMutationOrigin, requireAdmin } from '@/lib/admin/access';
import { adminRead, adminMutate } from '@/lib/admin/service';

export const runtime = 'nodejs';
// Leaves time for the immediate email attempt (with calendar invite) that runs after a decision.
export const maxDuration = 30;
function failure(error: unknown) {
  if (error instanceof AdminError) return adminResponse({ error: error.message }, error.status);
  if (error instanceof ZodError)
    return adminResponse(
      {
        error: error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      },
      400,
    );
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
    return adminResponse(
      {
        error: 'This receipt or reference already exists. Do not record it twice.',
      },
      409,
    );
  console.error('Admin operation failed:', error instanceof Error ? error.name : 'unknown');
  return adminResponse(
    {
      error:
        'Admin data is unavailable. Check the database connection and additive admin schema installation.',
    },
    503,
  );
}
export async function GET(request: Request, { params }: { params: Promise<{ section: string }> }) {
  try {
    const { section } = await params;
    const actor = await requireAdmin({ profile: section === 'profile' });
    return adminResponse(await adminRead(section, new URL(request.url).searchParams, actor));
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request, { params }: { params: Promise<{ section: string }> }) {
  try {
    checkMutationOrigin(request);
    const { section } = await params;
    const actor = await requireAdmin({ profile: section === 'profile' });
    const bodyLimit = section === 'services' ? 1000000 : 40000;
    if (Number(request.headers.get('content-length') ?? 0) > bodyLimit)
      throw new AdminError('Request is too large.', 413);
    const body = await request.text();
    if (body.length > bodyLimit) throw new AdminError('Request is too large.', 413);
    let raw: unknown;
    try {
      raw = JSON.parse(body);
    } catch {
      throw new AdminError('Invalid JSON.');
    }
    const op = raw && typeof raw === 'object' && 'op' in raw ? raw.op : null;
    const allowed: Record<string, string[]> = {
      dashboard: ['testimony-action'],
      bookings: ['create-booking', 'booking-action', 'edit-booking'],
      payments: ['cash-receipt', 'void-receipt'],
      contracts: ['create-contract', 'contract-action'],
      profile: ['profile'],
      settings: ['settings'],
      preferences: ['preferences'],
      services: ['catalog-category', 'catalog-package'],
    };
    if (typeof op !== 'string' || !allowed[section]?.includes(op))
      throw new AdminError('Operation is not allowed in this module.', 400);
    const result = await adminMutate(raw, actor);
    if (op === 'preferences' || op === 'catalog-category' || op === 'catalog-package')
      revalidatePath('/', 'layout');
    if (op === 'testimony-action') {
      revalidatePath('/testimonies');
      revalidatePath('/');
    }
    return adminResponse(result);
  } catch (e) {
    return failure(e);
  }
}
