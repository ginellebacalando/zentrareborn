import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { createServer } from 'pglite-server';
import {
  ACTION_ACCESS,
  canDo,
  canOpenPage,
  meets,
  PAGE_ACCESS,
  requirementFor,
  SUPER_ADMIN_ACTIONS,
  SUPER_ADMIN_PAGES,
} from './permissions';

/**
 * Role-based access (lib/admin/permissions.ts): an Admin is refused every super administrator page
 * and action, at the permission table, the API requirement resolver and the service layer, and the
 * Team rules (no self role change, the last super administrator stays) hold in a real database.
 */
test('the permission table gives Admins daily work and keeps super administrator tools apart', () => {
  assert.deepEqual([...SUPER_ADMIN_PAGES].sort(), ['automation', 'logs', 'settings', 'team']);
  for (const page of Object.keys(PAGE_ACCESS)) {
    assert.equal(canOpenPage('SUPERADMIN', page), true, `super admin opens ${page}`);
    assert.equal(
      canOpenPage('ADMIN', page),
      !SUPER_ADMIN_PAGES.includes(page as never),
      `admin and ${page}`,
    );
  }
  assert.deepEqual([...SUPER_ADMIN_ACTIONS].sort(), [
    'change-settings',
    'edit-packages',
    'export-data',
    'manage-team',
    'run-automation',
    'void-receipt',
  ]);
  for (const action of Object.keys(ACTION_ACCESS) as (keyof typeof ACTION_ACCESS)[])
    assert.equal(canDo('SUPERADMIN', action), true, `super admin may ${action}`);
  assert.equal(canDo('ADMIN', 'verify-payments'), true);
  // Unknown roles and pages are refused rather than guessed.
  assert.equal(canOpenPage('CLIENT', 'dashboard'), false);
  assert.equal(canOpenPage('ADMIN', 'no-such-page'), false);
  assert.equal(canDo(undefined, 'verify-payments'), false);
});

test('every super administrator API section and operation refuses an Admin', () => {
  const blocked: [string, string | null][] = [
    ['team', null],
    ['logs', null],
    ['settings', null],
    ['automation', null],
    ['team', 'team-invite'],
    ['team', 'team-resend'],
    ['team', 'team-role'],
    ['team', 'team-status'],
    ['settings', 'settings'],
    ['preferences', 'preferences'],
    ['payments', 'void-receipt'],
    ['services', 'catalog-category'],
    ['services', 'catalog-package'],
  ];
  for (const [section, op] of blocked) {
    const requirement = requirementFor(section, op);
    assert.equal(meets('ADMIN', requirement), false, `admin blocked: ${section} ${op ?? 'read'}`);
    assert.equal(meets('SUPERADMIN', requirement), true, `super admin allowed: ${section} ${op}`);
  }
  const allowed: [string, string | null][] = [
    ['dashboard', null],
    ['bookings', 'booking-action'],
    ['payments', 'verify-proof'],
    ['payments', 'cash-receipt'],
    ['services', null],
    ['analytics', null],
    ['preferences', null],
    ['website-activity', null],
    ['front-desk', null],
  ];
  for (const [section, op] of allowed)
    assert.equal(meets('ADMIN', requirementFor(section, op)), true, `admin: ${section} ${op}`);
  assert.equal(meets('SUPERADMIN', requirementFor('unknown-section')), false);
});

test(
  'Team management and role guards hold in an isolated PostgreSQL database',
  { timeout: 120000 },
  async () => {
    const db = new PGlite();
    await db.waitReady;
    const sql = execFileSync(
      process.execPath,
      [
        'node_modules/prisma/build/index.js',
        'migrate',
        'diff',
        '--from-empty',
        '--to-schema',
        'prisma/schema.prisma',
        '--script',
      ],
      { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 },
    );
    await db.exec(sql.slice(sql.indexOf('-- CreateSchema')));
    const adminSql = readFileSync('prisma/admin.sql', 'utf8');
    await db.exec(adminSql.slice(adminSql.indexOf('-- Admin-only data')));
    await db.exec(readFileSync('prisma/automation.sql', 'utf8'));
    const server = createServer(db);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    process.env.DATABASE_URL = `postgresql://postgres@127.0.0.1:${address.port}/postgres`;
    process.env.DATABASE_POOL_MAX = '1';
    process.env.AUTH_SECRET = randomBytes(32).toString('hex');
    delete process.env.SMTP_USER;
    const { prisma } = await import('../prisma');
    const { adminMutate, adminRead } = await import('./service');
    const { assertSectionAccess } = await import('./guards');
    const { acceptInvitation, readInvitation } = await import('./invitations');
    const base = {
      email: '',
      fullName: '',
      profileImage: null,
      contactNumber: null,
      status: 'ACTIVE' as const,
      mustChangePassword: false,
      lastPasswordChangedAt: null,
    };
    const owner = {
      ...base,
      id: 'rbac-owner',
      email: 'owner@rbac.test',
      username: 'owner',
      fullName: 'Owner',
      role: 'SUPERADMIN' as const,
    };
    const admin = {
      ...base,
      id: 'rbac-admin',
      email: 'admin@rbac.test',
      username: 'staff',
      fullName: 'Staff Member',
      role: 'ADMIN' as const,
    };
    try {
      for (const user of [owner, admin])
        await prisma.user.create({
          data: {
            id: user.id,
            username: user.username,
            email: user.email,
            fullName: user.fullName,
            role: user.role,
            status: 'ACTIVE',
            passwordHash: 'not-used-in-this-test',
          },
        });

      // An Admin is refused every super administrator page read and operation (403).
      for (const section of ['team', 'logs', 'settings'])
        await assert.rejects(adminRead(section, new URLSearchParams(), admin), (error: unknown) => {
          assert.equal((error as { status?: number }).status, 403);
          return true;
        });
      assert.throws(() => assertSectionAccess('ADMIN', 'automation'), { status: 403 });
      for (const op of ['team-invite', 'team-resend', 'team-role', 'team-status', 'void-receipt'])
        await assert.rejects(adminMutate({ op }, admin), (error: unknown) => {
          assert.equal((error as { status?: number }).status, 403, op);
          return true;
        });
      // The super administrator can read the team; an Admin's own work stays open.
      const team = await adminRead('team', new URLSearchParams(), owner);
      assert.ok('members' in team);
      assert.equal(team.members.length, 2);
      await adminRead('dashboard', new URLSearchParams(), admin);

      // Invite: a pending account, a single-use link, an email job and an Activity log entry.
      const invite = await adminMutate(
        { op: 'team-invite', fullName: 'New Helper', email: 'Helper@RBAC.test', role: 'ADMIN' },
        owner,
      );
      assert.ok('link' in invite && typeof invite.link === 'string');
      const token = invite.link.split('/').pop() ?? '';
      const invited = await prisma.user.findUniqueOrThrow({ where: { email: 'helper@rbac.test' } });
      assert.equal(invited.status, 'PENDING_SETUP');
      assert.equal(invited.passwordHash, null);
      assert.equal(
        await prisma.adminOutbox.count({
          where: { event: 'TEAM_INVITATION', recipient: 'helper@rbac.test' },
        }),
        1,
      );
      assert.equal((await readInvitation(token)).state, 'valid');
      await assert.rejects(
        adminMutate(
          { op: 'team-invite', fullName: 'Again', email: 'helper@rbac.test', role: 'ADMIN' },
          owner,
        ),
        /already has an account/,
      );
      await assert.rejects(acceptInvitation(token, 'short'), /at least 12 characters/);
      await acceptInvitation(token, 'a long enough passphrase');
      const activated = await prisma.user.findUniqueOrThrow({ where: { id: invited.id } });
      assert.equal(activated.status, 'ACTIVE');
      assert.ok(activated.passwordHash);
      await assert.rejects(acceptInvitation(token, 'a long enough passphrase'), /already used/);
      assert.equal((await readInvitation(token)).state, 'used');

      // Nobody changes their own role or disables themselves.
      await assert.rejects(
        adminMutate({ op: 'team-role', id: owner.id, role: 'ADMIN' }, owner),
        /own role/,
      );
      await assert.rejects(
        adminMutate({ op: 'team-status', id: owner.id, status: 'DISABLED' }, owner),
        /own account/,
      );

      // A role change ends the person's sessions and is logged.
      await prisma.accountSession.create({
        data: {
          userId: admin.id,
          sessionTokenHash: randomBytes(16).toString('hex'),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });
      await adminMutate({ op: 'team-role', id: admin.id, role: 'SUPERADMIN' }, owner);
      assert.equal(
        (await prisma.user.findUniqueOrThrow({ where: { id: admin.id } })).role,
        'SUPERADMIN',
      );
      assert.equal(
        await prisma.accountSession.count({ where: { userId: admin.id, revokedAt: null } }),
        0,
      );
      assert.equal(await prisma.auditLog.count({ where: { action: 'ROLE_CHANGED' } }), 1);

      // With two super administrators one may be demoted; the last one may not.
      await adminMutate({ op: 'team-role', id: admin.id, role: 'ADMIN' }, owner);
      const promoted = { ...admin, role: 'SUPERADMIN' as const };
      await prisma.user.update({ where: { id: admin.id }, data: { role: 'SUPERADMIN' } });
      await adminMutate({ op: 'team-role', id: owner.id, role: 'ADMIN' }, promoted);
      await assert.rejects(
        adminMutate(
          { op: 'team-status', id: admin.id, status: 'DISABLED' },
          { ...owner, role: 'SUPERADMIN' },
        ),
        /last super administrator/,
      );
      await assert.rejects(
        adminMutate(
          { op: 'team-role', id: admin.id, role: 'ADMIN' },
          { ...owner, role: 'SUPERADMIN' },
        ),
        /last super administrator/,
      );

      // Disabling ends sessions and blocks sign-in until re-enabled.
      await adminMutate({ op: 'team-status', id: invited.id, status: 'DISABLED' }, promoted);
      assert.equal(
        (await prisma.user.findUniqueOrThrow({ where: { id: invited.id } })).status,
        'DISABLED',
      );
      await adminMutate({ op: 'team-status', id: invited.id, status: 'ACTIVE' }, promoted);
      assert.equal(
        (await prisma.user.findUniqueOrThrow({ where: { id: invited.id } })).status,
        'ACTIVE',
      );
      assert.ok(
        (await prisma.auditLog.count({
          where: { module: 'Team', action: { in: ['TEAM_MEMBER_INVITED', 'ACCOUNT_DISABLED'] } },
        })) >= 2,
      );
    } finally {
      await prisma.$disconnect();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await db.close();
    }
  },
);
