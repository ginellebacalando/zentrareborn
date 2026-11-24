import 'server-only';
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { canAccessAdmin } from './domain';
import { localAdminAccessConfig, validateLocalAdminAccess } from './local-access';
import { getAdminPreferences } from './preferences';

const dummyHash = '$2b$12$Y7BhLbYrE/BlxtDJYZPPyeM57oiYOQCxhYEaACprXcShgQ.yCJTH2';
export const { auth, handlers, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  pages: { signIn: '/admin' },
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 },
  providers: [
    Credentials({
      credentials: {
        email: { type: 'email' },
        password: { type: 'password' },
        localAccessToken: { type: 'password' },
      },
      async authorize(credentials, request) {
        const localAccess = validateLocalAdminAccess(credentials.localAccessToken, request);
        if (credentials.localAccessToken && !localAccess) return null;
        const email =
          localAccess?.email ??
          (typeof credentials.email === 'string' ? credentials.email.trim().toLowerCase() : '');
        const password = typeof credentials.password === 'string' ? credentials.password : '';
        if (!email || email.length > 255 || password.length > 128) return null;
        // Atomic database-backed throttling is shared by all application instances.
        if (!localAccess) {
          const key = createHash('sha256').update(`login:${email}`).digest('hex');
          const limits = await prisma.$queryRaw<{ attempts: number }[]>`
        INSERT INTO zion_admin_rate_limits (key, attempts, "windowAt") VALUES (${key}, 1, NOW())
        ON CONFLICT (key) DO UPDATE SET attempts = CASE WHEN zion_admin_rate_limits."windowAt" < NOW() - INTERVAL '15 minutes' THEN 1 ELSE zion_admin_rate_limits.attempts + 1 END,
        "windowAt" = CASE WHEN zion_admin_rate_limits."windowAt" < NOW() - INTERVAL '15 minutes' THEN NOW() ELSE zion_admin_rate_limits."windowAt" END RETURNING attempts`;
          if (limits[0].attempts > 8) return null;
        }
        const user = await prisma.user.findUnique({ where: { email } });
        const valid =
          Boolean(localAccess) || (await bcrypt.compare(password, user?.passwordHash ?? dummyHash));
        if (!user || !valid || !canAccessAdmin(user.role, user.status)) {
          await prisma.auditLog.create({
            data: {
              userName: 'Sign-in attempt',
              userRole: 'UNKNOWN',
              action: 'LOGIN_FAILED',
              module: 'Authentication',
              description: 'An administrator sign-in was rejected.',
              status: 'FAILED',
              source: 'zion-admin',
            },
          });
          return null;
        }
        await prisma.auditLog.create({
          data: {
            userId: user.id,
            userName: user.fullName || user.username,
            userRole: user.role,
            action: 'LOGIN',
            module: 'Authentication',
            description: localAccess
              ? 'Administrator signed in using temporary local development access.'
              : 'Administrator signed in.',
            status: 'SUCCESS',
            source: 'zion-admin',
          },
        });
        const sessionMinutes = localAccess
          ? 8 * 60
          : (await getAdminPreferences()).settings.admin.security.sessionTimeoutMinutes;
        const session = await prisma.accountSession.create({
          data: {
            userId: user.id,
            sessionTokenHash: createHash('sha256').update(randomBytes(32)).digest('hex'),
            expiresAt: new Date(
              Math.min(Date.now() + sessionMinutes * 60 * 1000, localAccess?.expiresAt ?? Infinity),
            ),
            accessScope:
              user.mustChangePassword || user.status === 'PASSWORD_RESET_REQUIRED'
                ? 'PASSWORD_CHANGE_ONLY'
                : 'FULL_ACCESS',
          },
        });
        return {
          id: user.id,
          name: user.fullName || user.username,
          email: user.email,
          passwordChangedAt: user.lastPasswordChangedAt?.getTime() ?? 0,
          accountSessionId: session.id,
          localDevelopmentAccess: Boolean(localAccess),
          localAccessExpiresAt: localAccess?.expiresAt ?? 0,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.localDevelopmentAccess = (
          user as unknown as { localDevelopmentAccess: boolean }
        ).localDevelopmentAccess;
        token.localAccessExpiresAt = (
          user as unknown as { localAccessExpiresAt: number }
        ).localAccessExpiresAt;
      }
      if (user)
        token.passwordChangedAt = (
          user as unknown as { passwordChangedAt: number }
        ).passwordChangedAt;
      if (user)
        token.accountSessionId = (user as unknown as { accountSessionId: string }).accountSessionId;
      return token;
    },
    async session({ session, token }) {
      const localConfig = token.localDevelopmentAccess ? localAdminAccessConfig() : null;
      const localAccessExpired =
        token.localDevelopmentAccess &&
        (!localConfig ||
          localConfig.email !== token.email ||
          Number(token.localAccessExpiresAt) <= Date.now());
      session.user.id = localAccessExpired ? '' : (token.sub ?? '');
      (session as unknown as { passwordChangedAt: number }).passwordChangedAt = Number(
        token.passwordChangedAt ?? 0,
      );
      (session as unknown as { accountSessionId: string }).accountSessionId = String(
        token.accountSessionId ?? '',
      );
      return session;
    },
  },
  events: {
    async signOut(message) {
      if ('token' in message && typeof message.token?.accountSessionId === 'string') {
        await prisma.accountSession.updateMany({
          where: {
            id: message.token.accountSessionId,
            userId: message.token.sub,
            revokedAt: null,
          },
          data: { revokedAt: new Date() },
        });
        if (message.token.sub) {
          const user = await prisma.user.findUnique({
            where: { id: message.token.sub },
            select: { fullName: true, username: true, role: true },
          });
          await prisma.auditLog.create({
            data: {
              userId: message.token.sub,
              userName: user?.fullName || user?.username || 'Administrator',
              userRole: user?.role || 'UNKNOWN',
              action: 'LOGOUT',
              module: 'Authentication',
              description: 'Signed out; administrator session revoked.',
              status: 'SUCCESS',
              source: 'zion-admin',
            },
          });
        }
      }
    },
  },
});
