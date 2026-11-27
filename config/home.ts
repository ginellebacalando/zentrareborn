import { eventPackagePages, type EventPackageMediaKey } from './event-package-pages';

/** Home page content, in the order of the team's Figma home frame. */

export type HomeHeroSlide = {
  title: string;
  subtitle: string;
  imageSrc: string;
  imageAlt: string;
};

export const homeHeroSlides: readonly HomeHeroSlide[] = [
  {
    title: 'Elevate your day',
    subtitle: 'Weddings, debuts and milestones framed by the views of San Pedro, Laguna',
    imageSrc:
      '/images/events/weddings/elegant-lakefront-wedding-ceremony-with-white-floral-arch-luxury-aisle-inspiration.webp',
    imageAlt: 'A wedding aisle with a white floral arch at Zion Events Place',
  },
  {
    title: 'Celebrate in the garden',
    subtitle: 'Pavilion Garden for vows, cocktails and receptions under the open sky',
    imageSrc: '/images/venue/venue-view.webp',
    imageAlt: 'Pavilion Garden ceremony setup overlooking the skyline at sunset',
  },
  {
    title: 'Gather in Selah Hall',
    subtitle: 'Air-conditioned comfort, an LED wall and panoramic views for up to 100 guests',
    imageSrc: '/images/about/about-story-2.webp',
    imageAlt: 'Elegant interior of Selah Hall prepared for a formal celebration',
  },
  {
    title: 'Golden hour by the pool',
    subtitle: 'Sunset portraits and poolside moments your guests will remember',
    imageSrc: '/images/venue/zion-pool-sunset.webp',
    imageAlt: 'The pool at Zion Events Place at sunset',
  },
];

/** `href` opens the photo's category in the gallery (GALLERY_CATEGORY_SLUGS, config/event-photos.ts). */
export type HomeArchivePhoto = { src: string; caption: string; href: string };

export const homeArchivePhotos: readonly HomeArchivePhoto[] = [
  {
    src: '/images/events/weddings/wedding-2.webp',
    caption: 'Wedding',
    href: '/gallery?category=weddings',
  },
  {
    src: '/images/events/christenings/christening-4.webp',
    caption: 'Christening',
    href: '/gallery?category=christenings-reveals',
  },
  {
    src: '/images/events/debuts-birthdays/birthday-2.webp',
    caption: 'Birthday',
    href: '/gallery?category=debuts-birthdays',
  },
  {
    src: '/images/events/gender-reveals/gender-reveal-4.webp',
    caption: 'Gender reveal',
    href: '/gallery?category=christenings-reveals',
  },
];

type EventCardSource = { key: EventPackageMediaKey; label: string; href: string };

const eventCardSources: readonly EventCardSource[] = [
  { key: 'weddings', label: 'Weddings', href: '/events/weddings' },
  { key: 'debuts', label: 'Debuts', href: '/events/debuts' },
  { key: 'birthdays', label: 'Birthdays', href: '/events/birthdays' },
  { key: 'christening', label: 'Christenings', href: '/events/christening' },
  { key: 'genderReveal', label: 'Gender reveals', href: '/events/gender-reveal' },
  { key: 'christmasParty', label: 'Christmas parties', href: '/events/christmas-party' },
];

export type HomeEventCard = {
  label: string;
  title: string;
  href: string;
  imageSrc: string;
  imageAlt: string;
};

/** One portrait card per event type, reusing each event page's own title and first hero photo. */
export const homeEventCards: readonly HomeEventCard[] = eventCardSources.map(
  ({ key, label, href }) => {
    const page = eventPackagePages[key];
    return {
      label,
      title: page.heroTitle,
      href,
      imageSrc: page.heroSlides[0].imageSrc,
      imageAlt: page.heroSlides[0].imageAlt,
    };
  },
);
