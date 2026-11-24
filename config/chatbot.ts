import { BRAND } from './brand';
import { policiesData } from './policies';
import { termsData } from './terms';
import { publicFacilities } from './public-facilities';
import { eventPackagePages } from './event-package-pages';
import type { ChatSource } from '@/lib/chatbot/types';

export const websiteChatSources: ChatSource[] = [
  {
    id: 'about-us-story',
    kind: 'venue',
    title: 'About Zion Events Place',
    href: '/about',
    text: [
      `${BRAND.legalName} — ${BRAND.tagline}`,
      'Founded on the belief that every celebration deserves an extraordinary backdrop, Zion Events Place blends breathtaking natural scenery with sophisticated architecture in San Pedro City, Laguna.',
      'What began as a passion for hosting intimate gatherings has blossomed into San Pedro City’s premier event venue.',
      'Track record: 12+ Years of Excellence, 400+ Happy Customers, 500+ Events Organized, and 98% Client Satisfaction.',
    ].join('\n\n'),
    keywords: [
      'about',
      'story',
      'history',
      'zion',
      'venue',
      'overview',
      'experience',
      'years',
      'san pedro',
    ],
  },
  {
    id: 'about-us-advantages',
    kind: 'venue',
    title: 'Why Choose Zion Events Place',
    href: '/about',
    text: [
      'Premium Venue: Meticulously designed interiors featuring elegant finishes and adaptable layouts for any occasion.',
      'Sustainable Celebrations: Partnering with eco-conscious caterers and local suppliers to minimize our environmental footprint.',
      'Seamless Planning: Comprehensive event packages and coordination assistance to ensure a stress-free experience.',
      'Award-Winning Aesthetic: A stunning architectural backdrop recognized for its unique blend of modern style and comfort.',
      'Satisfaction Guarantee: Our commitment to excellence ensures your event runs smoothly, backed by a dedicated service pledge.',
      'Expert Coordination 24/7: Our dedicated team of event specialists is always available to assist with your planning needs.',
    ].join('\n'),
    keywords: [
      'about',
      'advantages',
      'why choose',
      'benefits',
      'coordination',
      'premium',
      'sustainable',
    ],
  },
  {
    id: 'about-us-founders',
    kind: 'venue',
    title: 'Our Founders — Visionaries of Elegance',
    href: '/about',
    text: 'Driven by a shared passion for hospitality and design, our founders established Zion Events Place to redefine the standard for luxury celebrations in San Pedro City. With decades of combined experience in event management, they have cultivated a dedicated team committed to excellence for every occasion.',
    keywords: ['about', 'founders', 'owner', 'vision', 'hospitality', 'team'],
  },
  {
    id: 'location',
    kind: 'venue',
    title: 'Zion location and directions',
    href: '/contact',
    text: `${BRAND.address.full}\n\n${BRAND.directions.join('\n')}`,
    keywords: ['location', 'address', 'directions', 'saan', 'map', 'san pedro', 'laguna'],
  },
  {
    id: 'visits',
    kind: 'venue',
    title: 'Visiting hours and site visits',
    href: '/contact',
    text: `${BRAND.visits.hours.map((entry) => `${entry.days}: ${entry.time}`).join('\n')}\n${BRAND.visits.notice}.`,
    keywords: ['visiting', 'hour', 'opening', 'business', 'tour', 'ocular', 'site visit', 'visit'],
  },
  {
    id: 'contact',
    kind: 'contact',
    title: 'Contact the Zion team',
    href: '/contact',
    text: [
      `Email: ${BRAND.contact.email}`,
      `Phone: ${BRAND.contact.phone}`,
      `Address: ${BRAND.address.full}`,
      `Visiting Hours: ${BRAND.visits.hours.map((entry) => `${entry.days} (${entry.time})`).join(', ')}. ${BRAND.visits.notice}.`,
      `Social Media: ${BRAND.social.map((item) => item.label).join(', ')}`,
      'Use the Contact page or Book Now page to send your inquiry or start planning with the Zion team.',
    ].join('\n'),
    keywords: [
      'contact',
      'team',
      'email',
      'inquiry',
      'telephone',
      'phone',
      'number',
      'facebook',
      'instagram',
      'social',
    ],
  },
  ...publicFacilities.map((space): ChatSource => ({
    id: `facility:${space.id}`,
    kind: 'venue',
    title: `${space.name} (${space.category})`,
    href: '/facilities',
    text: `${space.description}\nKey highlights: ${space.features.map((feature) => feature.label).join('; ')}`,
    keywords: [
      space.name,
      space.category,
      'facility',
      'space',
      'spaces',
      'venue',
      'features',
      ...space.sourceSlugs.map((slug) => slug.replaceAll('-', ' ')),
    ],
  })),
  ...[
    {
      path: '/policies',
      data: policiesData,
      extraKeywords: ['policy', 'policies', 'rules', 'event'],
    },
    {
      path: '/terms',
      data: termsData,
      extraKeywords: ['terms', 'conditions', 'contract', 'agreement', 'policy'],
    },
  ].flatMap(({ path, data, extraKeywords }) =>
    data.flatMap((category) =>
      category.sections.map((section): ChatSource => ({
        id: `${path}-${section.id}`,
        kind: 'policy',
        title: section.title,
        text: section.content.join('\n'),
        href: path,
        keywords: [
          ...extraKeywords,
          ...category.category.toLowerCase().split(/\W+/).filter(Boolean),
          ...section.id.split('-'),
        ],
      })),
    ),
  ),
];

export const packageSourcePaths: Record<string, string> = {
  'wedding-reception': '/events/weddings',
  birthday: '/events/birthdays',
  debut: '/events/debuts',
  'christmas-party': '/events/christmas-party',
  christening: '/events/christening',
  'gender-reveal': '/events/gender-reveal',
};

export const publicEventSources: ChatSource[] = Object.values(eventPackagePages).map((page) => ({
  id: `event-category:${page.eventCategorySlug}`,
  kind: 'venue',
  title: `${page.heroEyebrow} — ${page.heroTitle}`,
  text: [
    page.heroSubtitle,
    page.packageText,
    ...page.contentBlocks.map((block) => block.text),
  ].join('\n\n'),
  href: packageSourcePaths[page.eventCategorySlug],
  keywords: [
    page.eventCategorySlug.replaceAll('-', ' '),
    page.heroEyebrow.toLowerCase(),
    'event',
    'package',
    'celebration',
  ],
}));

// Backup package catalog used when live database package records are unavailable.
export const backupPackageSources: ChatSource[] = [
  {
    id: 'backup-pkg-wedding-classic',
    kind: 'package',
    title: 'Wedding Reception — Zion Classic',
    href: '/events/weddings',
    text: 'Published package price: ₱165,000\nGuests included: 50 to 80 pax\nInclusions: Exclusive 6-hour venue access (Selah Indoor Hall & Pavilion Garden), curated styling & backdrop, buffet catering setup, basic sound & lighting, and on-the-day coordination.',
    keywords: ['wedding', 'classic', 'package', 'price', 'inclusion', 'reception'],
  },
  {
    id: 'backup-pkg-wedding-premium',
    kind: 'package',
    title: 'Wedding Reception — Zion Premium',
    href: '/events/weddings',
    text: 'Published package price: ₱245,000\nGuests included: 80 to 100 pax\nInclusions: Full venue access (Selah Indoor Hall, Pavilion Garden, and Pool Deck), bespoke floral styling, full-course catering, photo & video coverage, hair & makeup, LED wall & pro lights/sounds, and full coordination.',
    keywords: ['wedding', 'premium', 'package', 'price', 'inclusion', 'reception'],
  },
  {
    id: 'backup-pkg-wedding-ultimate',
    kind: 'package',
    title: 'Wedding Reception — Zion Ultimate',
    href: '/events/weddings',
    text: 'Published package price: ₱350,000\nGuests included: 100 to 120 pax\nInclusions: All-inclusive luxury wedding with pre-event shoot access, designer ceremony & reception styling, elevated banquet menu, bridal suite prep access, premium photo & video team, HMUA, host, grazing table, and end-to-end coordination.',
    keywords: ['wedding', 'ultimate', 'package', 'price', 'inclusion', 'reception'],
  },
  {
    id: 'backup-pkg-debut',
    kind: 'package',
    title: 'Debut — Classic, Premium & Ultimate Packages',
    href: '/events/debuts',
    text: 'Published package prices: Starting at ₱150,000 (Classic) up to ₱280,000+ (Ultimate)\nGuests included: 50 to 120 pax\nInclusions: Exclusive venue access, themed debut styling & stage backdrop, 18 roses/candles/treasures program support, catering, lights & sounds, LED wall, and event coordination.',
    keywords: ['debut', '18th', 'birthday', 'package', 'price', 'inclusion'],
  },
  {
    id: 'backup-pkg-birthday',
    kind: 'package',
    title: 'Birthday — Classic & Premium Packages',
    href: '/events/birthdays',
    text: 'Published package prices: ₱100,000 to ₱220,000\nGuests included: 50 to 120 pax\nInclusions: Venue access, customized birthday styling, catering buffet, sound system & lighting, tables and chairs with linens, and on-the-day coordination.',
    keywords: ['birthday', 'party', 'package', 'price', 'inclusion'],
  },
  {
    id: 'backup-pkg-christening',
    kind: 'package',
    title: 'Christening — Intimate & Classic Packages',
    href: '/events/christening',
    text: 'Published package prices: ₱80,000 to ₱180,000\nGuests included: 50 to 100 pax\nInclusions: Exclusive venue access, elegant christening table & backdrop styling, family-friendly banquet catering, sound system, and event coordination.',
    keywords: ['christening', 'baptism', 'package', 'price', 'inclusion'],
  },
  {
    id: 'backup-pkg-gender-reveal',
    kind: 'package',
    title: 'Gender Reveal — Intimate & Classic Packages',
    href: '/events/gender-reveal',
    text: 'Published package prices: ₱80,000 to ₱180,000\nGuests included: 50 to 100 pax\nInclusions: Venue access, custom gender-reveal styling & photo backdrop, catering menu, sound system, and event coordination.',
    keywords: ['gender reveal', 'baby', 'package', 'price', 'inclusion'],
  },
  {
    id: 'backup-pkg-christmas',
    kind: 'package',
    title: 'Christmas Party & Corporate Celebrations',
    href: '/events/christmas-party',
    text: 'Published package prices: Starting at ₱150,000\nGuests included: 50 to 120 pax\nInclusions: Exclusive venue access, festive holiday styling, banquet catering, stage, built-in LED wall, lights & sounds, and event coordination.',
    keywords: ['christmas', 'holiday', 'corporate', 'party', 'package', 'price', 'inclusion'],
  },
];
