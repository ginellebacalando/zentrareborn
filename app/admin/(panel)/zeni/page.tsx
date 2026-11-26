import type { Metadata } from 'next';
import ZeniPanel from '@/components/admin/ZeniPanel';
import { adminPageActor } from '@/lib/admin/page-access';
import type { ZeniAdminOverview } from '@/lib/chatbot/admin-types';
import { zeniAdminOverview } from '@/services/chatbot/admin-overview';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Zeni' };

/** Zeni tools for SUPERADMIN and ADMIN accounts (currentAdmin admits only those roles). */
export default async function ZeniAdminPage() {
  await adminPageActor('zeni');
  let overview: ZeniAdminOverview | null = null;
  try {
    overview = await zeniAdminOverview();
  } catch {
    console.error('[zeni] The admin overview could not be loaded.');
  }
  return <ZeniPanel initial={overview} />;
}
