import Image from 'next/image';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import { ArrowUpRight } from 'lucide-react';

import styles from './FeaturesSection.module.css';
import GalleryRibbon from './GalleryRibbon';

const zionImage = (fileName: string) =>
  `/zion-media/${encodeURIComponent(fileName.replace(/\.(?:jpe?g|png)$/iu, '.webp'))}`;

type EventFeature = {
  title: string;
  href: string;
  images: string[];
  flex: number;
  mobileHeight: string;
};

type FeatureCardStyle = CSSProperties;

const eventFeatures: EventFeature[] = [
  {
    title: 'Weddings',
    href: '/events/weddings',
    images: [
      zionImage('wedding.jpg'),
      zionImage('wedding_.jpg'),
      zionImage('Gorgeous Wedding Decor.jpg'),
      zionImage('✨ Elegant Lakefront Wedding Ceremony with White Floral Arch & Luxury Aisle Inspiration.jpg'),
    ],
    flex: 6,
    mobileHeight: 'h-80',
  },
  {
    title: 'Debuts',
    href: '/events/debuts',
    images: [
      zionImage('Debut party.jpg'),
      zionImage('Inside the incredible Swan Lake themed 18th birthday costing $41,000.jpg'),
      zionImage('party decor.jpg'),
      zionImage('Debut party.jpg'),
    ],
    flex: 3,
    mobileHeight: 'h-64',
  },
  {
    title: 'Birthdays',
    href: '/events/birthdays',
    images: [
      zionImage('bday.jpg'),
      zionImage('party decor.jpg'),
      zionImage('Debut party.jpg'),
      zionImage('bday.jpg'),
    ],
    flex: 5,
    mobileHeight: 'h-80',
  },
  {
    title: 'Christmas Parties',
    href: '/events/christmas-party',
    images: [
      zionImage('christmas party.jpg'),
      zionImage('christmas party (2).jpg'),
      zionImage('christmas party (3).jpg'),
      zionImage('Elegant Christmas Wedding Ideas for a Timeless Holiday Celebration.jpg'),
    ],
    flex: 4,
    mobileHeight: 'h-64',
  },
];

const galleryImages = [
  zionImage('wedding.jpg'),
  zionImage('christening (2).jpg'),
  zionImage('Debut party.jpg'),
  zionImage('christmas party.jpg'),
  zionImage('gender-reveal.jpg'),
  zionImage('bday.jpg'),
  zionImage('Gorgeous Wedding Decor.jpg'),
  zionImage('Inside the incredible Swan Lake themed 18th birthday costing $41,000.jpg'),
  zionImage('christening (3).jpg'),
  zionImage('christmas party (2).jpg'),
  zionImage('wedding_.jpg'),
  zionImage('✨ Elegant Lakefront Wedding Ceremony with White Floral Arch & Luxury Aisle Inspiration.jpg'),
];

function EventFeatureCard({ feature, index }: { feature: EventFeature; index: number }) {
  const featureStyle: FeatureCardStyle = {
    flex: feature.flex,
  };
  const coverImage = feature.images[0];

  return (
    <Link
      href={feature.href}
      aria-label={`Explore ${feature.title}`}
      className={`${styles.eventCard} group relative ${feature.mobileHeight} md:h-auto`}
      style={featureStyle}
    >
      <Image
        src={coverImage}
        alt=""
        fill
        priority={index < 2}
        sizes="(max-width: 768px) 100vw, 50vw"
        className={styles.cardImage}
      />

      <span className={styles.luxuryVeil} aria-hidden="true" />
      <span className={styles.cardEdge} aria-hidden="true" />
      <span className={styles.cardAction} aria-hidden="true">
        <ArrowUpRight className="h-4 w-4 md:h-5 md:w-5" strokeWidth={1.8} />
      </span>
      <h3 className="absolute bottom-4 left-4 z-10 max-w-[calc(100%-4.5rem)] font-script text-3xl leading-none text-[#FFFDF8] drop-shadow-2xl sm:text-4xl md:bottom-5 md:left-6 md:text-5xl">
        {feature.title}
      </h3>
    </Link>
  );
}

export default function FeaturesSection() {
  const leftColumn = eventFeatures.slice(0, 2);
  const rightColumn = eventFeatures.slice(2);

  return (
    <section aria-labelledby="event-features-title" className="w-full bg-transparent px-4 pt-2 pb-6 md:pt-4 md:pb-8 md:px-12">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col items-center w-full overflow-hidden">
          <div className="group relative flex w-full min-w-0 items-center justify-center gap-3 md:gap-6 cursor-default" data-motion="decorative">
            {/* Left elegant fading line */}
            <div className="h-[1.5px] min-w-0 flex-1 bg-gradient-to-r from-transparent to-[#D4AF37]/80 opacity-70 transition-all duration-700 ease-out group-hover:to-[#D4AF37] group-hover:opacity-100 md:max-w-20 md:group-hover:max-w-40" />

            <h2 id="event-features-title" className="shrink-0 text-center font-serif text-[1.05rem] uppercase tracking-[0.08em] text-neutral-900 transition-colors duration-700 ease-out group-hover:text-[#D4AF37] min-[360px]:text-xl min-[360px]:tracking-[0.1em] md:text-4xl md:tracking-[0.2em] md:group-hover:tracking-[0.24em]">
              OUR EVENT FEATURED
            </h2>

            {/* Right elegant fading line */}
            <div className="h-[1.5px] min-w-0 flex-1 bg-gradient-to-l from-transparent to-[#D4AF37]/80 opacity-70 transition-all duration-700 ease-out group-hover:to-[#D4AF37] group-hover:opacity-100 md:max-w-20 md:group-hover:max-w-40" />
          </div>
          <p className="mt-2 font-serif text-base text-neutral-900/80 md:text-lg transition-all duration-500 hover:text-neutral-900">
            Celebrate your dream event with us.
          </p>
        </div>

        <div className="mb-12 md:mb-16 flex flex-col gap-3 md:h-[520px] md:flex-row lg:h-[670px]">
          <div className="flex flex-1 flex-col gap-3">
            {leftColumn.map((feature, index) => (
              <EventFeatureCard key={feature.title} feature={feature} index={index} />
            ))}
          </div>

          <div className="flex flex-1 flex-col gap-3">
            {rightColumn.map((feature, index) => (
              <EventFeatureCard key={feature.title} feature={feature} index={index + leftColumn.length} />
            ))}
          </div>
        </div>

        <div className="mb-6 flex flex-col items-center w-full overflow-hidden">
          <div className="group relative flex w-full min-w-0 items-center justify-center gap-3 md:gap-6 cursor-default" data-motion="decorative">
            {/* Left elegant fading line */}
            <div className="h-[1.5px] min-w-0 flex-1 bg-gradient-to-r from-transparent to-[#D4AF37]/80 opacity-70 transition-all duration-700 ease-out group-hover:to-[#D4AF37] group-hover:opacity-100 md:max-w-20 md:group-hover:max-w-40" />

            <h2 className="shrink-0 text-center font-serif text-[1.05rem] uppercase tracking-[0.08em] text-neutral-900 transition-colors duration-700 ease-out group-hover:text-[#D4AF37] min-[360px]:text-xl min-[360px]:tracking-[0.1em] md:text-4xl md:tracking-[0.2em] md:group-hover:tracking-[0.24em]">
              GALLERY
            </h2>

            {/* Right elegant fading line */}
            <div className="h-[1.5px] min-w-0 flex-1 bg-gradient-to-l from-transparent to-[#D4AF37]/80 opacity-70 transition-all duration-700 ease-out group-hover:to-[#D4AF37] group-hover:opacity-100 md:max-w-20 md:group-hover:max-w-40" />
          </div>
        </div>

        <GalleryRibbon images={galleryImages} />
      </div>
    </section>
  );
}
