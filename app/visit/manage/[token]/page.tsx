import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { BRAND } from '@/config/brand';
import { readVisitManagePage } from '@/services/visits';
import VisitManage from '../../_components/VisitManage';

export const metadata: Metadata = {
  title: `Your ocular visit | ${BRAND.wordmark}`,
  description: 'Reschedule or cancel your ocular visit at Zion Events Place.',
  // A private link: never indexed, and never passed on to other sites as a referrer.
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

/**
 * A visitor's private visit page, reached through the signed link in their visit emails. A
 * genuine token only has URL-safe characters, so it is used as given; anything else is not found.
 */
export default async function VisitManagePage({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { token } = await params;
  const view = await readVisitManagePage(token);
  if (view.state === 'invalid') notFound();
  return (
    <main id="main-content" tabIndex={-1} className="public-page">
      <VisitManage view={view} token={token} />
    </main>
  );
}
