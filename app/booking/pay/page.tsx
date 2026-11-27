import type { Metadata } from 'next';
import { BRAND } from '@/config/brand';
import FindPaymentPage from './_components/FindPaymentPage';

export const metadata: Metadata = {
  title: `Find my payment page | ${BRAND.wordmark}`,
  description:
    'Get the link to your private Zion Events Place payment page by email: enter your booking reference and the email you used.',
};

/**
 * "Find my payment page": a client who lost the email gets the link to their private payment page
 * again (docs/booking-automation.md). The page itself is /booking/pay/<signed token>.
 */
export default function FindPaymentPageRoute() {
  return (
    <main id="main-content" tabIndex={-1} className="public-page">
      <FindPaymentPage />
    </main>
  );
}
