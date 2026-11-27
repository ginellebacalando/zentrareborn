import { publicFacilities } from '@/config/public-facilities';
import { eventPackagePages } from '@/config/event-package-pages';
import { eventPhotos } from '@/config/event-photos';
import { packageSourcePaths } from '@/config/chatbot';
import { optimizedPublicMediaPath } from '@/lib/public-media';
import type { ChatSource, ZeniDetailCard } from './types';

type CardLabels = { viewDetails: string; viewPackages: string; startsAt: string };

const eventPages = Object.values(eventPackagePages);

function firstSentence(text: string, limit = 150) {
  const line = text.split('\n').find((part) => part.trim()) ?? '';
  const sentence = line.match(/^.+?[.!?](?:\s|$)/)?.[0] ?? line;
  const trimmed = sentence.trim();
  return trimmed.length <= limit ? trimmed : `${trimmed.slice(0, limit - 1).trimEnd()}…`;
}

function eventPageFor(href: string) {
  return eventPages.find((page) => packageSourcePaths[page.eventCategorySlug] === href);
}

/** The event page's own real photo when it has one (config/event-photos.ts), sharp at any size. */
function eventImage(page: (typeof eventPages)[number]) {
  const image =
    eventPhotos[page.heroKey].hero ?? page.packageCardImages[0] ?? page.galleryImages[0];
  return image ? { src: optimizedPublicMediaPath(image.src), alt: image.alt } : undefined;
}

/** "Starts at" comes only from the published package version carried by `offering`. */
export function formatStartsAt(offering: NonNullable<ChatSource['offering']>) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: offering.currency,
    maximumFractionDigits: 0,
  }).format(offering.price);
}

function packageDescription(source: ChatSource) {
  const line = source.text
    .split('\n')
    .map((part) => part.trim())
    .find(
      (part) =>
        part &&
        !/^(?:published package prices?|guests included|inclusions)\b/i.test(part) &&
        !part.endsWith(':'),
    );
  if (line) return firstSentence(line);
  return source.offering ? `Includes ${source.offering.guests} guests.` : '';
}

function cardFor(source: ChatSource, labels: CardLabels): ZeniDetailCard | null {
  if (source.id.startsWith('facility:')) {
    const space = publicFacilities.find((item) => `facility:${item.id}` === source.id);
    if (!space) return null;
    return {
      type: 'detail',
      id: source.id,
      kind: 'facility',
      title: space.name,
      description: firstSentence(space.description),
      href: '/facilities',
      linkLabel: labels.viewDetails,
      image: { src: optimizedPublicMediaPath(space.imageSrc), alt: space.imageAlt },
    };
  }
  if (source.kind === 'package' && source.offering) {
    const page = eventPageFor(source.href);
    return {
      type: 'detail',
      id: source.id,
      kind: 'package',
      title: `${source.offering.category} · ${source.offering.packageName}`,
      description: packageDescription(source),
      href: source.href,
      linkLabel: labels.viewPackages,
      ...(page ? { image: eventImage(page) } : {}),
      startsAt: `${labels.startsAt} ${formatStartsAt(source.offering)}`,
    };
  }
  const page =
    source.id.startsWith('event-category:') || source.kind === 'package'
      ? eventPageFor(source.href)
      : undefined;
  if (!page) return null;
  return {
    type: 'detail',
    id: `event:${page.eventCategorySlug}`,
    kind: 'event',
    title: page.heroEyebrow,
    description: firstSentence(page.heroSubtitle),
    href: source.href,
    linkLabel: labels.viewPackages,
    image: eventImage(page),
  };
}

/** Up to two photo cards for facilities, published packages or event pages among the sources. */
export function detailCardsFor(sources: ChatSource[], labels: CardLabels, limit = 2) {
  const cards: ZeniDetailCard[] = [];
  for (const source of sources) {
    const card = cardFor(source, labels);
    const duplicate = cards.some(
      (item) => item.id === card?.id || (item.href === card?.href && item.kind === card?.kind),
    );
    if (card && !duplicate) cards.push(card);
    if (cards.length >= limit) break;
  }
  return cards;
}

const EVENT_HREFS: Record<string, string> = {
  wedding: '/events/weddings',
  birthday: '/events/birthdays',
  debut: '/events/debuts',
  christening: '/events/christening',
  'gender reveal': '/events/gender-reveal',
  christmas: '/events/christmas-party',
  'christmas party': '/events/christmas-party',
};

/** The event page card for an event type the guest named, for example "wedding". */
export function eventCardFor(eventType: string, labels: CardLabels) {
  const href = EVENT_HREFS[eventType.toLowerCase()];
  const page = href ? eventPageFor(href) : undefined;
  if (!href || !page) return null;
  return cardFor(
    {
      id: `event-category:${page.eventCategorySlug}`,
      kind: 'venue',
      title: page.heroEyebrow,
      text: page.heroSubtitle,
      href,
      keywords: [],
    },
    labels,
  );
}
