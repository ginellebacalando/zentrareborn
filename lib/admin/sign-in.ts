import 'server-only';
import { prisma } from '@/lib/prisma';

/**
 * The account an admin sign-in name points to. The field accepts an email address (anything with
 * "@", matched in lowercase as stored) or a username, matched without regard to case by plain
 * equality (never a pattern) and only when exactly one account has it.
 */
export async function findSignInAccount(identifier: string) {
  if (!identifier) return null;
  if (identifier.includes('@'))
    return prisma.user.findUnique({ where: { email: identifier.toLowerCase() } });
  const matches = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM users WHERE lower(username) = lower(${identifier}) LIMIT 2`;
  return matches.length === 1 ? prisma.user.findUnique({ where: { id: matches[0].id } }) : null;
}
