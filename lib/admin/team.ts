import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { enqueueJobs } from '@/lib/automation/outbox';
import { applicationUrl } from '@/lib/automation/config';
import { teamInvitationEmail } from '@/lib/automation/templates';
import { scheduleAutomationDelivery } from '@/lib/automation/trigger';
import type { AdminActor } from './access';
import { AdminError } from './errors';
import { assertAccess } from './guards';
import { ADMIN_ROLES, canDo, type AdminRole } from './permissions';

/**
 * Staff accounts (docs/admin-panel.md, "Roles and access"): a super administrator invites people
 * by email, changes their role and disables or re-enables them. Guards: nobody changes their own
 * role or status, and the last active super administrator can be neither demoted nor disabled.
 * Every change is written to the Activity log, and a role or status change ends the person's
 * sessions so their new access applies on their next request.
 */
export const INVITATION_DAYS = 3;

export const ROLE_LABELS: Record<AdminRole, string> = {
  SUPERADMIN: 'Super admin',
  ADMIN: 'Admin',
};

export function hashInvitationToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export type TeamMember = {
  id: string;
  fullName: string;
  email: string;
  role: AdminRole;
  status: 'ACTIVE' | 'INVITED' | 'INVITATION_EXPIRED' | 'DISABLED' | 'PASSWORD_RESET_REQUIRED';
  isYou: boolean;
  invitedUntil: string | null;
  lastSignInAt: string | null;
  createdAt: string;
};

function memberStatus(status: string, invitedUntil: Date | null): TeamMember['status'] {
  if (status === 'DISABLED' || status === 'LOCKED') return 'DISABLED';
  if (status === 'PASSWORD_RESET_REQUIRED') return 'PASSWORD_RESET_REQUIRED';
  if (status === 'PENDING_SETUP')
    return invitedUntil && invitedUntil > new Date() ? 'INVITED' : 'INVITATION_EXPIRED';
  if (status === 'INVITATION_EXPIRED') return 'INVITATION_EXPIRED';
  return 'ACTIVE';
}

export async function readTeam(actor: AdminActor) {
  assertAccess(actor.role, { page: 'team' });
  const users = await prisma.user.findMany({
    where: { role: { in: [...ADMIN_ROLES] } },
    orderBy: [{ createdAt: 'asc' }],
    take: 200,
    select: {
      id: true,
      email: true,
      username: true,
      fullName: true,
      role: true,
      status: true,
      createdAt: true,
      accountTokens: {
        where: { tokenType: 'INVITATION', usedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { expiresAt: true },
      },
      accountSessions: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
    },
  });
  const members: TeamMember[] = users.map((user) => {
    const invitedUntil = user.accountTokens[0]?.expiresAt ?? null;
    return {
      id: user.id,
      fullName: user.fullName?.trim() || user.username,
      email: user.email,
      role: user.role as AdminRole,
      status: memberStatus(user.status, invitedUntil),
      isYou: user.id === actor.id,
      invitedUntil: invitedUntil?.toISOString() ?? null,
      lastSignInAt: user.accountSessions[0]?.createdAt.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
    };
  });
  return { members, canManage: canDo(actor.role, 'manage-team') };
}

const roleSchema = z.enum(ADMIN_ROLES);
const memberId = z.string().trim().min(1).max(64);

/** A unique username from the email's local part, for sign-in by username. */
async function availableUsername(db: Prisma.TransactionClient, email: string) {
  const base =
    email
      .split('@')[0]
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '')
      .slice(0, 40) || 'admin';
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}${attempt + 1}`;
    if (!(await db.user.findUnique({ where: { username: candidate }, select: { id: true } })))
      return candidate;
  }
  return `${base}-${randomBytes(3).toString('hex')}`;
}

/** Issues a fresh invitation (older unused ones stop working) and queues its email. */
async function issueInvitation(
  db: Prisma.TransactionClient,
  actor: AdminActor,
  user: { id: string; email: string; fullName: string; role: AdminRole },
) {
  const now = new Date();
  await db.accountToken.updateMany({
    where: { userId: user.id, tokenType: 'INVITATION', usedAt: null },
    data: { expiresAt: now },
  });
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(now.getTime() + INVITATION_DAYS * 24 * 60 * 60 * 1000);
  const record = await db.accountToken.create({
    data: {
      userId: user.id,
      tokenHash: hashInvitationToken(token),
      tokenType: 'INVITATION',
      expiresAt,
      createdBy: actor.id,
    },
    select: { id: true },
  });
  const origin = applicationUrl();
  const link = origin ? `${origin}/admin/invitation/${token}` : `/admin/invitation/${token}`;
  const email = teamInvitationEmail({
    fullName: user.fullName,
    roleLabel: ROLE_LABELS[user.role],
    invitedBy: actor.fullName?.trim() || actor.username,
    link,
    expiresAt,
  });
  const jobIds = await enqueueJobs(
    db,
    [
      {
        idempotencyKey: `team-invitation:${record.id}`,
        event: 'TEAM_INVITATION',
        recipient: user.email,
        subject: email.subject,
        text: email.text,
        html: email.html,
        expiresAt,
      },
    ],
    now,
  );
  return { link, expiresAt, jobIds };
}

async function activeSuperAdminsBesides(db: Prisma.TransactionClient, userId: string) {
  return db.user.count({
    where: {
      id: { not: userId },
      role: 'SUPERADMIN',
      status: { in: ['ACTIVE', 'PASSWORD_RESET_REQUIRED'] },
    },
  });
}

async function revokeSessions(db: Prisma.TransactionClient, userId: string) {
  await db.accountSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

function audit(
  db: Prisma.TransactionClient,
  actor: AdminActor,
  action:
    | 'TEAM_MEMBER_INVITED'
    | 'INVITATION_RESENT'
    | 'ROLE_CHANGED'
    | 'ACCOUNT_DISABLED'
    | 'ACCOUNT_ACTIVATED',
  description: string,
  values?: { previous?: Prisma.InputJsonValue; next?: Prisma.InputJsonValue },
) {
  return db.auditLog.create({
    data: {
      userId: actor.id,
      userName: actor.fullName || actor.username,
      userRole: actor.role,
      action,
      module: 'Team',
      description,
      status: 'SUCCESS',
      source: 'zion-admin',
      ...(values?.previous ? { previousValues: values.previous } : {}),
      ...(values?.next ? { newValues: values.next } : {}),
    },
  });
}

async function staffMember(db: Prisma.TransactionClient, id: string) {
  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      fullName: true,
      username: true,
      role: true,
      status: true,
      passwordHash: true,
    },
  });
  if (!user || !(ADMIN_ROLES as readonly string[]).includes(user.role))
    throw new AdminError('This team member no longer exists.', 404);
  return { ...user, role: user.role as AdminRole, name: user.fullName?.trim() || user.username };
}

export async function teamMutate(raw: unknown, actor: AdminActor) {
  assertAccess(actor.role, { action: 'manage-team' });
  const op = z.object({ op: z.string() }).parse(raw).op;

  if (op === 'team-invite') {
    const input = z
      .object({
        op: z.literal('team-invite'),
        fullName: z.string().trim().min(2).max(180),
        email: z.email().trim().toLowerCase().max(255),
        role: roleSchema,
      })
      .strict()
      .parse(raw);
    const result = await prisma.$transaction(async (db) => {
      if (await db.user.findUnique({ where: { email: input.email }, select: { id: true } }))
        throw new AdminError('This email address already has an account.', 409);
      const user = await db.user.create({
        data: {
          email: input.email,
          username: await availableUsername(db, input.email),
          fullName: input.fullName,
          role: input.role,
          status: 'PENDING_SETUP',
          createdBy: actor.id,
        },
        select: { id: true },
      });
      const invitation = await issueInvitation(db, actor, {
        id: user.id,
        email: input.email,
        fullName: input.fullName,
        role: input.role,
      });
      await audit(
        db,
        actor,
        'TEAM_MEMBER_INVITED',
        `Invited ${input.fullName} as ${ROLE_LABELS[input.role]}; the invitation link expires in ${INVITATION_DAYS} days.`,
        { next: { role: input.role, status: 'PENDING_SETUP' } },
      );
      return { id: user.id, ...invitation };
    });
    scheduleAutomationDelivery(result.jobIds);
    return { id: result.id, link: result.link, expiresAt: result.expiresAt.toISOString() };
  }

  if (op === 'team-resend') {
    const input = z
      .object({ op: z.literal('team-resend'), id: memberId })
      .strict()
      .parse(raw);
    const result = await prisma.$transaction(async (db) => {
      const member = await staffMember(db, input.id);
      if (!['PENDING_SETUP', 'INVITATION_EXPIRED'].includes(member.status))
        throw new AdminError('This person has already set up their account.', 409);
      if (member.status === 'INVITATION_EXPIRED')
        await db.user.update({ where: { id: member.id }, data: { status: 'PENDING_SETUP' } });
      const invitation = await issueInvitation(db, actor, {
        id: member.id,
        email: member.email,
        fullName: member.name,
        role: member.role,
      });
      await audit(db, actor, 'INVITATION_RESENT', `Sent ${member.name} a new invitation link.`);
      return invitation;
    });
    scheduleAutomationDelivery(result.jobIds);
    return { link: result.link, expiresAt: result.expiresAt.toISOString() };
  }

  if (op === 'team-role') {
    const input = z
      .object({ op: z.literal('team-role'), id: memberId, role: roleSchema })
      .strict()
      .parse(raw);
    if (input.id === actor.id)
      throw new AdminError("You can't change your own role. Ask another super administrator.", 403);
    await prisma.$transaction(async (db) => {
      const member = await staffMember(db, input.id);
      if (member.role === input.role) return;
      if (member.role === 'SUPERADMIN' && !(await activeSuperAdminsBesides(db, member.id)))
        throw new AdminError('The last super administrator keeps that role.', 409);
      await db.user.update({ where: { id: member.id }, data: { role: input.role } });
      await revokeSessions(db, member.id);
      await audit(
        db,
        actor,
        'ROLE_CHANGED',
        `Changed ${member.name} from ${ROLE_LABELS[member.role]} to ${ROLE_LABELS[input.role]}; their sessions were ended so the new access applies at once.`,
        { previous: { role: member.role }, next: { role: input.role } },
      );
    });
    return { id: input.id, role: input.role };
  }

  if (op === 'team-status') {
    const input = z
      .object({
        op: z.literal('team-status'),
        id: memberId,
        status: z.enum(['ACTIVE', 'DISABLED']),
      })
      .strict()
      .parse(raw);
    if (input.id === actor.id) throw new AdminError("You can't disable your own account.", 403);
    await prisma.$transaction(async (db) => {
      const member = await staffMember(db, input.id);
      if (input.status === 'DISABLED') {
        if (member.status === 'DISABLED') return;
        if (member.role === 'SUPERADMIN' && !(await activeSuperAdminsBesides(db, member.id)))
          throw new AdminError('The last super administrator cannot be disabled.', 409);
        await db.user.update({ where: { id: member.id }, data: { status: 'DISABLED' } });
        await db.accountToken.updateMany({
          where: { userId: member.id, usedAt: null },
          data: { expiresAt: new Date() },
        });
        await revokeSessions(db, member.id);
        await audit(
          db,
          actor,
          'ACCOUNT_DISABLED',
          `Disabled ${member.name}'s account; their sessions were ended.`,
          { previous: { status: member.status }, next: { status: 'DISABLED' } },
        );
        return;
      }
      if (member.status !== 'DISABLED') return;
      // Someone who never set a password goes back to waiting for an invitation.
      const status = member.passwordHash ? 'ACTIVE' : 'INVITATION_EXPIRED';
      await db.user.update({ where: { id: member.id }, data: { status } });
      await audit(
        db,
        actor,
        'ACCOUNT_ACTIVATED',
        status === 'ACTIVE'
          ? `Re-enabled ${member.name}'s account.`
          : `Re-enabled ${member.name}; they need a new invitation to set a password.`,
        { previous: { status: 'DISABLED' }, next: { status } },
      );
    });
    return { id: input.id };
  }

  throw new AdminError('Operation is not allowed in this module.', 400);
}
