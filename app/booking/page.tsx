import type { Metadata } from 'next';

import BookingJourneyClient from './_components/BookingJourneyClient';

export const metadata: Metadata = {
  title: 'Event Booking Journey | Zion Events Place',
  description:
    'Plan your celebration step by step through Zion Events Place milestones and receive a personalized booking summary.',
};

export default function BookingPage() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="public-page responsive-page min-h-screen bg-transparent"
    >
      <BookingJourneyClient />
    </main>
  );
}
