import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import AutomationPanel from '@/components/admin/AutomationPanel';
import { currentAdmin } from '@/lib/admin/access';

export const metadata: Metadata = { title: 'Automation' };

/** Email automation status and recovery for ADMIN and SUPERADMIN accounts. */
export default async function AutomationPage() {
  const actor = await currentAdmin();
  if (!actor) redirect('/admin');
  if (actor.mustChangePassword) redirect('/admin/profile');
  return <AutomationPanel />;
}
