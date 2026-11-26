import type { Metadata } from 'next';
import AutomationPanel from '@/components/admin/AutomationPanel';
import { adminPageActor } from '@/lib/admin/page-access';

export const metadata: Metadata = { title: 'Automation' };

/** Email automation status and recovery; super administrators only (lib/admin/permissions.ts). */
export default async function AutomationPage() {
  await adminPageActor('automation');
  return <AutomationPanel />;
}
