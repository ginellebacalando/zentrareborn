import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import ZeniPanel from '@/components/admin/ZeniPanel';
import { currentAdmin } from '@/lib/admin/access';
import type { ZeniAdminOverview } from '@/lib/chatbot/admin-types';
import { zeniAdminOverview } from '@/services/chatbot/admin-overview';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Zeni' };

/** Zeni tools for SUPERADMIN and ADMIN accounts (currentAdmin admits only those roles). */
export default async function ZeniAdminPage() {
  const actor = await currentAdmin();
  if (!actor) redirect('/admin');
  if (actor.mustChangePassword) redirect('/admin/profile');
  let overview: ZeniAdminOverview | null = null;
  try {
    overview = await zeniAdminOverview();
  } catch {
    console.error('[zeni] The admin overview could not be loaded.');
  }
  return <ZeniPanel initial={overview} />;
}
