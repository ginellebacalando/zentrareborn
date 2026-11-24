import 'server-only';
import { prisma } from '@/lib/prisma';
import { AdminError } from './errors';

export async function processAdminNotifications() {
  if (!process.env.ADMIN_RESEND_API_KEY || !process.env.ADMIN_MAIL_FROM)
    throw new AdminError(
      'Email delivery is not configured. Notifications remain queued; none have been sent.',
      503,
    );
  // A crashed send may have reached the provider. Do not silently resend it.
  await prisma.adminOutbox.updateMany({
    where: {
      status: 'PROCESSING',
      nextAttemptAt: { lt: new Date(Date.now() - 10 * 60 * 1000) },
    },
    data: {
      status: 'REVIEW_REQUIRED',
      lastError: 'Dispatch was interrupted. Verify delivery before manually resending.',
    },
  });
  const claimed = await prisma.$queryRaw<
    { id: string; recipient: string; subject: string; body: string }[]
  >`
    UPDATE zion_admin_outbox SET status='PROCESSING', attempts=attempts+1, "nextAttemptAt"=NOW()
    WHERE id IN (SELECT id FROM zion_admin_outbox WHERE status='QUEUED' AND "nextAttemptAt"<=NOW() ORDER BY "createdAt" LIMIT 10 FOR UPDATE SKIP LOCKED)
    RETURNING id, recipient, subject, body`;
  let accepted = 0;
  for (const message of claimed) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.ADMIN_RESEND_API_KEY}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `zion-admin-${message.id}`,
        },
        body: JSON.stringify({
          from: process.env.ADMIN_MAIL_FROM,
          to: [message.recipient],
          subject: message.subject,
          text: message.body,
        }),
        signal: AbortSignal.timeout(15000),
      });
      const result = (await response.json()) as { id?: string };
      if (!response.ok || !result.id) throw new Error('Provider did not accept the email');
      await prisma.adminOutbox.update({
        where: { id: message.id },
        data: { status: 'ACCEPTED', sentAt: new Date(), lastError: null },
      });
      accepted++;
    } catch {
      await prisma.adminOutbox.update({
        where: { id: message.id },
        data: {
          status: 'REVIEW_REQUIRED',
          lastError: 'Provider rejected or interrupted dispatch. Check delivery before retrying.',
        },
      });
    }
  }
  return { processed: claimed.length, accepted };
}
