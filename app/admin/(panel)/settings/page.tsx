import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { currentAdmin } from '@/lib/admin/access';
import AdminWorkspace from '@/components/admin/AdminWorkspace';

export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const actor = await currentAdmin();
  if (!actor) redirect('/admin');
  if (actor.mustChangePassword) redirect('/admin/profile');
  return <AdminWorkspace section="settings" owner={actor.role === 'SUPERADMIN'} />;
}
