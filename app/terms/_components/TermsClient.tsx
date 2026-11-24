'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Search } from 'lucide-react';
import FadeIn from '@/components/shared/FadeIn';
import { termsData } from '@/config/terms';

export default function TermsClient() {
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const flatTerms = useMemo(() => {
    const all = termsData.flatMap((category) =>
      category.sections.map((section) => ({
        ...section,
        categoryName: category.category,
      })),
    );

    if (!search.trim()) return all;

    const lowerSearch = search.toLowerCase();
    return all.filter(
      (term) =>
        term.title.toLowerCase().includes(lowerSearch) ||
        term.content.some((paragraph) => paragraph.toLowerCase().includes(lowerSearch)) ||
        term.categoryName.toLowerCase().includes(lowerSearch),
    );
  }, [search]);

  return (
    <div className="w-full relative z-10 bg-transparent pb-36">
      <div className="mx-auto w-full max-w-[96rem] px-6 pt-24 sm:px-10 lg:px-14 xl:px-16">
        {/* Main Section */}
        <section className="flex flex-col items-center">
          <FadeIn direction="up" className="mb-14 text-center">
            <span className="mb-6 inline-block rounded-full bg-gradient-to-r from-zion-accent to-[var(--palette-gold)] px-5 py-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--palette-white)] shadow-md">
              Important Guidelines
            </span>
            <h2 className="mt-2 font-serif text-4xl text-ink md:text-5xl">
              Terms &amp; Conditions
            </h2>
          </FadeIn>

          {/* Search Bar */}
          <FadeIn direction="up" delay={80} className="mb-14 w-full max-w-4xl">
            <div className="flex w-full flex-col gap-3 rounded-full border border-zion-accent/30 bg-surface/75 p-2.5 shadow-[0_8px_30px_color-mix(in_srgb,var(--palette-night)_4%,transparent)] backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:border-zion-accent/50 focus-within:border-zion-accent/65 focus-within:shadow-[0_20px_40px_color-mix(in_srgb,var(--palette-gold)_18%,transparent)] md:flex-row">
              <label className="relative flex-1">
                <Search className="pointer-events-none absolute top-3.5 left-6 h-5 w-5 text-ink/50" />
                <input
                  type="text"
                  placeholder="Search terms..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="w-full rounded-full border-none bg-transparent py-3.5 pr-6 pl-14 font-serif text-lg text-ink outline-none placeholder:text-ink/50"
                />
              </label>
            </div>
          </FadeIn>

          {/* Terms List (Two-Column Layout) */}
          <div className="grid w-full grid-cols-1 items-start gap-8 lg:grid-cols-2 lg:gap-10 xl:gap-12">
            {flatTerms.length === 0 ? (
              <FadeIn direction="up" className="lg:col-span-2">
                <div className="rounded-[2rem] border border-zion-accent/20 bg-surface/70 px-8 py-16 text-center shadow-[0_8px_30px_color-mix(in_srgb,var(--palette-night)_4%,transparent)] backdrop-blur-md">
                  <p className="mb-2 font-serif text-2xl text-ink">No terms found.</p>
                  <p className="font-serif text-lg text-muted">
                    We couldn&apos;t find anything matching &ldquo;{search}&rdquo;.
                  </p>
                  <div className="mt-8 flex flex-wrap justify-center gap-4">
                    <Link
                      href="/contact"
                      className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--palette-client-button)] bg-[var(--palette-client-button)] px-6 py-3 text-sm font-bold uppercase tracking-[0.16em] text-ink transition-colors duration-300 hover:bg-[var(--palette-client-button-hover)]"
                    >
                      Contact Us
                    </Link>
                  </div>
                </div>
              </FadeIn>
            ) : (
              flatTerms.map((term, index) => {
                const isOpen = openId === term.id;

                return (
                  <FadeIn key={term.id} delay={(index % 2) * 90} direction="up">
                    <div
                      className={`group relative overflow-hidden rounded-[2rem] border transition-all duration-500 ease-out motion-reduce:transition-none ${
                        isOpen
                          ? '-translate-y-1 border-zion-accent/55 bg-surface shadow-[0_24px_48px_-16px_color-mix(in_srgb,var(--palette-gold)_24%,transparent)]'
                          : 'border-zion-accent/20 bg-surface/65 shadow-[0_8px_30px_color-mix(in_srgb,var(--palette-night)_3%,transparent)] hover:-translate-y-1.5 hover:border-zion-accent/45 hover:bg-surface hover:shadow-[0_22px_42px_-18px_color-mix(in_srgb,var(--palette-gold)_22%,transparent)]'
                      }`}
                    >
                      {/* Animated Top Gold Accent Sweep */}
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none absolute inset-x-0 top-0 h-1 origin-left bg-gradient-to-r from-zion-accent via-[var(--palette-booklet-cover)] to-[var(--palette-gold)] transition-transform duration-500 ease-out motion-reduce:transition-none ${
                          isOpen ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
                        }`}
                      />

                      <button
                        type="button"
                        aria-expanded={isOpen}
                        onClick={() => setOpenId(isOpen ? null : term.id)}
                        className="flex w-full items-center justify-between gap-6 p-7 text-left md:p-9 lg:p-10"
                      >
                        <div>
                          <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-accent-ink transition-transform duration-300 group-hover:translate-x-0.5">
                            {term.categoryName}
                          </p>
                          <h3
                            className={`font-serif text-xl transition-colors duration-300 md:text-2xl ${
                              isOpen
                                ? 'text-accent-ink'
                                : 'text-ink group-hover:text-[var(--palette-gold-ink)]'
                            }`}
                          >
                            {term.title}
                          </h3>
                        </div>
                        <div
                          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border transition-all duration-500 ease-out motion-reduce:transition-none ${
                            isOpen
                              ? 'rotate-180 border-[var(--palette-client-button)] bg-[var(--palette-client-button)] text-ink shadow-lg shadow-[var(--palette-client-button)]/30'
                              : 'border-zion-accent/30 bg-surface text-accent-ink group-hover:scale-105 group-hover:border-[var(--palette-client-button)] group-hover:bg-[var(--palette-cream)]/75'
                          }`}
                        >
                          <ChevronDown className="h-5 w-5" />
                        </div>
                      </button>

                      <div
                        className={`grid transition-all duration-500 ease-in-out motion-reduce:transition-none ${
                          isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                        }`}
                      >
                        <div className="overflow-hidden">
                          <div className="border-t border-zion-accent/15 p-7 pt-4 md:p-9 md:pt-5 lg:p-10 lg:pt-6">
                            <div
                              className={`space-y-4 font-serif text-lg leading-relaxed text-ink/80 transition-transform duration-500 ease-out motion-reduce:transition-none ${
                                isOpen ? 'translate-y-0' : '-translate-y-2'
                              }`}
                            >
                              {term.content.map((paragraph, pIndex) => (
                                <p
                                  key={pIndex}
                                  className={
                                    paragraph.startsWith('•')
                                      ? "relative pl-6 before:absolute before:top-2.5 before:left-2 before:h-1.5 before:w-1.5 before:rounded-full before:bg-zion-accent before:content-['']"
                                      : ''
                                  }
                                >
                                  {paragraph.replace('•', '').trim()}
                                </p>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </FadeIn>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
