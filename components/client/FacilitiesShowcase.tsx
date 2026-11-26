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

import OpenChatbotButton from '@/components/chatbot/OpenChatbotButton';
import FadeIn from '@/components/shared/FadeIn';
import { optimizedPublicMediaPath } from '@/lib/public-media';

import {
  publicFacilities,
  type PublicFacilitySpace,
  type FacilityIcon,
} from '@/config/public-facilities';
import { buttonClassName } from '@/components/shared/button-classes';
export type FacilitySpace = Omit<PublicFacilitySpace, 'features'> & {
  features: readonly { icon: LucideIcon; label: string }[];
};
const facilityIcons: Record<FacilityIcon, LucideIcon> = {
  Camera,
  MonitorPlay,
  Snowflake,
  Sparkles,
  Sunset,
  TreePine,
  UsersRound,
  Waves,
  Wine,
};
export const featuredFacilities: readonly FacilitySpace[] = publicFacilities.map((space) => ({
  ...space,
  features: space.features.map((feature) => ({ ...feature, icon: facilityIcons[feature.icon] })),
}));

export default function FacilitiesShowcase({
  spaces = featuredFacilities,
}: {
  spaces?: readonly FacilitySpace[];
}) {
  return (
    <div className="relative overflow-hidden bg-[var(--palette-pearl)] text-[var(--palette-night-subtle)]">
      <section
        id="facilities-spaces"
        className="scroll-mt-24 relative mx-auto w-full max-w-7xl px-[var(--layout-gutter)] pb-10 pt-20 md:pb-16 md:pt-28"
      >
        <FadeIn className="mx-auto max-w-4xl text-center">
          <div className="mb-5 inline-flex items-center gap-3 rounded-full border border-[var(--palette-gold-border)]/25 bg-surface px-5 py-2 shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--palette-gold-border)]" />
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-[var(--palette-gold-ink)]">
              Explore the venue
            </p>
          </div>
          <h2 className="font-sahitya text-[clamp(2.75rem,7vw,5.6rem)] leading-[0.95] tracking-[-0.035em] text-[var(--palette-night-subtle)]">
            Three distinct spaces.
            <span className="mt-2 block font-normal italic text-[var(--palette-gold-border)]">
              One remarkable setting.
            </span>
          </h2>
          <p className="mx-auto mt-7 max-w-2xl font-serif text-[clamp(1rem,2vw,1.25rem)] leading-8 text-[var(--palette-muted)]">
            Move beautifully from indoor elegance to open-air celebrations, with every venue
            designed to make your guests feel considered and every moment feel effortless.
          </p>
        </FadeIn>
      </section>

      <section className="relative mx-auto w-full max-w-7xl space-y-8 px-[var(--layout-gutter)] pb-20 md:space-y-12 md:pb-28">
        {spaces.map((space, index) => {
          const isReversed = index % 2 === 1;

          return (
            <FadeIn
              key={space.id}
              delay={index * 90}
              direction={isReversed ? 'left' : 'right'}
              className="group"
            >
              <article className="grid overflow-hidden rounded-[2rem] border border-white/80 bg-surface shadow-[0_26px_80px_-40px_color-mix(in_srgb,var(--palette-night)_42%,transparent)] transition duration-700 hover:-translate-y-0.5 hover:shadow-[0_34px_90px_-38px_color-mix(in_srgb,var(--palette-night)_50%,transparent)] motion-reduce:transform-none motion-reduce:transition-none lg:grid-cols-12">
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
                  <div className="absolute inset-0 bg-gradient-to-t from-[var(--palette-night-card)]/75 via-transparent to-black/10" />
                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-6 text-white sm:p-8">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.25em] text-[var(--palette-cream)]">
                        {space.category}
                      </p>
                      <p className="mt-2 font-sahitya text-3xl sm:text-4xl">{space.name}</p>
                    </div>
                    <span
                      className="font-sahitya text-5xl text-white/45 sm:text-6xl"
                      aria-hidden="true"
                    >
                      {space.number}
                    </span>
                  </div>

                  {space.isNew ? (
                    <div className="absolute left-5 top-5 sm:left-8 sm:top-8">
                      <span className="inline-flex items-center gap-2 rounded-full border border-[var(--palette-cream)]/70 bg-[var(--palette-night-subtle)]/88 px-4 py-2 text-xs font-bold uppercase tracking-[0.24em] text-[var(--palette-gold-soft)] shadow-[0_10px_30px_color-mix(in_srgb,var(--palette-night)_28%,transparent)]">
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
                  <p className="mb-4 text-xs font-bold uppercase tracking-[0.25em] text-[var(--palette-gold-ink)]">
                    Venue {space.number}
                  </p>
                  <h3 className="font-sahitya text-[clamp(2.4rem,4vw,4rem)] leading-none tracking-[-0.025em] text-[var(--palette-night-subtle)]">
                    {space.name}
                  </h3>
                  <div className="my-6 h-px w-16 bg-[var(--palette-gold-border)]" />
                  <p className="font-serif text-base leading-8 text-[var(--palette-muted)] sm:text-lg">
                    {space.description}
                  </p>

                  <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                    {space.features.map((feature) => (
                      <li
                        key={feature.label}
                        className="flex items-center gap-3 rounded-2xl border border-[var(--palette-gold-hover)]/20 bg-[var(--palette-paper)] px-4 py-3 text-sm font-semibold text-[var(--palette-forest)] transition-colors duration-300 hover:border-[var(--palette-gold-border)]/45 hover:bg-[var(--palette-gold-soft)] motion-reduce:transition-none"
                      >
                        <feature.icon
                          className="h-4 w-4 shrink-0 text-[var(--palette-gold-border)]"
                          strokeWidth={1.7}
                          aria-hidden="true"
                        />
                        <span>{feature.label}</span>
                      </li>
                    ))}
                  </ul>

                  <OpenChatbotButton
                    prompt={`Tell me about ${space.name}`}
                    className={buttonClassName({ variant: 'secondary' }, 'mt-9 w-fit')}
                  >
                    Ask about this space
                    <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                  </OpenChatbotButton>
                </div>
              </article>
            </FadeIn>
          );
        })}
      </section>

      <section className="relative mx-auto w-full max-w-7xl px-[var(--layout-gutter)] py-20 md:py-28">
        <FadeIn>
          <div className="relative overflow-hidden rounded-[2rem] bg-[var(--palette-night-subtle)] px-6 py-14 text-center text-white sm:px-10 md:py-20">
            <div className="relative mx-auto max-w-3xl">
              <p className="mb-5 text-xs font-bold uppercase tracking-[0.28em] text-[var(--palette-gold)]">
                Your celebration starts here
              </p>
              <h2 className="font-sahitya text-[clamp(2.5rem,6vw,5rem)] leading-[0.98]">
                See every space in person.
              </h2>
              <p className="mx-auto mt-6 max-w-2xl font-serif text-base leading-8 text-white/70 sm:text-lg">
                Walk through the venue, explore your preferred setup, and let our team help you
                choose the space that best supports your guest experience.
              </p>
              <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <OpenChatbotButton
                  prompt="What are your visiting hours and how do I arrange a site visit?"
                  className={buttonClassName(
                    { variant: 'primary', size: 'lg', inverse: true },
                    'w-full sm:w-auto',
                  )}
                >
                  Arrange a site visit
                  <ArrowUpRight aria-hidden="true" />
                </OpenChatbotButton>
              </div>
            </div>
          </div>
        </FadeIn>
      </section>
    </div>
  );
}
