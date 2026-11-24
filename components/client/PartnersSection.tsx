'use client';

import Link from 'next/link';
import { ArrowUpRight, CheckCircle2, Sparkles } from 'lucide-react';
import React, { useState } from 'react';

import { GailysLogo, LALogo, MTLogo, RGieLogo, YKLogo, YesStudioLogo } from './PartnerLogos';

import FadeIn from '@/components/shared/FadeIn';

interface PartnerItem {
  readonly id: number;
  readonly name: string;
  readonly category: string;
  readonly summary: string;
  readonly component: React.ReactNode;
}

const PARTNERS: readonly PartnerItem[] = [
  {
    id: 1,
    name: "Gaily's",
    category: 'Event Styling & Grazing',
    summary: 'Curated celebration styling, bespoke table setups, and signature event details.',
    component: <GailysLogo />,
  },
  {
    id: 2,
    name: 'YK Photo Booth',
    category: 'Interactive Photo Booth',
    summary: 'Modern studio-grade photo booth experiences and instant keepsake prints for guests.',
    component: <YKLogo />,
  },
  {
    id: 3,
    name: 'Lennard Antonio',
    category: 'Hair & Makeup Artistry',
    summary: 'Timeless bridal, debut, and editorial glam artistry tailored for full-day events.',
    component: <LALogo />,
  },
  {
    id: 4,
    name: 'R-Gie Garcia Films',
    category: 'Event Cinematography',
    summary: 'Story-driven wedding and milestone films capturing every emotion and highlight.',
    component: <RGieLogo />,
  },
  {
    id: 5,
    name: 'Marvin Tomandao Films',
    category: 'Creative Filmmaking',
    summary: 'Cinematic same-day edits and crafted visual storytelling for grand celebrations.',
    component: <MTLogo />,
  },
  {
    id: 6,
    name: "It's a Yes Studio",
    category: 'Photography & Studio',
    summary: 'Editorial event photography capturing candid moments and timeless portraits.',
    component: <YesStudioLogo />,
  },
];

export default function PartnersSection() {
  const [selectedPartnerId, setSelectedPartnerId] = useState<number | null>(null);

  return (
    <section
      aria-labelledby="trusted-partners-heading"
      className="w-full border-t border-neutral-900/10 bg-transparent px-4 pt-8 pb-16 md:px-12 md:pt-10"
    >
      <div className="mx-auto max-w-6xl">
        {/* Editorial Heading */}
        <div className="mb-10 flex w-full justify-center overflow-hidden md:mb-12">
          <div className="group relative flex w-full min-w-0 cursor-default items-center justify-center gap-3 md:gap-6">
            <div className="h-[1.5px] min-w-0 flex-1 bg-gradient-to-r from-transparent to-[var(--palette-client-section)]/75 opacity-70 transition-all duration-700 ease-out group-hover:to-[var(--palette-client-section)] group-hover:opacity-100 md:max-w-20 md:group-hover:max-w-40" />

            <h2
              id="trusted-partners-heading"
              className="shrink-0 text-center font-serif text-[1.05rem] uppercase tracking-[0.08em] text-ink transition-all duration-700 ease-out group-hover:text-[var(--palette-client-section)] group-hover:drop-shadow-[0_1px_1px_color-mix(in_srgb,var(--palette-ink)_22%,transparent)] min-[360px]:text-xl min-[360px]:tracking-[0.1em] md:text-4xl md:tracking-[0.2em] md:group-hover:tracking-[0.24em]"
            >
              OUR TRUSTED PARTNERS
            </h2>

            <div className="h-[1.5px] min-w-0 flex-1 bg-gradient-to-l from-transparent to-[var(--palette-client-section)]/75 opacity-70 transition-all duration-700 ease-out group-hover:to-[var(--palette-client-section)] group-hover:opacity-100 md:max-w-20 md:group-hover:max-w-40" />
          </div>
        </div>

        {/* Well-Constructed 3x2 Interactive Partner Cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 md:gap-6">
          {PARTNERS.map((partner, index) => {
            const isExpanded = selectedPartnerId === partner.id;

            return (
              <FadeIn key={partner.id} delay={index * 50} direction="up">
                <article
                  className={`group flex h-full flex-col overflow-hidden rounded-[1.5rem] border bg-[var(--palette-paper)]/95 p-3 transition-all duration-300 ${
                    isExpanded
                      ? 'border-[var(--palette-booklet-cover)] shadow-[0_18px_40px_-20px_color-mix(in_srgb,var(--palette-ink)_24%,transparent)] ring-2 ring-[var(--palette-booklet-cover)]/55'
                      : 'border-[var(--palette-gold)]/25 shadow-xs hover:-translate-y-1 hover:border-[var(--palette-booklet-cover)] hover:shadow-[0_16px_36px_-18px_color-mix(in_srgb,var(--palette-ink)_20%,transparent)]'
                  }`}
                >
                  {/* Interactive Card Trigger */}
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    onClick={() =>
                      setSelectedPartnerId((prev) => (prev === partner.id ? null : partner.id))
                    }
                    className="flex w-full flex-1 flex-col text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--palette-gold-ink)] focus-visible:ring-offset-2 rounded-2xl"
                  >
                    {/* Generous Uncropped Logo Frame */}
                    <div className="relative h-32 w-full overflow-hidden rounded-2xl border border-[var(--palette-gold)]/20 sm:h-36">
                      <div className="h-full w-full transition-transform duration-500 ease-out group-hover:scale-[1.03]">
                        {partner.component}
                      </div>
                    </div>

                    {/* Clean Partner Title & Category Row */}
                    <div className="flex w-full items-start justify-between gap-3 px-2 pt-3.5 pb-1">
                      <div className="min-w-0">
                        <h3 className="truncate font-serif text-lg font-medium text-ink transition-colors group-hover:text-[var(--palette-gold-ink)]">
                          {partner.name}
                        </h3>
                        <p className="mt-0.5 font-sans text-xs font-medium text-ink/65">
                          {partner.category}
                        </p>
                      </div>

                      <span
                        className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 font-sans text-xs font-semibold transition-colors ${
                          isExpanded
                            ? 'border-[var(--palette-booklet-cover)] bg-[var(--palette-booklet-cover)]/45 text-ink'
                            : 'border-[var(--palette-gold)]/25 bg-[var(--palette-cream)]/60 text-[var(--palette-gold-ink)]'
                        }`}
                      >
                        {isExpanded ? (
                          <>
                            <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                            <span>Details</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-3 w-3" aria-hidden="true" />
                            <span>Partner</span>
                          </>
                        )}
                      </span>
                    </div>
                  </button>

                  {/* Interactive Expandable Partner Info Drawer */}
                  {isExpanded ? (
                    <div className="mt-2.5 border-t border-[var(--palette-gold)]/20 px-2 pt-3 pb-1">
                      <p className="font-sans text-xs leading-relaxed text-ink/75">
                        {partner.summary}
                      </p>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <span className="font-sans text-xs font-semibold text-[var(--palette-gold-ink)]">
                          Accredited Zion Supplier
                        </span>
                        <Link
                          href="/booking"
                          className="inline-flex items-center gap-1 rounded-full bg-[var(--palette-booklet-cover)] px-3 py-1 font-sans text-xs font-bold uppercase tracking-[0.12em] text-ink transition-colors hover:bg-[var(--palette-client-button-hover)]"
                        >
                          <span>Book with Zion</span>
                          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </Link>
                      </div>
                    </div>
                  ) : null}
                </article>
              </FadeIn>
            );
          })}
        </div>
      </div>
    </section>
  );
}
