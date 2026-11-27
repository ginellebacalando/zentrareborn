'use client';

import React, { useMemo, useState } from 'react';
import { ArrowRight, ChevronDown, List, MessageCircle, Search } from 'lucide-react';
import OpenChatbotButton from '@/components/chatbot/OpenChatbotButton';
import type { PublicFaq } from '@/lib/chatbot/types';
import { buttonClassName } from '@/components/shared/button-classes';
import { ButtonLink } from '@/components/shared/Button';

type FaqGroupDefinition = {
  id: string;
  title: string;
  shortLabel: string;
  prefixes: readonly string[];
};

const FAQ_GROUP_DEFINITIONS: readonly FaqGroupDefinition[] = [
  {
    id: 'faq-group-payments',
    title: 'Payments & Booking',
    shortLabel: 'Payments & Booking',
    prefixes: ['faq-payments-'],
  },
  {
    id: 'faq-group-planning',
    title: 'Planning & Coordination',
    shortLabel: 'Planning & Coordination',
    prefixes: ['faq-planning-'],
  },
  {
    id: 'faq-group-food',
    title: 'Food & Catering',
    shortLabel: 'Food & Catering',
    prefixes: ['faq-food-'],
  },
  {
    id: 'faq-group-venue',
    title: 'Venue & Setup',
    shortLabel: 'Venue & Setup',
    prefixes: ['faq-venue-'],
  },
  {
    id: 'faq-group-suppliers',
    title: 'Suppliers & Add-Ons',
    shortLabel: 'Suppliers & Add-Ons',
    prefixes: ['faq-suppliers-'],
  },
  {
    id: 'faq-group-changes',
    title: 'Changes & Concerns',
    shortLabel: 'Changes & Concerns',
    prefixes: ['faq-changes-'],
  },
];

type FaqGroup = {
  id: string;
  title: string;
  shortLabel: string;
  items: PublicFaq[];
};

function resolveGroupForFaq(faq: PublicFaq): { id: string; title: string; shortLabel: string } {
  for (const group of FAQ_GROUP_DEFINITIONS) {
    if (group.prefixes.some((prefix) => faq.id.startsWith(prefix))) {
      return group;
    }
  }
  return {
    id: 'faq-group-general',
    title: 'General Questions',
    shortLabel: 'General Questions',
  };
}

export default function FAQClient({ faqs }: { faqs: PublicFaq[] }) {
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [activeGroupId, setActiveGroupId] = useState<string>(FAQ_GROUP_DEFINITIONS[0].id);
  const [isQuickGuideOpen, setIsQuickGuideOpen] = useState(true);

  const groupedFaqs = useMemo<FaqGroup[]>(() => {
    const query = search.trim().toLowerCase();
    const groups = new Map<string, FaqGroup>();

    for (const faq of faqs) {
      const groupMeta = resolveGroupForFaq(faq);
      const matches =
        !query ||
        faq.question.toLowerCase().includes(query) ||
        faq.answer.toLowerCase().includes(query) ||
        groupMeta.title.toLowerCase().includes(query) ||
        (faq.tags?.some((tag) => tag.toLowerCase().includes(query)) ?? false);

      if (!matches) continue;

      const existing = groups.get(groupMeta.id);
      if (existing) {
        existing.items.push(faq);
      } else {
        groups.set(groupMeta.id, {
          id: groupMeta.id,
          title: groupMeta.title,
          shortLabel: groupMeta.shortLabel,
          items: [faq],
        });
      }
    }

    return Array.from(groups.values());
  }, [faqs, search]);

  return (
    <div className="relative z-10 w-full bg-transparent pb-36">
      <div className="mx-auto grid w-full max-w-[96rem] grid-cols-1 gap-10 px-6 pt-24 sm:px-10 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start lg:gap-12 lg:px-14 xl:grid-cols-[270px_minmax(0,1fr)_320px] xl:gap-14 xl:px-16">
        {/* Left Table of Contents / Quick Guide */}
        <aside
          aria-label="FAQ table of contents"
          className="lg:sticky lg:top-28"
          style={{ animation: 'fadeInUp 0.8s ease-out 0.15s both' }}
        >
          <nav className="rounded-[2rem] border border-zion-accent/20 bg-surface p-7 shadow-[0_8px_30px_color-mix(in_srgb,var(--palette-night)_4%,transparent)]">
            <button
              type="button"
              aria-expanded={isQuickGuideOpen}
              aria-controls="faq-quick-guide-list"
              onClick={() => setIsQuickGuideOpen((open) => !open)}
              className={`flex w-full items-center justify-between gap-3 text-left transition-colors duration-300 hover:text-accent-ink ${
                isQuickGuideOpen ? 'mb-5 border-b border-zion-accent/20 pb-4' : ''
              }`}
            >
              <span className="flex items-center gap-2.5">
                <List className="h-4 w-4 text-accent-ink" aria-hidden="true" />
                <span className="font-sans text-xs font-bold uppercase tracking-[0.2em] text-ink">
                  Quick Guide
                </span>
              </span>
              <ChevronDown
                aria-hidden="true"
                className={`h-4 w-4 shrink-0 text-accent-ink transition-transform duration-300 ${
                  isQuickGuideOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            <div
              id="faq-quick-guide-list"
              hidden={!isQuickGuideOpen}
              className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
                isQuickGuideOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
              }`}
            >
              <div className="overflow-hidden">
                {groupedFaqs.length === 0 ? (
                  <p className="font-serif text-sm text-muted">No matching topics.</p>
                ) : (
                  <ol className="flex flex-col gap-2.5">
                    {groupedFaqs.map((group, idx) => {
                      const isActive = activeGroupId === group.id;
                      return (
                        <li key={group.id}>
                          <a
                            href={`#${group.id}`}
                            onClick={() => setActiveGroupId(group.id)}
                            className={`group flex items-center justify-between gap-3 rounded-xl px-3.5 py-3 text-sm transition-all duration-300 ${
                              isActive
                                ? 'bg-[var(--palette-client-button)]/20 font-semibold text-ink'
                                : 'text-muted hover:bg-surface hover:text-ink'
                            }`}
                          >
                            <span className="flex items-center gap-2.5 font-serif leading-snug">
                              <span className="shrink-0 font-sans text-xs font-semibold tabular-nums text-accent-ink/80">
                                {String(idx + 1).padStart(2, '0')}
                              </span>
                              <span>{group.shortLabel}</span>
                            </span>
                            <span className="shrink-0 rounded-full bg-zion-accent/15 px-2.5 py-0.5 font-sans text-xs font-semibold text-accent-ink">
                              {group.items.length}
                            </span>
                          </a>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
            </div>
          </nav>
        </aside>

        {/* Main FAQ Section */}
        <section className="flex min-w-0 flex-col items-center">
          <div className="mb-14 text-center" style={{ animation: 'fadeInUp 0.8s ease-out both' }}>
            <span className="mb-6 inline-block text-xs font-bold uppercase tracking-[0.2em] text-accent-ink">
              Got Questions?
            </span>
            <h2 className="mt-2 font-serif text-4xl text-ink md:text-5xl">
              Frequently Asked Questions
            </h2>
          </div>

          {/* Search Bar */}
          <div
            className="mb-14 flex w-full flex-col gap-3 rounded-full border border-zion-accent/30 bg-surface p-2.5 shadow-[0_8px_30px_color-mix(in_srgb,var(--palette-night)_4%,transparent)] transition-all focus-within:border-zion-accent/60 md:flex-row"
            style={{ animation: 'fadeInUp 0.8s ease-out 0.2s both' }}
          >
            <label className="relative flex-1">
              <Search className="pointer-events-none absolute left-6 top-3.5 h-5 w-5 text-ink/50" />
              <input
                type="text"
                placeholder="Search for an answer or topic..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full rounded-full border-none bg-transparent py-3.5 pl-14 pr-6 font-serif text-lg text-ink outline-none placeholder:text-ink/50"
              />
            </label>
          </div>

          {/* Grouped FAQ List */}
          <div className="flex w-full flex-col gap-16">
            {groupedFaqs.length === 0 ? (
              <div
                className="rounded-[2rem] border border-zion-accent/20 bg-surface px-10 py-16 text-center shadow-[0_8px_30px_color-mix(in_srgb,var(--palette-night)_4%,transparent)]"
                style={{ animation: 'fadeIn 0.5s ease-out both' }}
              >
                <p className="mb-2 font-serif text-2xl text-ink">No answers found.</p>
                <p className="font-serif text-lg text-muted">
                  We couldn&apos;t find anything matching &ldquo;{search}&rdquo;.
                </p>
                <div className="mt-8 flex flex-wrap justify-center gap-4">
                  <ButtonLink
                    href="/contact"
                    variant="primary"
                    icon={<MessageCircle aria-hidden="true" />}
                  >
                    Contact us
                  </ButtonLink>
                </div>
              </div>
            ) : (
              groupedFaqs.map((group, groupIndex) => (
                <section
                  key={group.id}
                  id={group.id}
                  aria-labelledby={`${group.id}-heading`}
                  className="scroll-mt-28 flex w-full flex-col gap-6"
                >
                  <div className="mb-1 flex items-center gap-3.5 px-2">
                    <span className="font-sans text-xs font-bold uppercase tracking-[0.2em] text-accent-ink">
                      {String(groupIndex + 1).padStart(2, '0')}
                    </span>
                    <span aria-hidden="true" className="h-px w-10 bg-zion-accent/50" />
                    <h3
                      id={`${group.id}-heading`}
                      className="font-serif text-2xl font-semibold tracking-wide text-ink md:text-3xl"
                    >
                      {group.title}
                    </h3>
                  </div>

                  <div className="flex w-full flex-col gap-5">
                    {group.items.map((faq) => {
                      const isOpen = openId === faq.id;
                      return (
                        <article
                          id={faq.id}
                          key={faq.id}
                          className={`scroll-mt-32 overflow-hidden rounded-[2rem] border transition-all duration-500 ${
                            isOpen
                              ? 'border-zion-accent/40 bg-surface'
                              : 'border-zion-accent/20 bg-surface shadow-[0_8px_30px_color-mix(in_srgb,var(--palette-night)_4%,transparent)] hover:-translate-y-0.5 hover:bg-surface'
                          }`}
                        >
                          <button
                            type="button"
                            aria-expanded={isOpen}
                            aria-controls={`answer-${faq.id}`}
                            onClick={() => {
                              setOpenId(isOpen ? null : faq.id);
                              setActiveGroupId(group.id);
                            }}
                            className="flex w-full items-center justify-between gap-8 px-8 py-7 text-left sm:px-10 sm:py-8"
                          >
                            <span
                              className={`block font-serif text-xl leading-snug transition-colors duration-300 md:text-2xl ${isOpen ? 'text-accent-ink' : 'text-ink'}`}
                            >
                              {faq.question}
                            </span>
                            <span
                              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-500 sm:h-12 sm:w-12 ${
                                isOpen
                                  ? 'rotate-180 border-zion-accent bg-zion-accent/10 text-accent-ink shadow-inner'
                                  : 'border-[var(--palette-forest)]/20 bg-transparent text-ink/60 hover:border-[var(--palette-forest)]/40 hover:text-ink'
                              }`}
                            >
                              <ChevronDown className="h-6 w-6" />
                            </span>
                          </button>

                          {/* Closed answers are inert rather than hidden, so the height can glide
                              open and closed; inert keeps them from the keyboard and screen readers. */}
                          <div
                            id={`answer-${faq.id}`}
                            inert={!isOpen}
                            className={`grid transition-[grid-template-rows,opacity] duration-500 ease-in-out ${
                              isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                            }`}
                          >
                            <div className="overflow-hidden">
                              <div className="px-8 pb-8 pt-2 sm:px-10 sm:pb-10">
                                <div className="mb-6 h-[2px] w-14 rounded-full bg-zion-accent/40"></div>
                                <p className="whitespace-pre-wrap font-serif text-lg leading-[1.85] text-muted">
                                  {faq.answer}
                                </p>
                              </div>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))
            )}
          </div>
        </section>

        {/* Right Sidebar */}
        <aside
          className="grid grid-cols-1 gap-8 pt-4 md:grid-cols-2 lg:col-span-2 xl:sticky xl:top-28 xl:col-span-1 xl:grid-cols-1 xl:pt-0"
          style={{ animation: 'fadeInUp 0.8s ease-out 0.5s both' }}
        >
          {/* Quick Contact Card */}
          <section className="group relative overflow-hidden rounded-[2rem] border border-zion-accent/20 bg-surface p-9 shadow-[0_8px_30px_color-mix(in_srgb,var(--palette-night)_4%,transparent)] transition-all duration-500 hover:-translate-y-0.5">
            <h3 className="relative z-10 mb-4 font-serif text-2xl font-bold text-ink transition-colors group-hover:text-accent-ink">
              Need Help?
            </h3>
            <p className="relative z-10 mb-8 font-serif leading-relaxed text-muted">
              Planning &amp; coordination → Head Coordinator / Group Chat. Payments, pricing &amp;
              SOA → Sir Tim Soriano / Zion FB Page.
            </p>

            <div className="relative z-10 flex flex-col gap-4">
              <ButtonLink
                href="/contact"
                variant="primary"
                block
                icon={<MessageCircle aria-hidden="true" />}
              >
                Contact us
              </ButtonLink>
            </div>
          </section>

          {/* Info Card */}
          <section className="group relative overflow-hidden rounded-[2rem] border border-zion-accent/20 bg-surface p-9 shadow-[0_8px_30px_color-mix(in_srgb,var(--palette-night)_4%,transparent)] transition-all duration-500 hover:-translate-y-0.5">
            <h3 className="relative z-10 mb-4 font-serif text-2xl font-bold text-ink transition-colors group-hover:text-accent-ink">
              Venue Viewings
            </h3>
            <p className="relative z-10 mb-8 font-serif leading-relaxed text-muted">
              We highly encourage ocular visits so you can experience the elegance of Zion Events
              Place in person.
            </p>
            <OpenChatbotButton
              prompt="What are your visiting hours and how do I arrange a site visit?"
              className={buttonClassName({ variant: 'secondary' }, 'relative z-10')}
            >
              Arrange a visit
              <ArrowRight aria-hidden="true" />
            </OpenChatbotButton>
          </section>
        </aside>
      </div>
    </div>
  );
}
