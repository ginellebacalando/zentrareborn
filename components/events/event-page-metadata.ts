import type { Metadata } from 'next';
import { BRAND } from '@/config/brand';
import { eventPackagePages, type EventPackageMediaKey } from '@/config/event-package-pages';

/** The title and description search engines and link previews show for an event page. */
export function eventPageMetadata(eventType: EventPackageMediaKey): Metadata {
  const page = eventPackagePages[eventType];
  return {
    title: `${page.heroEyebrow} | ${BRAND.wordmark}`,
    description: page.heroSubtitle,
  };
}
