import type { EventPackageMediaKey } from './event-package-pages';

/**
 * Zion's package booklet, one per event page (QA, 26 November 2026).
 *
 * Source: the team's 13-page package booklet (the Heyzine flipbook the event pages used to embed),
 * retyped word for word as text so it reads clearly at any size, with obvious typing slips fixed
 * ("exlusive", "Celebation", "costumize") and capitals made consistent. Each event page lists only
 * the packages the booklet offers for that event; a package whose "Ideal for" line names the event
 * appears there too. The booklet's "Venue Only" rental is not tied to an event and is not listed.
 *
 * These are the published rates for visitors to read. Booking requests still price against the
 * admin catalog (Packages), which is kept separately.
 */
export type BookletPrice = { guests: number; amount: number };

export type BookletSection = {
  title: string;
  /** A short sentence before the list. */
  intro?: string;
  items: readonly string[];
};

export type BookletPackage = {
  id: string;
  name: string;
  /** The booklet's line under the name, such as "Our most popular wedding package". */
  tagline?: string;
  /** Brand line above some packages, such as "Zion Special Gatherings". */
  series?: string;
  prices: readonly BookletPrice[];
  /** Pesos per guest above the package's guest count. */
  excessPerHead?: number;
  /** A booking condition shown with the price, such as "Mondays to Thursdays only". */
  availability?: string;
  description?: string;
  /** Occasions the booklet recommends the package for. */
  idealFor?: readonly string[];
  /** The package this one builds on: "Includes everything in …, plus:". */
  includesFrom?: string;
  sections: readonly BookletSection[];
  /** Event-day timing, as printed. */
  schedule?: readonly string[];
  notes?: readonly string[];
  ratesEffective?: string;
};

export type PackageBooklet = {
  /** The event's booklet cover from the team's package menu. */
  cover: { src: string; width: number; height: number };
  /** Booking form event key (app/booking/_components/bookingPrefill.ts). */
  bookingEvent:
    'wedding' | 'debut' | 'birthday' | 'christening' | 'christmas-party' | 'gender-reveal';
  packages: readonly BookletPackage[];
};

const COVER = { width: 1763, height: 2813 } as const;

const WEDDING_CLASSIC_SECTIONS: readonly BookletSection[] = [
  {
    title: 'Venue experience',
    items: [
      'Exclusive 5-hour use of The Main Garden and the air-conditioned back-up Indoor Hall',
      '15-hour access to 1 Suite Room and 1 Deluxe Room (7 AM to 10 PM)',
      'Secured parking for up to 45 vehicles with attendant assistance',
      'Back-up generator for an uninterrupted celebration',
    ],
  },
  {
    title: 'Coordination and program management',
    items: [
      'Dedicated wedding management team (8 uniformed coordinators with two-way radios)',
      'Bride and groom managers, technical managers, registration head, floor plan head and support coordinators',
      'Comprehensive pre-event detailing meeting (timeline, supplier directory, floor plan, styling alignment)',
      'Free consultations via FB Messenger (8 AM to 5 PM)',
      'Final coordination meeting for the guest list, program confirmation and last-minute concerns',
    ],
  },
  {
    title: 'Catering (food and beverages)',
    items: [
      'Buffet service with professional waiters and uniformed servers',
      'Menu: 3 main courses (chicken, pork, fish), 1 pasta dish, sides and dessert',
      'Unlimited rice and iced tea (3 hours)',
      'Free plated food tasting for 2 guests (maximum of 2 trials)',
    ],
  },
  {
    title: 'Styling and set-up',
    items: [
      'Dressed rectangular tables with linens',
      'Gold Tiffany chairs with cushions',
      'Flower centerpieces and acrylic table numbers for all guest tables',
      'Table runners and chair ribbons matched to your theme',
      'Elegant white couch and flowered white stage arc',
      '10 pairs of aisle flower arrangements (artificial)',
      'Backdrop styling for the reception',
      'Lighted "Always & Forever" backdrop signage',
      'Glass podium for speakers',
    ],
  },
  {
    title: 'Basic sound system',
    items: [
      'Complete sound system with a program DJ',
      '2 FBT speakers (2,000 watts), an 8-channel mixer and 3 wireless microphones with stands',
      'Free use of a projector and wide screen',
    ],
  },
  {
    title: 'Exclusive freebies',
    items: [
      'White bridal entrance backdrop',
      '1 bottle of red wine for toasting',
      'Round cocktail tables',
      'Acrylic seat chart for registration',
      'Use of the customized selfie mirror',
      'Swimming pool access (7 AM to 5 PM)',
    ],
  },
];

const WEDDING_NOTE =
  'No hidden charges, no corkage for lechon and chopper, and crew meals included for our staff.';

const GRAZING_TABLE =
  'Seasonal fruits, mini doughnuts, mini waffles, kakanin, nachos with cheese, marshmallows, biscuits and melon juice: a light and welcoming treat for your guests.';

const SELAH_HALL: BookletSection = {
  title: 'Selah Hall (new)',
  items: [
    'Grand reception glass hall with fairy-light ceiling treatment and wall drapery',
    '8 ft × 12 ft full reception LED wall display',
    'Premium indoor LED wall set-up for same-day edits (SDE), program visuals, entrance moments, AVP presentations and an immersive reception',
  ],
};

const PROGRAM_HOST: BookletSection = {
  title: 'Professional program host',
  intro: 'A smooth, organized and engaging program from entrance to closing.',
  items: [
    'Choose from our Zion-accredited professional hosts',
    'Program planning and flow design',
    'One dedicated program meeting',
    'A structured and well-managed reception',
  ],
};

const ZION_ESSENTIAL_CELEBRATION: BookletPackage = {
  id: 'zion-essential-celebration',
  name: 'Zion Essential',
  tagline: 'The elegant celebration',
  prices: [
    { guests: 50, amount: 155_000 },
    { guests: 100, amount: 179_000 },
  ],
  excessPerHead: 1_000,
  idealFor: [
    'Adult birthday celebrations',
    'Baptism and christening receptions',
    'Graduation celebrations',
    'Baby showers',
    'Bridal showers',
    'Gender reveal parties',
    'Family thanksgiving gatherings',
    'Simple anniversary celebrations',
  ],
  sections: [
    {
      title: 'Venue experience',
      items: [
        'Exclusive 5-hour use of the Zion Main Garden and Holding Area',
        'Air-conditioned Selah Hall as your exclusive indoor venue and weather back-up',
        'Parking for up to 45 vehicles with parking attendants',
        'Full back-up generator for an uninterrupted celebration',
      ],
    },
    {
      title: 'Catering (food and beverages)',
      intro: 'Prepared and served by our professional catering team.',
      items: [
        'Menu: three (3) main courses, one (1) pasta dish, rice and dessert',
        'Unlimited iced tea (3 hours)',
        'Buffet service with uniformed professional waiters',
        'Complimentary food tasting for two (2) guests',
      ],
    },
    {
      title: 'Signature styling',
      intro: 'Elegantly designed to match your celebration.',
      items: [
        'Fairy-light and ceiling drapery treatment',
        'Themed stage backdrop (balloon or floral)',
        'Gold Tiffany chairs with cushions',
        'Dressed rectangular tables with premium linens',
        'Elegant floral centerpieces',
        'Acrylic table numbers',
        'White celebrant couch',
      ],
    },
    {
      title: 'Sound system and LED wall',
      items: [
        'Professional program DJ',
        'Complete professional sound system',
        'Wireless microphones',
        '8 ft × 12 ft LED wall display with operator',
      ],
    },
    {
      title: 'Complimentary Zion privileges',
      items: [
        'Full-body customized selfie mirror',
        'Reception cocktail tables',
        'Acrylic seating chart display',
      ],
    },
  ],
  notes: [
    'No hidden charges, no corkage fee for lechon and chopper, and no crew meals required for Zion staff.',
  ],
};

const ZION_PRESTIGE: BookletPackage = {
  id: 'zion-prestige',
  name: 'Zion Prestige',
  tagline: 'The ultimate milestone celebration',
  prices: [
    { guests: 50, amount: 240_000 },
    { guests: 100, amount: 269_000 },
  ],
  description:
    "Designed for life's biggest milestones, where every detail is elevated and every guest leaves impressed.",
  idealFor: [
    'Milestone birthdays (21st, 50th, 60th and 70th)',
    'Silver and golden anniversaries',
    'Corporate galas and appreciation nights',
    'Family reunions',
    'Church anniversary celebrations',
    'Awards and recognition nights',
    'Welcome dinners',
    'VIP private celebrations',
  ],
  includesFrom: 'Zion Essential',
  sections: [
    {
      title: 'Grand finale experience',
      intro: 'End your celebration with a breathtaking finale your guests will never forget.',
      items: [
        'Luxury outdoor fireworks display',
        'With a fireworks operator, timed to one song of your choice',
        'Perfect for unforgettable photos and videos',
      ],
    },
    {
      title: 'Live luxury entertainment',
      intro: 'Elegant live performances that elevate the atmosphere throughout your celebration.',
      items: [
        'Professional saxophonist (2 performance sets)',
        'Professional violinist (2 performance sets)',
      ],
    },
    {
      title: 'Zion Prestige styling',
      items: [
        'Luxury long table set-up option',
        'Fresh floral table arrangements',
        'Designer styling details',
        'Premium gazebo floral styling',
      ],
    },
    {
      title: 'Luxury cocktail experience',
      intro:
        'Welcome your guests with an elevated cocktail reception before the celebration begins.',
      items: [
        'Styled grazing table: seasonal fruits, mini doughnuts, mini waffles, nachos with cheese, marshmallows, biscuits and fruit juice refreshments',
      ],
    },
    {
      title: 'Zion hosting experience',
      intro: 'Enjoy a professionally managed celebration from entrance to finale.',
      items: [
        'Zion professional event host',
        'Personalized program planning meeting',
        'Customized program flow',
        'Guest engagement activities',
      ],
    },
    {
      title: 'Exclusive Prestige privileges',
      items: [
        'Complimentary Suite Room',
        'Unlimited photobooth for 3 hours',
        'Complimentary swimming pool access',
        'Private preparation area, accommodates up to five (5) guests',
        'Dedicated event manager',
        'Priority planning meetings',
      ],
    },
  ],
  notes: [
    'No hidden charges, no corkage fee for lechon and chopper, and crew meals included for Zion staff.',
  ],
};

/** Shared by both gender reveal packages: everything up to the décor. */
const GENDER_REVEAL_BASE = [
  'Garden Hall rental accommodating up to 150 guests',
  'Hassle-free parking for 40 cars with attendant service',
  'Swimming pool access from 8 AM to 5 PM',
  'Back-up generator ensuring uninterrupted power',
  'Venue coordinators to manage your event',
  'Managed buffet of 3 main courses (chicken, pork, fish), pasta, sides, dessert, unlimited rice and iced tea for 3 hours',
  '2 professional waiters and uniformed servers',
  'Lights and sound set-up with a DJ for entertainment',
  '3 wireless microphones and 1 wired microphone',
  'Projector with wide screen and operator for presentations',
  'Wooden tables that can be dressed to match your theme',
] as const;

export const packageBooklets: Record<EventPackageMediaKey, PackageBooklet> = {
  weddings: {
    cover: { src: '/images/packages/page-05.png', ...COVER },
    bookingEvent: 'wedding',
    packages: [
      {
        id: 'zion-classic',
        name: 'Zion Classic',
        prices: [
          { guests: 50, amount: 175_000 },
          { guests: 100, amount: 199_000 },
        ],
        excessPerHead: 1_600,
        sections: WEDDING_CLASSIC_SECTIONS,
        notes: [WEDDING_NOTE],
        ratesEffective: 'May 30, 2026',
      },
      {
        id: 'zion-premium',
        name: 'Zion Premium',
        tagline: 'Our most popular wedding package',
        prices: [
          { guests: 50, amount: 275_000 },
          { guests: 100, amount: 299_000 },
        ],
        excessPerHead: 2_000,
        includesFrom: 'Zion Classic',
        sections: [
          SELAH_HALL,
          {
            title: 'Full photo and video coverage + SDE',
            items: [
              'Full-day coverage (preparation to end of reception)',
              'Same-day edit (SDE) wedding film highlights',
              'Aerial drone coverage (venue permitting)',
              '100 enhanced and professionally edited wedding photos',
              'Free 256 GB flash drive for transferring files',
            ],
          },
          {
            title: '30-hour overnight room access',
            items: [
              'Exclusive use of the Suite Room and Deluxe Room',
              'Good for 4 to 5 persons per room',
              'Complimentary swimming pool access',
              '4:00 PM the day before until 10:00 PM on the event day',
            ],
          },
          {
            title: 'Grazing table for cocktail hour',
            intro: 'A styled grazing set-up served during cocktail time.',
            items: [GRAZING_TABLE],
          },
          PROGRAM_HOST,
          {
            title: 'Complimentary photobooth',
            intro: 'Fun, interactive entertainment and souvenirs your guests can take home.',
            items: [
              'Strip-sized frame layout',
              'Unlimited photo sessions for 3 hours (non-stop)',
              'Instant prints for guests',
              'On-site attendant',
              'Soft copy of all photos',
            ],
          },
        ],
        ratesEffective: 'May 10, 2026',
      },
      {
        id: 'zion-ultimate',
        name: 'Zion Ultimate',
        tagline: 'Our most complete and value wedding package',
        prices: [
          { guests: 50, amount: 360_000 },
          { guests: 100, amount: 385_000 },
        ],
        excessPerHead: 2_200,
        includesFrom: 'Zion Premium',
        sections: [
          {
            title: 'Full glam and beauty team',
            items: [
              'Professional bridal hair and makeup (3 looks)',
              'Light grooming for the groom',
              'Unlimited retouches',
              'Hair accessories included',
              'Hair and makeup for 2 mothers (or designated family members)',
            ],
          },
          {
            title: 'Elevated guest experience',
            items: [
              'Choice of a coffee cart (good for 100 guests) or a mobile bar (good for 70 guests)',
              'Professional barista on duty',
              'Hot and iced beverage selections',
              'Styled 2 × 2 booth set-up',
            ],
          },
          {
            title: 'Enhanced catering upgrade',
            items: [
              '4 main courses (chicken, pork, fish, beef)',
              '3-layered all-edible white wedding cake',
            ],
          },
          {
            title: 'Prenup shoot and save-the-date video',
            items: [
              'Prenup photoshoot',
              'Save-the-date video',
              '50 enhanced prenup photos',
              'Free use of the venue for the prenup shoot, with a prep room',
              'Crew meals for the photo and video staff on the day',
            ],
          },
          {
            title: 'Ceremony enhancements',
            items: [
              'Wedding officiating (civil, garden or Christian ceremony)',
              'Processing of the marriage certificate',
              'Fresh bridal bouquet',
              "Groom's boutonniere",
              '20 additional boutonnieres (groomsmen, parents and principal sponsors)',
              '8 mini bouquets',
              '3 flower baskets and a flower crown, with fresh petals for throwing',
            ],
          },
          {
            title: 'Fireworks display',
            items: [
              '1 minute and 20 seconds classic fireworks display',
              'With a fireworks operator',
            ],
          },
        ],
        ratesEffective: 'May 30, 2026',
      },
      {
        id: 'intimate-wedding',
        name: 'Intimate Wedding',
        prices: [{ guests: 30, amount: 170_000 }],
        excessPerHead: 2_000,
        availability: 'Mondays to Thursdays only',
        sections: WEDDING_CLASSIC_SECTIONS.map((section) =>
          section.title === 'Venue experience'
            ? {
                ...section,
                items: [
                  'Exclusive 5-hour use of The Main Garden and the air-conditioned Indoor Hall',
                  ...section.items.slice(1),
                ],
              }
            : section,
        ),
        notes: [WEDDING_NOTE],
        ratesEffective: 'March 1, 2026',
      },
    ],
  },
  debuts: {
    cover: { src: '/images/packages/page-03.png', ...COVER },
    bookingEvent: 'debut',
    packages: [
      {
        id: 'zion-essential-debut',
        name: 'Zion Essential',
        tagline: 'Simple yet elegant debut package',
        prices: [
          { guests: 50, amount: 165_000 },
          { guests: 100, amount: 189_000 },
        ],
        excessPerHead: 1_000,
        sections: [
          {
            title: 'Venue experience',
            items: [
              '5-hour exclusive use of The Main Garden',
              '5-hour exclusive use of the air-conditioned Indoor Holding Hall',
              '12 hours of swimming pool access, from 10:00 AM to 10:00 PM',
              '12 hours of room access to 1 Suite Room (10:00 AM to 10:00 PM)',
              'Secured parking for up to 45 vehicles with attendant assistance',
              'Full back-up generator for an uninterrupted celebration',
            ],
          },
          {
            title: 'Catering (food and beverages)',
            items: [
              'Buffet service with professional waiters and uniformed servers',
              'Menu: 3 main courses (chicken, pork, fish), 1 pasta dish, sides and dessert',
              'Unlimited rice and iced tea (3 hours)',
              'Complimentary plated food tasting for 2 guests (maximum of 2 trials)',
            ],
          },
          {
            title: 'Styling and set-up',
            intro: 'Clean, cohesive styling suited to your celebration theme.',
            items: [
              'Dressed rectangular tables with linens',
              'Gold Tiffany chairs with cushions',
              'Flower centerpieces and acrylic table numbers',
              'Themed stage backdrop (balloon or floral)',
              'Elegant white couch and flowered stage',
            ],
          },
          {
            title: 'Basic sound system',
            items: [
              'Complete sound system with a program DJ',
              '2 FBT speakers (2,000 watts), an 8-channel mixer and 3 wireless microphones with stands',
              'Free use of a projector and wide screen',
            ],
          },
          {
            title: 'Exclusive freebies',
            items: [
              'Full-body customized selfie mirror',
              'Cocktail tables for the reception set-up',
              'Registration area styling',
              'Acrylic seat chart display',
            ],
          },
        ],
        notes: [
          'No hidden charges, no corkage for lechon and chopper, and no crew meals needed for our staff.',
        ],
      },
      {
        id: 'zion-premium-hassle-free',
        name: 'Zion Premium Hassle-Free',
        tagline: 'Our best seller: the premium debut experience',
        prices: [
          { guests: 50, amount: 250_000 },
          { guests: 100, amount: 289_000 },
        ],
        excessPerHead: 1_200,
        includesFrom: 'Zion Essential',
        sections: [
          SELAH_HALL,
          {
            title: 'Full photo and video coverage + SDE',
            items: [
              'Full-day coverage (preparation to end of reception)',
              'Same-day edit (SDE) debut film highlights',
              'Aerial drone coverage (venue permitting)',
              '100 enhanced and professionally edited debut photos',
            ],
          },
          PROGRAM_HOST,
          {
            title: '3 hours of unlimited photobooth',
            intro: 'Fun, interactive entertainment and souvenirs your guests can take home.',
            items: [
              'Strip-sized frame layout magnet',
              'Unlimited photo sessions for 3 hours (non-stop)',
              'Instant prints for guests',
              'On-site attendant',
              'Soft copy of all photos',
            ],
          },
          {
            title: 'Complimentary debutant freebies',
            items: [
              'Free 3-layered themed birthday cake',
              'Free use of 18 artificial long-stemmed red roses',
              'Free 18 tealight candles',
              'Free 18 shot glasses',
              'Free save-the-date video',
            ],
          },
          {
            title: 'Welcome snacks and drinks',
            intro: 'A styled grazing set-up served during cocktail time.',
            items: [GRAZING_TABLE],
          },
        ],
        notes: ['No hidden charges, no corkage for lechon and chopper, and crew meals included.'],
      },
    ],
  },
  birthdays: {
    cover: { src: '/images/packages/page-02.png', ...COVER },
    bookingEvent: 'birthday',
    packages: [ZION_ESSENTIAL_CELEBRATION, ZION_PRESTIGE],
  },
  christening: {
    cover: { src: '/images/packages/page-06.png', ...COVER },
    bookingEvent: 'christening',
    packages: [
      {
        id: 'christening',
        name: 'Christening',
        series: 'Zion Special Gatherings',
        prices: [
          { guests: 50, amount: 68_000 },
          { guests: 70, amount: 86_000 },
          { guests: 100, amount: 95_000 },
          { guests: 120, amount: 113_000 },
          { guests: 150, amount: 140_000 },
        ],
        sections: [
          {
            title: 'What is included',
            items: [
              'Garden Hall rental accommodating up to 150 guests',
              'Full-day exclusive property use for photoshoots',
              'Choice of rustic or garden décor',
              'Dressed wooden tables and Tiffany chairs',
              'Parking for 40 cars with attendant service',
              'Swimming pool access from 8 AM to 5 PM',
              'Back-up generator ensuring uninterrupted power',
              'Venue coordinators to manage your event',
              '10-hour Suite Room access for preparation and day use',
              'Managed buffet with 3 main courses, pasta, sides, dessert, unlimited rice and iced tea for 3 hours',
              'Professional staff with uniformed servers and waiters',
              'Lights and sound set-up for ambiance',
              '3 wireless microphones and 1 wired microphone',
              'Projector with screen and operator for presentations',
              'White elegant couch as a stylish seating option',
            ],
          },
        ],
      },
      ZION_ESSENTIAL_CELEBRATION,
    ],
  },
  genderReveal: {
    cover: { src: '/images/packages/page-04.png', ...COVER },
    bookingEvent: 'gender-reveal',
    packages: [
      {
        id: 'classic-gender-reveal',
        name: 'Classic Gender Reveal',
        series: 'Zion Special Gatherings',
        prices: [
          { guests: 30, amount: 58_000 },
          { guests: 50, amount: 76_000 },
          { guests: 70, amount: 95_000 },
          { guests: 100, amount: 120_000 },
          { guests: 120, amount: 135_000 },
        ],
        sections: [
          {
            title: 'What is included',
            items: [
              GENDER_REVEAL_BASE[0],
              'Exclusive property use for a private photoshoot (on the day)',
              ...GENDER_REVEAL_BASE.slice(1),
              'Rustic, greenery or wooden set-up for décor',
              'White elegant couch as a stylish seating option',
            ],
          },
        ],
      },
      {
        id: 'premium-gender-reveal',
        name: 'Premium Gender Reveal',
        series: 'Zion Special Gatherings',
        prices: [
          { guests: 30, amount: 79_000 },
          { guests: 50, amount: 97_000 },
          { guests: 70, amount: 115_000 },
          { guests: 100, amount: 140_000 },
          { guests: 120, amount: 155_000 },
        ],
        sections: [
          {
            title: 'What is included',
            items: [
              GENDER_REVEAL_BASE[0],
              'Exclusive property use for photoshoots (on the day)',
              ...GENDER_REVEAL_BASE.slice(1),
              'Themed gender reveal set-up (white minimalist)',
              '2-tier white minimalist cake',
              'Dressed tables and foamed Tiffany chairs',
              'Smoke gender reveal',
            ],
          },
        ],
      },
      ZION_ESSENTIAL_CELEBRATION,
    ],
  },
  christmasParty: {
    cover: { src: '/images/packages/page-07.png', ...COVER },
    bookingEvent: 'christmas-party',
    packages: [
      {
        id: 'starry-night',
        name: 'Starry Night',
        series: 'Zion Christmas Package',
        tagline: 'All-inclusive',
        prices: [{ guests: 100, amount: 135_000 }],
        excessPerHead: 900,
        sections: [
          {
            title: 'Venue',
            items: [
              '12 hours of venue rental for 2 venues (6 hours ingress, 5 hours event proper, 1 hour egress)',
              '2 adjacent venues: the air-conditioned indoor event hall and the Garden',
              'Air-conditioned indoor hall (total area: 240 sq m)',
              'The Garden for cocktails, with rope lights (total area: 330 sq m)',
              'Full-day exclusive property use for photoshoots',
              'Hassle-free parking for 40 cars with attendant',
              'Free use of the swimming pool from 8 AM to 6 PM',
              'Back-up generator',
              '1 Suite Room for preparation, 12:00 PM to 10:00 PM',
              'Security staff',
            ],
          },
          {
            title: 'Food and service',
            items: [
              'Managed buffet: 3 main courses (chicken, pork, fish), pasta, sides, dessert, unlimited rice and unlimited iced tea (for 3 hours)',
              'Professional waiters and uniformed servers',
              'Corkage for lechon and chopper',
              'Corkage for outside alcoholic beverages',
            ],
          },
          {
            title: 'Sound and program',
            items: [
              'Sound system with DJ',
              'Projector screen and operator',
              '2 wireless microphones and 1 wired microphone',
              '10-channel Alto mixer',
              'Glass podium for speakers',
            ],
          },
          {
            title: 'Styling',
            items: [
              'Venue styling and themed company stage design set-up',
              'Tiffany chairs with cushions and ribbons',
              'Basic registration set-up with a free selfie mirror set-up',
              'Photobooth, 4R or strip with frame (unlimited shots for 3 hours)',
              'Souvenir racks, gift tables and cake tables',
            ],
          },
        ],
        schedule: [
          'Ingress: 10 AM to 6 PM',
          'Event proper: 6 PM to 11 PM',
          'Egress: 11 PM to 12 MN',
        ],
        notes: ['We can customize the package depending on your needs.'],
      },
    ],
  },
};
