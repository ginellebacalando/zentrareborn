import React from 'react';
import FadeIn from '@/components/shared/FadeIn';
import { GailysLogo, YKLogo, LALogo, RGieLogo, MTLogo, YesStudioLogo } from './PartnerLogos';

export default function PartnersSection() {
  const partners = [
    { id: 1, component: <GailysLogo />, alt: 'Gailys' },
    { id: 2, component: <YKLogo />, alt: 'YK Photo Booth' },
    { id: 3, component: <LALogo />, alt: 'Lennard Antonio Makeup Artist' },
    { id: 4, component: <RGieLogo />, alt: 'R-Gie Garcia Films' },
    { id: 5, component: <MTLogo />, alt: 'Marvin Tomandao Films' },
    { id: 6, component: <YesStudioLogo />, alt: 'Its a Yes Studio' },
  ];

  return (
    <section className="bg-transparent w-full px-4 pt-6 pb-16 md:pt-8 md:px-12 border-t border-neutral-900/10">
      <div className="max-w-7xl mx-auto">
        <div className="mb-10 flex w-full justify-center overflow-hidden md:mb-12">
          <div className="group relative flex w-full min-w-0 items-center justify-center gap-3 md:gap-6 cursor-default">
            {/* Left elegant fading line */}
            <div className="h-[1.5px] min-w-0 flex-1 bg-gradient-to-r from-transparent to-[var(--palette-client-section)]/75 opacity-70 transition-all duration-700 ease-out group-hover:to-[var(--palette-client-section)] group-hover:opacity-100 md:max-w-20 md:group-hover:max-w-40" />

            <h2 className="shrink-0 text-center font-serif text-[1.05rem] uppercase tracking-[0.08em] text-ink transition-all duration-700 ease-out group-hover:text-[var(--palette-client-section)] group-hover:drop-shadow-[0_1px_1px_color-mix(in_srgb,var(--palette-ink)_22%,transparent)] min-[360px]:text-xl min-[360px]:tracking-[0.1em] md:text-4xl md:tracking-[0.2em] md:group-hover:tracking-[0.24em]">
              OUR TRUSTED PARTNERS
            </h2>

            {/* Right elegant fading line */}
            <div className="h-[1.5px] min-w-0 flex-1 bg-gradient-to-l from-transparent to-[var(--palette-client-section)]/75 opacity-70 transition-all duration-700 ease-out group-hover:to-[var(--palette-client-section)] group-hover:opacity-100 md:max-w-20 md:group-hover:max-w-40" />
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-5 md:gap-8 items-center px-4 md:px-0 max-w-[65rem] mx-auto">
          {partners.map((partner, index) => (
            <FadeIn key={partner.id} delay={index * 50} direction="up">
              <div
                className="relative w-[150px] h-[64px] md:w-[230px] md:h-[86px] rounded-full overflow-hidden flex items-center justify-center hover:-translate-y-1 transition-all duration-300 group shadow-[0_2px_12px_color-mix(in_srgb,var(--palette-night)_6%,transparent)] hover:shadow-[0_8px_24px_color-mix(in_srgb,var(--palette-gold)_18%,transparent)] border border-black/[0.08] bg-surface cursor-default"
                aria-label={partner.alt}
              >
                <div className="relative w-full h-full group-hover:scale-[1.05] transition-transform duration-500 ease-out">
                  {partner.component}
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
