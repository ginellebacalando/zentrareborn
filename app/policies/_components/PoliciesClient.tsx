'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Search } from 'lucide-react';
import FadeIn from '@/components/shared/FadeIn';
import { policiesData } from '@/config/policies';

export default function PoliciesClient() {
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const flatPolicies = useMemo(() => {
    const all = policiesData.flatMap((category) =>
      category.sections.map((section) => ({
        ...section,
        categoryName: category.category,
      })),
    );

    if (!search.trim()) return all;

    const lowerSearch = search.toLowerCase();
    return all.filter(
      (policy) =>
        policy.title.toLowerCase().includes(lowerSearch) ||
        policy.content.some((paragraph) => paragraph.toLowerCase().includes(lowerSearch)) ||
        policy.categoryName.toLowerCase().includes(lowerSearch),
    );
  }, [search]);

  return (
    <div className="w-full relative z-10 bg-transparent pb-36">
      <div className="mx-auto w-full max-w-[96rem] px-6 pt-24 sm:px-10 lg:px-14 xl:px-16">
        {/* Main Section */}
        <section className="flex flex-col items-center">
          <FadeIn direction="up" className="mb-14 text-center">
            <span className="mb-6 inline-block text-xs font-bold uppercase tracking-[0.2em] text-accent-ink">
              Important Guidelines
            </span>
            <h2 className="mt-2 font-serif text-4xl text-ink md:text-5xl">
              Event &amp; Venue Policies
            </h2>
          </FadeIn>

          {/* Search Bar */}
          <FadeIn direction="up" delay={80} className="mb-14 w-full max-w-4xl">
            <div className="flex w-full flex-col gap-3 rounded-full border border-zion-accent/30 bg-surface p-2.5 shadow-[0_8px_30px_color-mix(in_srgb,var(--palette-night)_4%,transparent)] transition-all duration-300 hover:-translate-y-0.5 hover:border-zion-accent/50 focus-within:border-zion-accent/65 md:flex-row">
              <label className="relative flex-1">
                <Search className="pointer-events-none absolute top-3.5 left-6 h-5 w-5 text-ink/50" />
                <input
                  type="text"
                  placeholder="Search policies..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="w-full rounded-full border-none bg-transparent py-3.5 pr-6 pl-14 font-serif text-lg text-ink outline-none placeholder:text-ink/50"
                />
              </label>
            </div>
          </FadeIn>

          {/* Policies List (Two-Column Layout) */}
          <div className="grid w-full grid-cols-1 items-start gap-8 lg:grid-cols-2 lg:gap-10 xl:gap-12">
            {flatPolicies.length === 0 ? (
              <FadeIn direction="up" className="lg:col-span-2">
                <div className="rounded-[2rem] border border-zion-accent/20 bg-surface px-8 py-16 text-center shadow-[0_8px_30px_color-mix(in_srgb,var(--palette-night)_4%,transparent)]">
                  <p className="mb-2 font-serif text-2xl text-ink">No policies found.</p>
                  <p className="font-serif text-lg text-muted">
                    We couldn&apos;t find anything matching &ldquo;{search}&rdquo;.
                  </p>
                  <div className="mt-8 flex flex-wrap justify-center gap-4">
                    <Link
                      href="/contact"
                      className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--palette-client-button)] bg-[var(--palette-client-button)] px-6 py-3 text-sm font-bold uppercase tracking-[0.16em] text-[var(--text-on-action)] transition-colors duration-300 hover:bg-[var(--palette-client-button-hover)]"
                    >
                      Contact Us
                    </Link>
                  </div>
                </div>
              </FadeIn>
            ) : (
              flatPolicies.map((policy, index) => {
                const isOpen = openId === policy.id;

                return (
                  <FadeIn key={policy.id} delay={(index % 2) * 90} direction="up">
                    <div
                      className={`group relative overflow-hidden rounded-[2rem] border transition-all duration-500 ease-out motion-reduce:transition-none ${
                        isOpen
                          ? 'border-zion-accent/55 bg-surface'
                          : 'border-zion-accent/20 bg-surface shadow-[0_8px_30px_color-mix(in_srgb,var(--palette-night)_3%,transparent)] hover:-translate-y-0.5 hover:border-zion-accent/45 hover:bg-surface'
                      }`}
                    >
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        onClick={() => setOpenId(isOpen ? null : policy.id)}
                        className="flex w-full items-center justify-between gap-4 p-5 text-left sm:gap-6 sm:p-7 md:p-9 lg:p-10"
                      >
                        <div>
                          <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-accent-ink transition-transform duration-300 group-hover:translate-x-0.5">
                            {policy.categoryName}
                          </p>
                          <h3
                            className={`font-serif text-xl transition-colors duration-300 md:text-2xl ${
                              isOpen
                                ? 'text-accent-ink'
                                : 'text-ink group-hover:text-[var(--palette-gold-ink)]'
                            }`}
                          >
                            {policy.title}
                          </h3>
                        </div>
                        <div
                          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border transition-all duration-500 ease-out motion-reduce:transition-none ${
                            isOpen
                              ? 'rotate-180 border-[var(--palette-client-button)] bg-[var(--palette-client-button)] text-[var(--text-on-action)] shadow-lg shadow-[var(--palette-client-button)]/30'
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
                          <div className="border-t border-zion-accent/15 p-5 pt-4 sm:p-7 sm:pt-4 md:p-9 md:pt-5 lg:p-10 lg:pt-6">
                            <div
                              className={`space-y-4 font-serif text-lg leading-relaxed text-ink/80 transition-transform duration-500 ease-out motion-reduce:transition-none ${
                                isOpen ? 'translate-y-0' : '-translate-y-2'
                              }`}
                            >
                              {policy.content.map((paragraph, pIndex) => (
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
