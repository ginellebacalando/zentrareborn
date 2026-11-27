import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import BookingPage from '@/components/admin/BookingPage';
import { adminPageActor } from '@/lib/admin/page-access';
import { isAdminPage } from '@/lib/admin/permissions';
import { prisma } from '@/lib/prisma';

type Props = { params: Promise<{ reference: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { reference } = await params;
  return { title: `Booking ${reference}` };
}

/**
 * One booking on its own page (docs/admin-design.md, "Booking page"). Access follows the Bookings
 * page; the reference in the address is looked up here, and the page loads the booking itself.
 */
export default async function Page({ params }: Props) {
  const { reference } = await params;
  if (!isAdminPage('bookings')) notFound();
  // Signed out, password change pending or a role that may not open Bookings: see page-access.
  const actor = await adminPageActor('bookings');
  const booking = await prisma.adminBooking.findUnique({
    where: { reference },
    select: { id: true },
  });
  if (!booking) notFound();
  return <BookingPage bookingId={booking.id} role={actor.role} />;
}
