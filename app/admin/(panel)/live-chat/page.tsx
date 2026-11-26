import type { Metadata } from 'next';
import LiveChatPanel from '@/components/admin/LiveChatPanel';
import { adminPageActor } from '@/lib/admin/page-access';
import { staffFirstName } from '@/lib/chatbot/live-chat';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Live chat' };

/** Staff side of the live chat that Zeni hands visitors to ("Talk to staff"). */
export default async function LiveChatAdminPage() {
  const actor = await adminPageActor('live-chat');
  return (
    <LiveChatPanel
      staffId={actor.id}
      staffName={staffFirstName(actor.fullName || actor.username)}
    />
  );
}
