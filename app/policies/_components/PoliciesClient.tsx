'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Search } from 'lucide-react';
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
          <div className="mb-14 text-center" style={{ animation: 'fadeInUp 0.8s ease-out both' }}>
            <span className="bg-gradient-to-r from-zion-accent to-[var(--palette-gold)] text-white px-5 py-2 rounded-full text-xs font-bold tracking-[0.2em] uppercase shadow-md mb-6 inline-block">
              Important Guidelines
            </span>
            <h2 className="font-serif text-4xl text-ink md:text-5xl mt-2">
              Event & Venue Policies
            </h2>
          </div>

          {/* Search Bar */}
          <div
            className="mb-14 flex w-full max-w-4xl flex-col gap-3 rounded-full border border-zion-accent/30 bg-surface/70 shadow-[0_8px_30px_color-mix(in_srgb,var(--palette-night)_4%,transparent)] backdrop-blur-md p-2.5 md:flex-row transition-all focus-within:shadow-[0_20px_40px_color-mix(in_srgb,var(--palette-gold)_15%,transparent)] focus-within:border-zion-accent/60"
            style={{ animation: 'fadeInUp 0.8s ease-out 0.2s both' }}
          >
            <label className="relative flex-1">
              <Search className="pointer-events-none absolute left-6 top-3.5 h-5 w-5 text-ink/50" />
              <input
                type="text"
                placeholder="Search policies..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full rounded-full border-none bg-transparent py-3.5 pl-14 pr-6 font-serif text-lg text-ink outline-none placeholder:text-ink/50"
              />
            </label>
          </div>

          {/* Policies List (Two-Column Layout) */}
          <div className="grid w-full grid-cols-1 items-start gap-8 lg:grid-cols-2 lg:gap-10 xl:gap-12">
            {flatPolicies.length === 0 ? (
              <div
                className="rounded-[2rem] border border-zion-accent/20 bg-surface/70 px-8 py-16 text-center shadow-[0_8px_30px_color-mix(in_srgb,var(--palette-night)_4%,transparent)] backdrop-blur-md lg:col-span-2"
                style={{ animation: 'fadeIn 0.5s ease-out both' }}
              >
                <p className="font-serif text-2xl text-ink mb-2">No policies found.</p>
                <p className="font-serif text-lg text-muted">
                  We couldn&apos;t find anything matching &ldquo;{search}&rdquo;.
                </p>
                <div className="mt-8 flex flex-wrap justify-center gap-4">
                  <Link
                    href="/contact"
                    className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--palette-client-button)] bg-[var(--palette-client-button)] px-6 py-3 text-sm font-bold uppercase tracking-[0.16em] text-ink hover:bg-[var(--palette-client-button-hover)] transition-colors duration-300"
                  >
                    Contact Us
                  </Link>
                </div>
              </div>
            ) : (
              flatPolicies.map((policy, index) => {
                const isOpen = openId === policy.id;

                return (
                  <div
                    key={policy.id}
                    className={`overflow-hidden rounded-[2rem] border transition-all duration-500 ${
                      isOpen
                        ? 'border-zion-accent/50 bg-surface shadow-[0_20px_40px_color-mix(in_srgb,var(--palette-gold)_10%,transparent)]'
                        : 'border-zion-accent/20 bg-surface/60 hover:border-zion-accent/40 hover:bg-surface shadow-[0_8px_30px_color-mix(in_srgb,var(--palette-night)_2%,transparent)] hover:shadow-[0_15px_35px_color-mix(in_srgb,var(--palette-night)_5%,transparent)]'
                    }`}
                    style={{ animation: `fadeInUp 0.6s ease-out ${0.3 + index * 0.05}s both` }}
                  >
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => setOpenId(isOpen ? null : policy.id)}
                      className="flex w-full items-center justify-between gap-6 p-7 text-left md:p-9 lg:p-10"
                    >
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent-ink mb-2">
                          {policy.categoryName}
                        </p>
                        <h3
                          className={`font-serif text-xl transition-colors duration-300 md:text-2xl ${isOpen ? 'text-accent-ink' : 'text-ink'}`}
                        >
                          {policy.title}
                        </h3>
                      </div>
                      <div
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border transition-all duration-500 ${
                          isOpen
                            ? 'border-[var(--palette-client-button)] bg-[var(--palette-client-button)] text-ink shadow-lg shadow-[var(--palette-client-button)]/30 rotate-180'
                            : 'border-zion-accent/30 text-accent-ink bg-surface group-hover:border-[var(--palette-client-button)]'
                        }`}
                      >
                        <ChevronDown className="h-5 w-5" />
                      </div>
                    </button>

                    <div
                      className={`grid transition-all duration-500 ease-in-out ${
                        isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                      }`}
                    >
                      <div className="overflow-hidden">
                        <div className="border-t border-zion-accent/10 p-7 pt-4 md:p-9 md:pt-5 lg:p-10 lg:pt-6">
                          <div className="space-y-4 font-serif text-lg leading-relaxed text-ink/80">
                            {policy.content.map((paragraph, pIndex) => (
                              <p
                                key={pIndex}
                                className={
                                  paragraph.startsWith('•')
                                    ? "pl-6 relative before:content-[''] before:absolute before:left-2 before:top-2.5 before:w-1.5 before:h-1.5 before:bg-zion-accent before:rounded-full"
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
                );
              })
            )}
          </div>
        </section>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `,
        }}
      />
    </div>
  );
}
