import type { Metadata } from 'next';
import InvitationForm from '@/components/admin/InvitationForm';
import { readInvitation } from '@/lib/admin/invitations';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Set up your account' };

/** Where an invited administrator chooses a password (lib/admin/invitations.ts). */
export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <InvitationForm token={token} invitation={await readInvitation(token)} />;
}
