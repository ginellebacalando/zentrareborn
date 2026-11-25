import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import LiveChatPanel from '@/components/admin/LiveChatPanel';
import { currentAdmin } from '@/lib/admin/access';
import { staffFirstName } from '@/lib/chatbot/live-chat';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Live chat' };

/** Staff side of the live chat that Zeni hands visitors to ("Talk to staff"). */
export default async function LiveChatAdminPage() {
  const actor = await currentAdmin();
  if (!actor) redirect('/admin');
  if (actor.mustChangePassword) redirect('/admin/profile');
  return (
    <LiveChatPanel
      staffId={actor.id}
      staffName={staffFirstName(actor.fullName || actor.username)}
    />
  );
}
