import { redirect } from 'next/navigation';
import { currentAdmin } from '@/lib/admin/access';

export default async function SystemLogsPage() {
  const actor = await currentAdmin();
  if (!actor) redirect('/admin');
  if (actor.mustChangePassword) redirect('/admin/profile');
  redirect('/admin/logs');
}
