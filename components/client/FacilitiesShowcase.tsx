import type { LucideIcon } from 'lucide-react';
import {
  ArrowUpRight,
  Camera,
  MonitorPlay,
  Snowflake,
  Sparkles,
  Sunset,
  TreePine,
  UsersRound,
  Waves,
  Wine,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import FadeIn from '@/components/shared/FadeIn';
import { optimizedPublicMediaPath } from '@/lib/public-media';

type FacilityFeature = {
  icon: LucideIcon;
  label: string;
};

export type FacilitySpace = {
  id: 'selah-hall' | 'pavilion-garden' | 'pool';
  sourceSlugs: readonly string[];
  number: string;
  name: string;
  category: string;
  description: string;
  imageSrc: string;
  imageAlt: string;
  isNew?: boolean;
  features: readonly FacilityFeature[];
};

export const featuredFacilities: readonly FacilitySpace[] = [
  {
    id: 'selah-hall',
    sourceSlugs: ['selah-hall', 'the-selah-hall', 'the-glass-hall'],
    number: '01',
    name: 'Selah Hall',
    category: 'Signature indoor venue',
    description:
      'An elegant indoor venue with panoramic views, air-conditioned comfort, a built-in LED wall, and space for up to 100 guests—beautifully designed for celebrations in any weather.',
    imageSrc: '/zion-gallery/684222572_17948428422152473_4013856636383990076_n.jpg',
    imageAlt: 'Elegant interior of Selah Hall prepared for a formal celebration',
    isNew: true,
    features: [
      { icon: Snowflake, label: 'Air-conditioned comfort' },
      { icon: MonitorPlay, label: 'Built-in LED wall' },
      { icon: UsersRound, label: 'Up to 100 guests' },
      { icon: Sunset, label: 'Panoramic views' },
    ],
  },
  {
    id: 'pavilion-garden',
    sourceSlugs: ['pavilion-garden', 'the-pavilion-garden'],
    number: '02',
    name: 'Pavilion Garden',
    category: 'Scenic outdoor venue',
    description:
      'The Pavilion Garden offers a versatile outdoor setting perfect for wedding ceremonies, cocktail hour, and intimate celebrations—all with our signature overlooking skyline as your backdrop.',
    imageSrc: '/zion-gallery/zionview.jpg',
    imageAlt: 'Pavilion Garden ceremony setup overlooking the skyline at sunset',
    features: [
      { icon: TreePine, label: 'Open-air garden' },
      { icon: Wine, label: 'Cocktail-ready setting' },
      { icon: Sunset, label: 'Signature skyline view' },
      { icon: Sparkles, label: 'Flexible styling' },
    ],
  },
  {
    id: 'pool',
    sourceSlugs: ['pool', 'the-pool', 'pool-and-grounds', 'the-pool-and-grounds'],
    number: '03',
    name: 'The Pool & Scenic Grounds',
    category: 'Relaxed outdoor setting',
    description:
      'An inviting waterside setting with scenic skyline views, a relaxed open-air atmosphere, and picture-perfect surroundings—ideal for cocktail moments, portraits, intimate gatherings, and polished celebrations beneath the open sky.',
    imageSrc: '/zion-gallery/zion5.jpg',
    imageAlt: 'The pool and scenic outdoor grounds at Zion Events Place',
    features: [
      { icon: Waves, label: 'Waterside atmosphere' },
      { icon: Camera, label: 'Picture-perfect backdrop' },
      { icon: Sunset, label: 'Open-sky views' },
      { icon: UsersRound, label: 'Intimate gatherings' },
    ],
  },
] as const;


export default function FacilitiesShowcase({
  spaces = featuredFacilities,
}: {
  spaces?: readonly FacilitySpace[];
}) {
  return (
    <div className="relative overflow-hidden bg-[#F7F3E8] text-[#182218]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-[-12rem] top-24 h-[28rem] w-[28rem] rounded-full bg-[#D6B53B]/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-[-14rem] top-[42rem] h-[34rem] w-[34rem] rounded-full bg-[#3A4B3C]/10 blur-3xl"
      />

      <section className="relative mx-auto w-full max-w-7xl px-[var(--layout-gutter)] pb-10 pt-20 md:pb-16 md:pt-28">
        <FadeIn once className="mx-auto max-w-4xl text-center">
          <div className="mb-5 inline-flex items-center gap-3 rounded-full border border-[#B8962E]/25 bg-white/70 px-5 py-2 shadow-sm backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-[#B8962E]" />
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.28em] text-[#806B25]">
              Explore the venue
            </p>
          </div>
          <h2 className="font-sahitya text-[clamp(2.75rem,7vw,5.6rem)] leading-[0.95] tracking-[-0.035em] text-[#182218]">
            Three distinct spaces.
            <span className="mt-2 block font-normal italic text-[#A58425]">One remarkable setting.</span>
          </h2>
          <p className="mx-auto mt-7 max-w-2xl font-serif text-[clamp(1rem,2vw,1.25rem)] leading-8 text-[#596157]">
            Move beautifully from indoor elegance to open-air celebrations, with every venue designed to
            make your guests feel considered and every moment feel effortless.
          </p>
        </FadeIn>
      </section>

      <section className="relative mx-auto w-full max-w-7xl space-y-8 px-[var(--layout-gutter)] pb-20 md:space-y-12 md:pb-28">
        {spaces.map((space, index) => {
          const isReversed = index % 2 === 1;

          return (
            <FadeIn
              key={space.id}
              once
              delay={index * 90}
              direction={isReversed ? 'left' : 'right'}
              className="group"
            >
              <article className="grid overflow-hidden rounded-[2rem] border border-white/80 bg-white/75 shadow-[0_26px_80px_-40px_rgba(24,34,24,0.42)] backdrop-blur-xl transition duration-700 hover:-translate-y-1 hover:shadow-[0_34px_90px_-38px_rgba(24,34,24,0.5)] motion-reduce:transform-none motion-reduce:transition-none lg:grid-cols-12">
                <div
                  className={`relative min-h-[24rem] overflow-hidden sm:min-h-[31rem] lg:col-span-7 lg:min-h-[38rem] ${
                    isReversed ? 'lg:order-2' : ''
                  }`}
                >
                  <Image
                    src={optimizedPublicMediaPath(space.imageSrc)}
                    alt={space.imageAlt}
                    fill
                    sizes="(min-width: 1280px) 730px, (min-width: 1024px) 58vw, 100vw"
                    className="object-cover transition-transform duration-[1400ms] ease-out group-hover:scale-[1.055] motion-reduce:transform-none motion-reduce:transition-none"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#111810]/75 via-transparent to-black/10" />
                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-6 text-white sm:p-8">
                    <div>
                      <p className="text-[0.68rem] font-bold uppercase tracking-[0.25em] text-[#F4DEA0]">
                        {space.category}
                      </p>
                      <p className="mt-2 font-sahitya text-3xl sm:text-4xl">{space.name}</p>
                    </div>
                    <span className="font-sahitya text-5xl text-white/45 sm:text-6xl" aria-hidden="true">
                      {space.number}
                    </span>
                  </div>

                  {space.isNew ? (
                    <div className="absolute left-5 top-5 sm:left-8 sm:top-8">
                      <span className="inline-flex items-center gap-2 rounded-full border border-[#F6E9B4]/70 bg-[#182218]/88 px-4 py-2 text-[0.68rem] font-bold uppercase tracking-[0.24em] text-[#FFF4C7] shadow-[0_10px_30px_rgba(0,0,0,0.28)] backdrop-blur-md motion-safe:animate-[pulse_3s_ease-in-out_infinite]">
                        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                        New
                      </span>
                    </div>
                  ) : null}
                </div>

                <div
                  className={`flex flex-col justify-center p-7 sm:p-10 lg:col-span-5 lg:p-12 xl:p-14 ${
                    isReversed ? 'lg:order-1' : ''
                  }`}
                >
                  <p className="mb-4 text-[0.68rem] font-bold uppercase tracking-[0.25em] text-[#9A7C24]">
                    Venue {space.number}
                  </p>
                  <h3 className="font-sahitya text-[clamp(2.4rem,4vw,4rem)] leading-none tracking-[-0.025em] text-[#182218]">
                    {space.name}
                  </h3>
                  <div className="my-6 h-px w-16 bg-gradient-to-r from-[#B8962E] to-transparent" />
                  <p className="font-serif text-base leading-8 text-[#596157] sm:text-lg">
                    {space.description}
                  </p>

                  <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                    {space.features.map((feature) => (
                      <li
                        key={feature.label}
                        className="flex items-center gap-3 rounded-2xl border border-[#C9B46C]/20 bg-[#FBF9F2] px-4 py-3 text-sm font-semibold text-[#344036] transition-colors duration-300 hover:border-[#B8962E]/45 hover:bg-[#F8F0D5] motion-reduce:transition-none"
                      >
                        <feature.icon className="h-4 w-4 shrink-0 text-[#A58425]" strokeWidth={1.7} aria-hidden="true" />
                        <span>{feature.label}</span>
                      </li>
                    ))}
                  </ul>

                  <Link
                    href="/contact"
                    className="mt-9 inline-flex min-h-11 w-fit items-center gap-3 rounded-full border border-[#182218]/15 px-5 py-3 text-xs font-bold uppercase tracking-[0.18em] text-[#182218] transition-all duration-300 hover:border-[#B8962E] hover:bg-[#182218] hover:text-[#FFF4C7] motion-reduce:transition-none"
                  >
                    Ask about this space
                    <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              </article>
            </FadeIn>
          );
        })}
      </section>


      <section className="relative mx-auto w-full max-w-7xl px-[var(--layout-gutter)] py-20 md:py-28">
        <FadeIn once>
          <div className="relative overflow-hidden rounded-[2rem] bg-[#172117] px-6 py-14 text-center text-white shadow-[0_30px_80px_-35px_rgba(23,33,23,0.8)] sm:px-10 md:py-20">
            <div
              aria-hidden="true"
              className="absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#D6B53B]/25 blur-3xl"
            />
            <div className="relative mx-auto max-w-3xl">
              <p className="mb-5 text-[0.68rem] font-bold uppercase tracking-[0.28em] text-[#E7CE76]">
                Your celebration starts here
              </p>
              <h2 className="font-sahitya text-[clamp(2.5rem,6vw,5rem)] leading-[0.98]">
                See every space in person.
              </h2>
              <p className="mx-auto mt-6 max-w-2xl font-serif text-base leading-8 text-white/70 sm:text-lg">
                Walk through the venue, explore your preferred setup, and let our team help you choose the
                space that best supports your guest experience.
              </p>
              <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link
                  href="/contact"
                  className="group relative inline-flex min-h-12 w-full items-center justify-center px-8 py-3.5 bg-[#1a1f18] text-white font-sans text-xs font-bold uppercase tracking-[0.18em] overflow-hidden rounded-full transition-all shadow-[0_15px_30px_-10px_rgba(26,31,24,0.4)] hover:shadow-[0_20px_40px_-15px_rgba(214,181,59,0.5)] sm:w-auto"
                >
                  <div className="absolute inset-0 bg-[#D6B53B] transition-transform duration-500 ease-in-out translate-y-full group-hover:translate-y-0" />
                  <span className="relative z-10 flex items-center gap-3 transition-colors duration-500 group-hover:text-[#1a1f18]">
                    Arrange a site visit
                    <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                  </span>
                </Link>
              </div>
            </div>
          </div>
        </FadeIn>
      </section>
    </div>
  );
}
