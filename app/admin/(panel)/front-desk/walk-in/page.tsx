import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import WalkInBooking from '@/components/admin/WalkInBooking';
import { currentAdmin } from '@/lib/admin/access';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Walk-in booking' };

/**
 * Walk-in booking at the Front desk (docs/walk-ins.md). `?visit=<id>` starts from an ocular
 * visit and `?booking=<id>` from an earlier booking of the same client; only ids travel in the
 * address, never contact details.
 */
export default async function WalkInPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const actor = await currentAdmin();
  if (!actor) redirect('/admin');
  if (actor.mustChangePassword) redirect('/admin/profile');
  const params = await searchParams;
  const id = (value: string | string[] | undefined) =>
    typeof value === 'string' && /^[a-z0-9_-]{1,64}$/i.test(value) ? value : null;
  return <WalkInBooking visitId={id(params.visit)} bookingId={id(params.booking)} />;
}
