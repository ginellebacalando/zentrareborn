import { notFound } from 'next/navigation';
import { redirect } from 'next/navigation';
import AdminWorkspace from '@/components/admin/AdminWorkspace';
import { currentAdmin } from '@/lib/admin/access';
export default async function Page({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (
    ![
      'dashboard',
      'bookings',
      'contracts',
      'calendar',
      'inquiries',
      'payments',
      'services',
      'analytics',
      'team',
      'logs',
      'profile',
      'settings',
    ].includes(section)
  )
    notFound();
  const actor = await currentAdmin();
  if (!actor) redirect('/admin');
  if (actor.mustChangePassword && section !== 'profile') redirect('/admin/profile');
  return (
    <AdminWorkspace
      section={section}
      owner={actor.role === 'SUPERADMIN'}
      adminName={section === 'dashboard' ? actor.fullName?.trim() || actor.username : undefined}
    />
  );
}
