import type { Metadata } from 'next';
import { connection } from 'next/server';
import ClientFeatureUnavailable from '@/components/client/ClientFeatureUnavailable';
import { getClientFeatureAvailability } from '@/lib/system-settings';
import TestimoniesClient from './_components/TestimoniesClient';

export const metadata: Metadata = {
  title: 'Client Testimonies | Zion Events Place',
  description:
    'Read real experiences from clients who celebrated their special events with Zion Events Place.',
};

export default async function TestimoniesPage() {
  await connection();
  const testimonyAvailability = await getClientFeatureAvailability('publicTestimonies');
  const submissionAvailability = await getClientFeatureAvailability('testimonySubmissions');

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="public-page responsive-page relative flex min-h-screen flex-col bg-transparent pt-20"
    >
      {testimonyAvailability.enabled ? (
        <TestimoniesClient
          allowSubmissions={submissionAvailability.enabled}
          disabledMessage={submissionAvailability.message}
        />
      ) : (
        <ClientFeatureUnavailable
          title="Testimonies Are Paused"
          message={testimonyAvailability.message}
        />
      )}
    </main>
  );
}
