import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import FrontDesk from '@/components/admin/FrontDesk';
import { currentAdmin } from '@/lib/admin/access';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Front desk' };

/** Ocular visits and today's agenda for every staff account (docs/visits.md). */
export default async function FrontDeskPage() {
  const actor = await currentAdmin();
  if (!actor) redirect('/admin');
  if (actor.mustChangePassword) redirect('/admin/profile');
  return <FrontDesk />;
}
