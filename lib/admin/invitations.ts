import 'server-only';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { AdminError } from './errors';
import { ADMIN_ROLES, type AdminRole } from './permissions';
import { hashInvitationToken, ROLE_LABELS } from './team';

/**
 * Accepting an admin panel invitation (lib/admin/team.ts): the emailed link opens
 * /admin/invitation/<token>, where the invited person chooses a password. Only the token's hash is
 * stored; it works once, before it expires, and only while the account still waits for setup.
 */
export type InvitationView =
  | { state: 'valid'; fullName: string; email: string; roleLabel: string; expiresAt: string }
  | { state: 'expired' | 'used' | 'invalid' };

const TOKEN_SHAPE = /^[A-Za-z0-9_-]{20,100}$/;

async function findInvitation(token: string) {
  if (!TOKEN_SHAPE.test(token)) return null;
  const invitation = await prisma.accountToken.findFirst({
    where: { tokenHash: hashInvitationToken(token), tokenType: 'INVITATION' },
    select: {
      id: true,
      expiresAt: true,
      usedAt: true,
      user: {
        select: { id: true, email: true, fullName: true, username: true, role: true, status: true },
      },
    },
  });
  if (!invitation || !(ADMIN_ROLES as readonly string[]).includes(invitation.user.role))
    return null;
  return invitation;
}

function stateOf(invitation: NonNullable<Awaited<ReturnType<typeof findInvitation>>>) {
  if (invitation.usedAt || invitation.user.status !== 'PENDING_SETUP') return 'used' as const;
  if (invitation.expiresAt <= new Date()) return 'expired' as const;
  return 'valid' as const;
}

export async function readInvitation(token: string): Promise<InvitationView> {
  const invitation = await findInvitation(token);
  if (!invitation) return { state: 'invalid' };
  const state = stateOf(invitation);
  if (state !== 'valid') return { state };
  return {
    state,
    fullName: invitation.user.fullName?.trim() || invitation.user.username,
    email: invitation.user.email,
    roleLabel: ROLE_LABELS[invitation.user.role as AdminRole],
    expiresAt: invitation.expiresAt.toISOString(),
  };
}

export const PASSWORD_RULE = 'Use at least 12 characters (no more than 72 bytes).';

export async function acceptInvitation(token: string, password: string) {
  if (password.length < 12 || password.length > 128 || bcrypt.truncates(password))
    throw new AdminError(PASSWORD_RULE);
  const invitation = await findInvitation(token);
  if (!invitation) throw new AdminError('This invitation link is not valid.', 404);
  const state = stateOf(invitation);
  if (state === 'used')
    throw new AdminError('This invitation was already used. Sign in instead.', 409);
  if (state === 'expired')
    throw new AdminError(
      'This invitation has expired. Ask a super administrator for a new one.',
      410,
    );
  const passwordHash = await bcrypt.hash(password, 12);
  const now = new Date();
  const user = invitation.user;
  await prisma.$transaction(async (db) => {
    // Claim the token first, so a second submission of the same link cannot set another password.
    const claimed = await db.accountToken.updateMany({
      where: { id: invitation.id, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (claimed.count !== 1)
      throw new AdminError('This invitation was already used. Sign in instead.', 409);
    await db.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        status: 'ACTIVE',
        mustChangePassword: false,
        lastPasswordChangedAt: now,
      },
    });
    await db.passwordHistory.create({ data: { userId: user.id, passwordHash } });
    await db.auditLog.create({
      data: {
        userId: user.id,
        userName: user.fullName || user.username,
        userRole: user.role,
        action: 'ACCOUNT_ACTIVATED',
        module: 'Team',
        description: 'Accepted the admin panel invitation and set a password.',
        status: 'SUCCESS',
        source: 'zion-admin',
      },
    });
  });
  return { email: user.email };
}
