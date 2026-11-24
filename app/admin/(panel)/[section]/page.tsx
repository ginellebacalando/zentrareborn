import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { redirect } from 'next/navigation';
import AdminWorkspace from '@/components/admin/AdminWorkspace';
import { adminPageLabel } from '@/components/admin/navigation';
import { currentAdmin } from '@/lib/admin/access';

const sections = [
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
];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ section: string }>;
}): Promise<Metadata> {
  const { section } = await params;
  return sections.includes(section) ? { title: adminPageLabel(section) } : {};
}

export default async function Page({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!sections.includes(section)) notFound();
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
