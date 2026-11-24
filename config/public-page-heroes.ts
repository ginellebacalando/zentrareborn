import { eventPackagePages } from './event-package-pages';

export type HeroSlide = {
  title: string;
  subtitle: string;
  imageSrc: string;
  imageAlt: string;
};

export const publicPageHeroes = {
  weddings: eventPackagePages.weddings.heroSlides,
  debuts: eventPackagePages.debuts.heroSlides,
  christening: eventPackagePages.christening.heroSlides,
  birthdays: eventPackagePages.birthdays.heroSlides,
  genderReveal: eventPackagePages.genderReveal.heroSlides,
  christmasParty: eventPackagePages.christmasParty.heroSlides,
  gallery: [
    {
      title: 'A Glimpse of Perfection',
      subtitle:
        'Explore real celebrations and discover the many ways a vision can come to life at Zion.',
      imageSrc: '/images/events/christenings/christening-4.webp',
      imageAlt: 'An elegant event setup featured in the Zion gallery',
    },
    {
      title: 'Every Celebration Has a Story',
      subtitle: 'From weddings to family milestones, each gallery captures a moment made personal.',
      imageSrc: '/images/events/gender-reveals/gender-reveal-4.webp',
      imageAlt: 'Guests celebrating a personal milestone',
    },
    {
      title: 'Spaces Made to Transform',
      subtitle:
        'See how Zion spaces become distinctive settings through thoughtful styling and design.',
      imageSrc: '/images/events/gender-reveals/gender-reveal-2-2.webp',
      imageAlt: 'A Zion venue space transformed for an event',
    },
    {
      title: 'Find Inspiration for Your Day',
      subtitle:
        'Browse meaningful details, memorable backdrops, and ideas for your own celebration.',
      imageSrc: '/images/events/gender-reveals/gender-reveal-3.webp',
      imageAlt: 'Decorative event details at Zion Events Place',
    },
  ],
  about: [
    {
      title: 'The Zion Experience',
      subtitle:
        'Discover a venue where natural beauty, thoughtful service, and meaningful celebrations come together.',
      imageSrc: '/images/events/debuts-birthdays/birthday-2.webp',
      imageAlt: 'The indoor hall at Zion Events Place',
    },
    {
      title: 'A Place Built for Celebration',
      subtitle:
        'Our story began with a belief that every milestone deserves an extraordinary setting.',
      imageSrc: '/images/events/weddings/wedding-2.webp',
      imageAlt: 'The outdoor stage and grounds at Zion Events Place',
    },
    {
      title: 'Hospitality With Heart',
      subtitle: 'Meet the commitment to care, coordination, and service behind every Zion event.',
      imageSrc: '/images/events/weddings/wedding-alt.webp',
      imageAlt: 'The founders and hospitality team behind Zion',
    },
    {
      title: 'A Legacy of Meaningful Moments',
      subtitle:
        'We continue to create spaces where families and communities can celebrate what matters most.',
      imageSrc: '/images/events/weddings/gorgeous-wedding-decor.webp',
      imageAlt: 'The scenic view from Zion Events Place',
    },
  ],
  facilities: [
    {
      title: 'Spaces Designed Around Your Vision',
      subtitle:
        'Explore flexible indoor and outdoor settings created for celebrations of many styles.',
      imageSrc:
        '/images/events/weddings/spring-garden-wedding-of-ej-jaira-khim-cruz-wedding-and-event-designer-florist-stylist.webp',
      imageAlt: 'Selah Hall at Zion Events Place',
    },
    {
      title: 'Selah Hall',
      subtitle:
        'Host your gathering in a refined indoor venue with a bright and elegant atmosphere.',
      imageSrc:
        '/images/events/weddings/spring-garden-inspired-wedding-of-carlo-isabel-khim-cruz-wedding-and-event-designer-florist-stylist.webp',
      imageAlt: 'Interior view of Selah Hall',
    },
    {
      title: 'The Pavilion Garden',
      subtitle:
        'Celebrate outdoors with greenery, open air, and the beauty of the Zion surroundings.',
      imageSrc:
        '/images/events/holidays/elegant-christmas-wedding-ideas-for-a-timeless-holiday-celebration.webp',
      imageAlt: 'The Pavilion Garden event space',
    },
    {
      title: 'The Pool and Scenic Grounds',
      subtitle:
        "Create memorable portraits and relaxed moments across Zion's distinctive outdoor spaces.",
      imageSrc:
        '/images/events/weddings/elegant-lakefront-wedding-ceremony-with-white-floral-arch-luxury-aisle-inspiration.webp',
      imageAlt: 'The pool and scenic grounds at Zion Events Place',
    },
  ],
  testimonies: [
    {
      title: 'Celebrations Remembered',
      subtitle:
        'Read the experiences of people who trusted Zion with their most meaningful occasions.',
      imageSrc: '/images/events/holidays/christmas-party-4.webp',
      imageAlt: 'Clients celebrating a meaningful occasion at Zion',
    },
    {
      title: 'Stories From Real Clients',
      subtitle:
        'Every testimony reflects a unique vision, a shared effort, and a day worth remembering.',
      imageSrc: '/images/events/holidays/christmas-party-2.webp',
      imageAlt: 'Happy clients enjoying their event',
    },
    {
      title: 'Service You Can Feel',
      subtitle:
        'Discover how thoughtful coordination helped our clients celebrate with confidence.',
      imageSrc: '/images/events/holidays/christmas-party-3.webp',
      imageAlt: 'A carefully coordinated event at Zion',
    },
    {
      title: 'Your Story Could Be Next',
      subtitle: 'Begin planning a celebration that you and your guests will be proud to share.',
      imageSrc: '/images/events/corporate/party-decor.webp',
      imageAlt: 'An inviting Zion venue ready for another celebration',
    },
  ],
  contact: [
    {
      title: 'Get in Touch',
      subtitle:
        'Ask about your preferred date, venue options, or the next step in planning your celebration.',
      imageSrc: '/images/events/corporate/corporate-meeting.webp',
      imageAlt: 'The scenic location of Zion Events Place',
    },
    {
      title: 'Plan a Site Visit',
      subtitle: 'See the spaces in person and imagine how your event can come together at Zion.',
      imageSrc:
        '/images/events/corporate/meetings-and-events-at-the-ballantyne-charlotte-north-carolina.webp',
      imageAlt: 'A Zion venue space available for site visits',
    },
    {
      title: 'Talk Through Your Vision',
      subtitle:
        'Share your event needs so our team can guide you toward the most suitable next step.',
      imageSrc: '/images/events/debuts-birthdays/debut-party.webp',
      imageAlt: 'Event details prepared with the Zion planning team',
    },

    {
      title: 'Take the Next Step With Confidence',
      subtitle:
        'A thoughtful celebration begins with a clear conversation and verified availability.',
      imageSrc:
        '/images/events/debuts-birthdays/inside-the-incredible-swan-lake-themed-18th-birthday-costing-41-000.webp',
      imageAlt: 'A completed Zion celebration inspiring a future inquiry',
    },
  ],
  faq: [
    {
      title: 'Answers for Confident Planning',
      subtitle:
        'Find clear guidance about Zion, our event process, and what to expect as you plan.',
      imageSrc: '/images/events/christenings/christening-5.webp',
      imageAlt: 'A wide view of Zion Events Place',
    },
    {
      title: 'Understand the Venue',
      subtitle:
        'Learn about our spaces, location, event setup, and the practical details of your visit.',
      imageSrc: '/images/events/christenings/christening-2.webp',
      imageAlt: 'A Zion venue arranged for an event',
    },
    {
      title: 'Prepare for Your Visit',
      subtitle:
        'Review common questions about availability, packages, venue access, and event planning.',
      imageSrc: '/images/events/christenings/christening-3.webp',
      imageAlt: 'A celebration setup prepared for a venue visit',
    },
    {
      title: 'Know What Happens Next',
      subtitle: 'Get event-day guidance and contact our team whenever you need more specific help.',
      imageSrc: '/images/events/christenings/christening-4.webp',
      imageAlt: 'Guests enjoying a well-prepared event day',
    },
  ],
  rules: [
    {
      title: 'Celebrate With Care',
      subtitle:
        'Review the venue guidelines that help every Zion event remain safe, smooth, and enjoyable.',
      imageSrc: '/images/events/gender-reveals/gender-reveal-4.webp',
      imageAlt: 'The grounds of Zion Events Place',
    },
    {
      title: 'Prepare for a Smooth Setup',
      subtitle:
        'Coordinate schedules, suppliers, and venue access with the Zion team before event day.',
      imageSrc: '/images/events/gender-reveals/gender-reveal-2-2.webp',
      imageAlt: 'A professionally prepared Zion event space',
    },
    {
      title: 'Keep Every Guest Safe',
      subtitle:
        'Respect approved layouts, venue boundaries, and safety instructions throughout your celebration.',
      imageSrc: '/images/events/gender-reveals/gender-reveal-3.webp',
      imageAlt: 'The pool and event grounds at Zion',
    },
    {
      title: 'End the Event Responsibly',
      subtitle:
        'Follow the agreed program, supplier pull-out schedule, and venue closeout process.',
      imageSrc: '/images/events/debuts-birthdays/birthday-2.webp',
      imageAlt: 'A completed event ready for an orderly closeout',
    },
  ],
  terms: [
    {
      title: 'Terms & Conditions',
      subtitle: 'Clear and transparent agreements for a smooth and successful event.',
      imageSrc: '/images/events/weddings/wedding-2.webp',
      imageAlt: 'A beautiful wedding setup at Zion',
    },
    {
      title: 'Protecting Your Investment',
      subtitle: 'Learn about our booking, payment, and security policies.',
      imageSrc: '/images/events/christenings/christening-5.webp',
      imageAlt: 'A joyful christening event',
    },
    {
      title: 'Understanding Responsibilities',
      subtitle: 'Clear guidelines for logistics, decorations, and outside suppliers.',
      imageSrc: '/images/events/debuts-birthdays/birthday-2.webp',
      imageAlt: 'A lively birthday celebration',
    },
    {
      title: 'Ensuring Event Safety',
      subtitle: 'Commitments to guest conduct, safety, and liability.',
      imageSrc: '/images/events/corporate/corporate-meeting.webp',
      imageAlt: 'An organized corporate setup',
    },
  ],
} as const satisfies Record<string, readonly [HeroSlide, HeroSlide, HeroSlide, HeroSlide]>;

export type PublicPageHeroKey = keyof typeof publicPageHeroes;
