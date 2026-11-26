import type { Metadata } from 'next';
import { adminPageActor } from '@/lib/admin/page-access';
import AdminWorkspace from '@/components/admin/AdminWorkspace';

export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const actor = await adminPageActor('settings');
  return <AdminWorkspace section="settings" role={actor.role} />;
}
