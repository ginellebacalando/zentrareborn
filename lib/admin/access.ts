import 'server-only';
import { auth } from './auth';
import { prisma } from '@/lib/prisma';
import { canAccessAdmin } from './domain';
import { AdminError } from './errors';
import { assertAccess } from './guards';
import type { AdminAction, AdminPage } from './permissions';

export { AdminError } from './errors';
export { assertAccess, assertSectionAccess, NO_ACCESS_MESSAGE } from './guards';
export async function currentAdmin() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      username: true,
      fullName: true,
      profileImage: true,
      contactNumber: true,
      role: true,
      status: true,
      mustChangePassword: true,
      lastPasswordChangedAt: true,
    },
  });
  const changedAt = (session as unknown as { passwordChangedAt: number }).passwordChangedAt;
  if (
    !user ||
    !canAccessAdmin(user.role, user.status) ||
    (user.lastPasswordChangedAt?.getTime() ?? 0) !== changedAt
  )
    return null;
  const accountSessionId = (session as unknown as { accountSessionId: string }).accountSessionId;
  if (!accountSessionId) return null;
  const active = await prisma.accountSession.findFirst({
    where: {
      id: accountSessionId,
      userId: user.id,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { id: true, accessScope: true },
  });
  if (!active) return null;
  return {
    ...user,
    mustChangePassword:
      user.mustChangePassword ||
      user.status === 'PASSWORD_RESET_REQUIRED' ||
      active.accessScope === 'PASSWORD_CHANGE_ONLY',
  };
}
export type AdminActor = NonNullable<Awaited<ReturnType<typeof currentAdmin>>>;
/**
 * The signed-in administrator, refused with 401 when signed out and 403 when the role may not open
 * `page` or take `action` (lib/admin/permissions.ts). `owner` is kept for older callers and means
 * the super administrator role.
 */
export async function requireAdmin(
  options: { owner?: boolean; profile?: boolean; page?: AdminPage; action?: AdminAction } = {},
) {
  const actor = await currentAdmin();
  if (!actor) throw new AdminError('Please sign in with an active administrator account.', 401);
  if (actor.mustChangePassword && !options.profile)
    throw new AdminError('Change your password in Profile before using operational features.', 403);
  assertAccess(actor.role, options);
  return actor;
}

export function checkMutationOrigin(request: Request) {
  const origin = request.headers.get('origin');
  const expected =
    process.env.AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  if (
    !origin ||
    origin !== new URL(expected).origin ||
    request.headers.get('sec-fetch-site') === 'cross-site'
  )
    throw new AdminError('Cross-site request rejected.', 403);
}
export function adminResponse(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
