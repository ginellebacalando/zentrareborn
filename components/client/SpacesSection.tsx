import React from 'react';

import FadeIn from '@/components/shared/FadeIn';
import { AutoplayVenueVideo } from './AutoplayVenueVideo';

const spaces = [
  {
    id: 1,
    prefix: 'The',
    title: 'Selah Hall',
    video: '/videos/events/wedding-reception.mp4',
    poster: '/images/events/weddings/wedding-alt.webp',
  },
  {
    id: 2,
    prefix: 'The',
    title: 'Pavilion Garden',
    video: '/videos/events/indoor-hall.mp4',
    poster: '/images/events/weddings/gorgeous-wedding-decor.webp',
  },
  {
    id: 3,
    prefix: 'The',
    title: 'Pool',
    video: '/videos/events/gender-reveal.mp4',
    poster:
      '/images/events/weddings/spring-garden-wedding-of-ej-jaira-khim-cruz-wedding-and-event-designer-florist-stylist.webp',
  },
];

export default function SpacesSection() {
  return (
    <section className="bg-transparent w-full px-4 pt-12 pb-10 md:pt-16 md:pb-12 md:px-12">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex justify-center w-full overflow-hidden">
          <div
            className="group relative flex w-full min-w-0 items-center justify-center gap-3 md:gap-6 cursor-default"
            data-motion="decorative"
          >
            {/* Left elegant fading line */}
            <div className="h-[1.5px] min-w-0 flex-1 bg-gradient-to-r from-transparent to-[var(--palette-client-section)]/75 opacity-70 transition-all duration-700 ease-out group-hover:to-[var(--palette-client-section)] group-hover:opacity-100 md:max-w-20 md:group-hover:max-w-40" />

            <h2 className="shrink-0 text-center font-serif text-[1.05rem] uppercase tracking-[0.08em] text-ink min-[360px]:text-xl min-[360px]:tracking-[0.1em] md:text-4xl md:tracking-[0.2em]">
              OUR SPACES
            </h2>

            {/* Right elegant fading line */}
            <div className="h-[1.5px] min-w-0 flex-1 bg-gradient-to-l from-transparent to-[var(--palette-client-section)]/75 opacity-70 transition-all duration-700 ease-out group-hover:to-[var(--palette-client-section)] group-hover:opacity-100 md:max-w-20 md:group-hover:max-w-40" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
          {spaces.map((space, index) => (
            <FadeIn key={space.id} delay={index * 90} direction="up">
              <div
                className={`relative aspect-[4/5] md:aspect-[3/4] overflow-hidden group cursor-pointer transition-all duration-500 hover:-translate-y-0.5 hover:shadow-[0_24px_50px_-20px_color-mix(in_srgb,var(--palette-night)_35%,transparent)] ${
                  space.id === 1
                    ? 'rounded-b-2xl md:rounded-bl-none md:rounded-r-2xl'
                    : space.id === 2
                      ? 'rounded-2xl'
                      : space.id === 3
                        ? 'rounded-t-2xl md:rounded-tr-none md:rounded-l-2xl'
                        : ''
                }`}
              >
                <AutoplayVenueVideo src={space.video} poster={space.poster} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/20 to-black/10 transition-colors duration-500 group-hover:from-black/65 group-hover:via-black/25" />

                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-white transition-transform duration-500 ease-out group-hover:-translate-y-0.5">
                  <h3 className="flex flex-col items-center gap-1.5 drop-shadow-[0_2px_16px_color-mix(in_srgb,var(--palette-night)_60%,transparent)]">
                    <span className="font-sans text-xs font-medium uppercase tracking-[0.38em] text-white/85 transition-colors duration-500 group-hover:text-[var(--palette-client-section)]">
                      {space.prefix}
                    </span>
                    <span className="font-serif text-3xl font-normal italic leading-tight tracking-[0.03em] text-white sm:text-4xl md:text-[2.6rem] duration-500">
                      {space.title}
                    </span>
                  </h3>
                  <span
                    aria-hidden="true"
                    className="mt-3.5 h-px w-8 bg-[var(--palette-client-section)]/75 transition-all duration-500 ease-out group-hover:w-16 group-hover:bg-[var(--palette-client-section)]"
                  />
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
