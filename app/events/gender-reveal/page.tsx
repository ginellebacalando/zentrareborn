import type { Metadata } from 'next';
import PackageLayout from '@/components/events/PackageLayout';
import { eventPageMetadata } from '@/components/events/event-page-metadata';

export const metadata: Metadata = eventPageMetadata('genderReveal');

export default function GenderRevealPage() {
  return <PackageLayout eventType="genderReveal" />;
}
