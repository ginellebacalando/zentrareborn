import type { EventPackageMediaKey } from './event-package-pages';

/**
 * Real photos of each event type at Zion for the event package pages (docs/event-pages.md). Only
 * photos from Zion's own folders are listed (camera originals and the gallery the team received);
 * web, stock and generated images stay out. An event without a real photo yet has no hero (the
 * page shows a text header) and an empty gallery. Blur placeholders come from
 * config/photo-placeholders.ts (npm run photos:placeholders).
 */
export type EventPhoto = { src: string; alt: string };

/** The gallery page's categories (components/client/CategorizedGallery.tsx), as URL values. */
export const GALLERY_CATEGORY_SLUGS = {
  weddings: 'Weddings',
  'debuts-birthdays': 'Debuts & Birthdays',
  'christenings-reveals': 'Christenings & Reveals',
  'corporate-events': 'Corporate & Events',
} as const;
export type GalleryCategorySlug = keyof typeof GALLERY_CATEGORY_SLUGS;

export type EventPhotoSet = {
  hero: EventPhoto | null;
  gallery: readonly EventPhoto[];
  galleryCategory: GalleryCategorySlug;
};

export const eventPhotos: Record<EventPackageMediaKey, EventPhotoSet> = {
  weddings: {
    hero: {
      src: '/images/events/weddings/dsc04833.webp',
      alt: 'A garden wedding ceremony set up beside the Zion pavilion, with the city beyond',
    },
    gallery: [
      {
        src: '/images/events/weddings/wedding1.webp',
        alt: 'A couple at their outdoor wedding ceremony at Zion, surrounded by guests',
      },
      {
        src: '/images/events/weddings/wedding2.webp',
        alt: 'A newly married couple celebrating beneath the evening lights at Zion',
      },
      {
        src: '/images/events/weddings/wedding3.webp',
        alt: 'Newlyweds dancing beneath a floral wedding arch',
      },
      {
        src: '/images/events/weddings/wedding5.webp',
        alt: 'A wedding couple posing beside the Zion pavilion',
      },
      {
        src: '/images/events/weddings/wedding6.webp',
        alt: 'A bride and groom walking together after their ceremony',
      },
      {
        src: '/images/events/weddings/dsc03592.webp',
        alt: 'Newlyweds celebrating beneath a floral ceremony arch',
      },
      {
        src: '/images/events/weddings/dsc04890.webp',
        alt: 'Reception tables set in the Zion garden overlooking the city',
      },
      {
        src: '/images/events/weddings/dsc08346.webp',
        alt: 'A bride and groom seated at their outdoor wedding ceremony',
      },
    ],
    galleryCategory: 'weddings',
  },
  debuts: {
    hero: {
      src: '/images/events/debuts-birthdays/debut11.webp',
      alt: 'A debutant in a blue gown in the Zion garden, set up for her debut with the pavilion behind',
    },
    gallery: [
      {
        src: '/images/events/debuts-birthdays/debut1.webp',
        alt: 'A debutant in a formal gown at her celebration table',
      },
      {
        src: '/images/events/debuts-birthdays/debut2.webp',
        alt: 'A debut reception table styled in blue and gold',
      },
      {
        src: '/images/events/debuts-birthdays/debut3.webp',
        alt: 'A debutant in a pink gown above the Zion skyline',
      },
      {
        src: '/images/events/debuts-birthdays/debut4.webp',
        alt: 'A debutant posing against the panoramic view at Zion',
      },
      {
        src: '/images/events/debuts-birthdays/debut5.webp',
        alt: 'A debut portrait among the garden greenery',
      },
      {
        src: '/images/events/debuts-birthdays/debut6.webp',
        alt: 'A debutant photographed against the view from Zion',
      },
      {
        src: '/images/events/debuts-birthdays/debut7.webp',
        alt: 'A debutant showing her gown at the scenic overlook',
      },
      {
        src: '/images/events/debuts-birthdays/debut9.webp',
        alt: 'A debutant in a pink gown overlooking the city at Zion',
      },
    ],
    galleryCategory: 'debuts-birthdays',
  },
  birthdays: {
    hero: {
      src: '/images/events/debuts-birthdays/birthday.webp',
      alt: 'Colorful party tables set up under the Zion pavilion for a birthday',
    },
    gallery: [
      {
        src: '/images/events/debuts-birthdays/birthday1.webp',
        alt: 'A pink balloon birthday set-up at the Zion gazebo',
      },
      {
        src: '/images/venue/venue-5.webp',
        alt: 'A pink and gold balloon birthday backdrop with a dessert table',
      },
      {
        src: '/images/events/debuts-birthdays/birthday.webp',
        alt: 'Colorful party tables set up under the Zion pavilion for a birthday',
      },
    ],
    galleryCategory: 'debuts-birthdays',
  },
  christening: {
    hero: {
      src: '/images/events/christenings/christening6.webp',
      alt: 'Guests on the Zion lawn overlooking the city after a christening',
    },
    gallery: [
      {
        src: '/images/events/christenings/christening.webp',
        alt: 'Parents celebrating their baby at a christening reception',
      },
      {
        src: '/images/events/christenings/christening1.webp',
        alt: 'A family portrait on the lawn during a christening celebration',
      },
      {
        src: '/images/events/christenings/christening2.webp',
        alt: 'Parents caring for their child during a family milestone',
      },
      {
        src: '/images/events/christenings/christening3.webp',
        alt: 'Parents and their child posing at a christening backdrop',
      },
      {
        src: '/images/events/christenings/christening4.webp',
        alt: 'Parents kissing their baby during the celebration',
      },
      {
        src: '/images/events/christenings/christening5.webp',
        alt: 'Family and godparents gathered on the lawn for a christening',
      },
    ],
    galleryCategory: 'christenings-reveals',
  },
  // No photo here can be confirmed as taken at Zion yet (to collect from Zion).
  genderReveal: { hero: null, gallery: [], galleryCategory: 'christenings-reveals' },
  // The Christmas photos on file show other venues' ballrooms (to collect from Zion).
  christmasParty: { hero: null, gallery: [], galleryCategory: 'corporate-events' },
};
