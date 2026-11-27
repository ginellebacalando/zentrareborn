import 'server-only';
import { prisma } from '@/lib/prisma';
import type { SeenTarget } from './header-numbers';

/**
 * When an admin last opened the header's notification bell and Messages (docs/admin-panel.md,
 * "Header numbers"). The header's numbers count only what came in after, so a list someone has
 * already seen never nags; each admin has their own times.
 */
export type SeenTimes = { bellSeenAt: Date | null; messagesSeenAt: Date | null };

/**
 * The admin's last looks. Before the table is installed (prisma/admin-notification-seen.sql) there
 * are none, and the header counts everything still open, as it did before.
 */
export async function readSeenTimes(userId: string): Promise<SeenTimes> {
  try {
    const row = await prisma.adminNotificationSeen.findUnique({
      where: { userId },
      select: { bellSeenAt: true, messagesSeenAt: true },
    });
    return { bellSeenAt: row?.bellSeenAt ?? null, messagesSeenAt: row?.messagesSeenAt ?? null };
  } catch {
    return { bellSeenAt: null, messagesSeenAt: null };
  }
}

/** Saves a look; `at` is when the summary the admin was shown was read. */
export async function markSeen(userId: string, target: SeenTarget, at = new Date()) {
  const data = {
    ...(target === 'messages' ? {} : { bellSeenAt: at }),
    ...(target === 'bell' ? {} : { messagesSeenAt: at }),
  };
  await prisma.adminNotificationSeen.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
}
