import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import AdminWorkspace from '@/components/admin/AdminWorkspace';
import { adminPageLabel } from '@/components/admin/navigation';
import { adminPageActor } from '@/lib/admin/page-access';
import { isAdminPage } from '@/lib/admin/permissions';

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
  if (!sections.includes(section) || !isAdminPage(section)) notFound();
  // Signed out, password change pending or a page this role may not open (403): see page-access.
  const actor = await adminPageActor(section);
  return (
    <AdminWorkspace
      section={section}
      role={actor.role}
      adminName={section === 'dashboard' ? actor.fullName?.trim() || actor.username : undefined}
    />
  );
}
