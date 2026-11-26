import { BRAND } from './brand';
import { policiesData } from './policies';
import { termsData } from './terms';
import { publicFacilities } from './public-facilities';
import { eventPackagePages, type EventPackageMediaKey } from './event-package-pages';
import { packageBooklets, type BookletPackage } from './package-booklets';
import { bookletCatalog } from './package-catalog';
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
    href: '/visit',
    text: `${BRAND.visits.hours.map((entry) => `${entry.days}: ${entry.time}`).join('\n')}\n${BRAND.visits.notice}. Choose an open day and time on the visit page; a confirmation email with a calendar invitation follows right away.`,
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

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/**
 * The package booklets shown on the event pages: one source per booklet section (menu, styling,
 * sound…) and one overview per package. Rates come from the package catalog, which
 * scripts/sync-package-catalog.ts keeps in line with these booklets, so they are not repeated
 * here: Zeni has one source for each price. A package offered on several event pages is listed
 * once.
 */
function bookletSources(): ChatSource[] {
  const packages = new Map<string, { item: BookletPackage; events: string[]; href: string }>();
  for (const [key, booklet] of Object.entries(packageBooklets) as Array<
    [EventPackageMediaKey, (typeof packageBooklets)[EventPackageMediaKey]]
  >) {
    const page = eventPackagePages[key];
    const event = page.heroEyebrow.replace(/\s+Packages?$/i, '');
    for (const item of booklet.packages) {
      const entry = packages.get(item.id);
      if (entry) entry.events.push(event);
      else
        packages.set(item.id, {
          item,
          events: [event],
          href: packageSourcePaths[page.eventCategorySlug] ?? '/events/weddings',
        });
    }
  }
  return [...packages.values()].flatMap(({ item, events, href }) => {
    const eventNames = events.join(', ');
    const keywords = ['package', 'inclusion', item.name, ...events];
    // "What is included" says nothing as a heading; such a package's list is its own source.
    const headings = item.sections
      .map((section) => section.title)
      .filter((title) => !/^what is included$/i.test(title));
    const overview: ChatSource = {
      id: `booklet:${item.id}`,
      kind: 'package',
      title: `${item.name} package (${eventNames})`,
      subject: `${item.name} package inclusions`,
      packageName: item.name,
      href,
      text: [
        [item.series, item.name].filter(Boolean).join(': ') +
          (item.tagline ? ` — ${item.tagline}.` : '.'),
        item.description,
        item.idealFor?.length ? `Ideal for: ${item.idealFor.join(', ')}.` : '',
        item.availability ? `Available: ${item.availability}.` : '',
        headings.length
          ? `${item.includesFrom ? `Everything in ${item.includesFrom}, plus` : 'Includes'}: ${headings
              .map((title) => title.toLowerCase())
              .join('; ')}.`
          : '',
        ...(item.schedule ?? []),
        ...(item.notes ?? []),
      ]
        .filter(Boolean)
        .join('\n'),
      keywords: [
        ...keywords,
        'overview',
        'what is included',
        // Only a booklet that promises "no hidden charges" answers "is the rate all-in?".
        ...((item.notes ?? []).some((note) => /hidden charges/i.test(note))
          ? ['all-in', 'hidden charges']
          : []),
      ],
    };
    const sections = item.sections.map((section): ChatSource => ({
      id: `booklet:${item.id}:${slug(section.title)}`,
      kind: 'package',
      title: `${item.name} (${eventNames}): ${section.title}`,
      subject: section.title,
      packageName: item.name,
      href,
      text: [section.intro, ...section.items].filter(Boolean).join('\n'),
      keywords: [...keywords, section.title],
    }));
    return [overview, ...sections];
  });
}

export const bookletChatSources: ChatSource[] = bookletSources();

/** Event names as the catalog's event categories show them. */
const CATALOG_EVENT_NAMES: Record<string, string> = {
  'wedding-reception': 'Weddings',
  debut: 'Debuts',
  birthday: 'Birthdays',
  christening: 'Christening',
  'gender-reveal': 'Gender Reveal',
  'christmas-party': 'Christmas Party',
};
const pesos = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
});

/**
 * Package prices while the admin catalog has no packages: the booklets' published rates in the
 * same form as catalog packages (config/package-catalog.ts), one per guest count.
 */
export const backupPackageSources: ChatSource[] = bookletCatalog.map((row) => ({
  id: `backup-pkg-${row.categorySlug}-${row.slug}`,
  kind: 'package',
  packageName: row.baseName,
  title: `${CATALOG_EVENT_NAMES[row.categorySlug] ?? row.categorySlug} — ${row.packageName}`,
  href: packageSourcePaths[row.categorySlug] ?? '/contact',
  text: [
    `Published package price: ${pesos.format(row.price)}`,
    `Guests included: ${row.paxIncluded}`,
    row.excessPaxFee ? `Each extra guest: ${pesos.format(row.excessPaxFee)}` : '',
    row.description,
    `Inclusions:\n${row.inclusions.map((item) => item.inclusionName).join('\n')}`,
  ]
    .filter(Boolean)
    .join('\n'),
  keywords: [
    'package',
    'price',
    'inclusion',
    row.baseName,
    CATALOG_EVENT_NAMES[row.categorySlug] ?? '',
  ],
}));
