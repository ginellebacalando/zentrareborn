import { BRAND } from './brand';
import { policiesData } from './policies';
import { termsData } from './terms';
import { publicFacilities } from './public-facilities';
import { eventPackagePages } from './event-package-pages';
import type { ChatSource } from '@/lib/chatbot/types';

export const websiteChatSources: ChatSource[] = [
  {
    id: 'location',
    kind: 'venue',
    title: 'Zion location and directions',
    href: '/contact',
    text: `${BRAND.address.full}\n\n${BRAND.directions.join('\n')}`,
    keywords: ['location', 'address', 'directions', 'saan'],
  },
  {
    id: 'visits',
    kind: 'venue',
    title: 'Visiting hours',
    href: '/contact',
    text: `${BRAND.visits.hours.map((entry) => `${entry.days}: ${entry.time}`).join('\n')}\n${BRAND.visits.notice}.`,
    keywords: ['visiting', 'hour', 'opening', 'business', 'tour', 'ocular'],
  },
  {
    id: 'contact',
    kind: 'contact',
    title: 'Contact the Zion team',
    href: '/contact',
    text: `Email: ${BRAND.contact.email}\nUse the Contact page to send your inquiry to the Zion team.`,
    keywords: ['contact', 'team', 'email', 'inquiry', 'telephone', 'phone', 'number'],
  },
  ...publicFacilities.map((space): ChatSource => ({
    id: `facility:${space.id}`,
    kind: 'venue',
    title: space.name,
    href: '/facilities',
    text: `${space.description}\n${space.features.map((feature) => feature.label).join('; ')}`,
    keywords: [
      space.name,
      space.category,
      'facility',
      'features',
      ...space.sourceSlugs.map((slug) => slug.replaceAll('-', ' ')),
    ],
  })),
  ...[
    { path: '/policies', data: policiesData },
    { path: '/terms', data: termsData },
  ].flatMap(({ path, data }) =>
    data.flatMap((category) =>
      category.sections.map((section): ChatSource => ({
        id: `${path}-${section.id}`,
        kind: 'policy',
        title: section.title,
        text: section.content.join('\n'),
        href: path,
        keywords: ['policy', ...section.id.split('-')],
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
  title: `${page.eventCategorySlug.replaceAll('-', ' ')} at Zion`,
  text: page.contentBlocks.map((block) => block.text).join('\n'),
  href: packageSourcePaths[page.eventCategorySlug],
  keywords: [page.eventCategorySlug.replaceAll('-', ' '), 'event', 'package'],
}));
