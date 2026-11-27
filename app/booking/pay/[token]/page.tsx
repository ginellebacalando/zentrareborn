import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { BRAND } from '@/config/brand';
import type { BookingStepRules } from '@/components/client/BookingSteps';
import { readBookingRules } from '@/lib/admin/preferences';
import { errorMetadata } from '@/lib/audit';
import { readPaymentPage } from '@/services/payment-proofs';
import PaymentPage from './_components/PaymentPage';

export const metadata: Metadata = {
  title: `Your payment page | ${BRAND.wordmark}`,
  description: 'Your private Zion Events Place payment page.',
  // A private link: never indexed, and never passed on to other sites as a referrer.
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

/** The days in the step-by-step guide; without Settings the guide leaves the days out. */
async function savedStepRules(): Promise<BookingStepRules | null> {
  try {
    const { paymentDeadlineDays, balanceDueDays } = await readBookingRules();
    return { paymentDeadlineDays, balanceDueDays };
  } catch (error) {
    console.error('Unable to read the booking rules.', errorMetadata(error));
    return null;
  }
}

/**
 * A client's private payment page, reached through the signed link in their booking emails. A
 * genuine token only has URL-safe characters, so it is used as given: anything else, including a
 * malformed link, is simply not found.
 */
export default async function PaymentLinkPage({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { token } = await params;
  const view = await readPaymentPage(token);
  if (view.state === 'invalid') notFound();
  return (
    <main id="main-content" tabIndex={-1} className="public-page">
      <PaymentPage view={view} token={token} rules={await savedStepRules()} />
    </main>
  );
}
