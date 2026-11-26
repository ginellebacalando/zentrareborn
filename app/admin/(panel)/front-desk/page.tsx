import type { Metadata } from 'next';
import FrontDesk from '@/components/admin/FrontDesk';
import { adminPageActor } from '@/lib/admin/page-access';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Front desk' };

/** Ocular visits and today's agenda for every staff account (docs/visits.md). */
export default async function FrontDeskPage() {
  await adminPageActor('front-desk');
  return <FrontDesk />;
}
