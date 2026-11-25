import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { BRAND } from '@/config/brand';
import { readPaymentPage } from '@/services/payment-proofs';
import PaymentPage from './_components/PaymentPage';

export const metadata: Metadata = {
  title: `Your payment page | ${BRAND.wordmark}`,
  description: 'Your private Zion Events Place payment page.',
  // A private link: never indexed, and never passed on to other sites as a referrer.
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

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
  return <PaymentPage view={view} token={token} />;
}
