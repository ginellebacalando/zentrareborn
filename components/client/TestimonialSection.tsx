'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, MessageSquareQuote, Star } from 'lucide-react';
import type { PublicTestimony } from '@/lib/testimony-types';
import { ButtonLink } from '@/components/shared/Button';

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex gap-1" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-5 w-5 ${star <= value ? 'fill-[var(--palette-gold-hover)] text-accent-ink' : 'text-neutral-300'}`}
        />
      ))}
    </span>
  );
}

export default function TestimonialSection() {
  const [testimonies, setTestimonies] = useState<PublicTestimony[]>([]);
  const [isVisible, setIsVisible] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch('/api/client/settings', { cache: 'no-store' })
      .then((response) => response.json())
      .then(
        (payload: {
          settings?: {
            client?: {
              maintenanceMode?: boolean;
              publicTestimoniesVisible?: boolean;
            };
          };
        }) => {
          const clientSettings = payload.settings?.client;
          const visible =
            !clientSettings?.maintenanceMode && clientSettings?.publicTestimoniesVisible !== false;
          if (active) setIsVisible(visible);
          return visible
            ? fetch('/api/client/testimonies/featured?limit=6', { cache: 'no-store' })
            : null;
        },
      )
      .then((response) => response?.json() ?? { testimonies: [] })
      .then((payload: { testimonies?: PublicTestimony[] }) => {
        if (active) setTestimonies(payload.testimonies ?? []);
      })
      .catch(() => {
        if (active) setTestimonies([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const move = useCallback(
    (direction: 1 | -1) => {
      setActiveIndex((current) => {
        if (!testimonies.length) return 0;
        return (current + direction + testimonies.length) % testimonies.length;
      });
    },
    [testimonies.length],
  );

  useEffect(() => {
    if (isPaused || testimonies.length < 2) return;
    const interval = window.setInterval(() => move(1), 5000);
    return () => window.clearInterval(interval);
  }, [isPaused, move, testimonies.length]);

  const testimony = testimonies[activeIndex];

  if (!isVisible) {
    return null;
  }

  return (
    <section className="w-full px-4 py-12 md:px-12">
      <div
        className="relative mx-auto flex max-w-5xl flex-col items-center overflow-hidden rounded-[3rem] border border-[var(--palette-gold)]/30 bg-surface px-7 py-12 text-center shadow-[0_18px_60px_color-mix(in_srgb,var(--palette-night)_6%,transparent)] md:px-20 md:py-16"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-accent-ink">
          Celebrated at Zion
        </p>
        <h2 className="mt-3 font-script text-5xl text-ink drop-shadow-sm md:text-7xl">
          Testimonies
        </h2>

        {testimony ? (
          <>
            <button
              type="button"
              onClick={() => move(-1)}
              className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-surface text-muted shadow-sm transition hover:bg-surface hover:text-accent-ink md:left-8"
              aria-label="Previous testimony"
            >
              <ChevronLeft className="h-7 w-7" />
            </button>
            <button
              type="button"
              onClick={() => move(1)}
              className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-surface text-muted shadow-sm transition hover:bg-surface hover:text-accent-ink md:right-8"
              aria-label="Next testimony"
            >
              <ChevronRight className="h-7 w-7" />
            </button>

            <div
              key={testimony.id}
              className="mt-8 max-w-3xl animate-[fadeInUp_500ms_ease-out] px-8 md:px-12"
            >
              <Stars value={testimony.overallRating} />
              {testimony.comment.trim() && (
                <>
                  <MessageSquareQuote className="mx-auto mt-5 h-9 w-9 text-accent-ink/60" />
                  <p className="mt-4 line-clamp-4 font-serif text-lg leading-8 text-muted md:text-xl">
                    “{testimony.comment}”
                  </p>
                </>
              )}
              <p className="mt-7 font-sahitya text-xl font-bold text-ink">{testimony.clientName}</p>
              <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">
                {testimony.eventType}
              </p>
              <p className="mt-1.5 text-xs font-semibold text-neutral-400">
                {new Intl.DateTimeFormat('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                }).format(new Date(testimony.eventDate))}
              </p>
            </div>
          </>
        ) : (
          <div className="mt-8 max-w-xl">
            <MessageSquareQuote className="mx-auto h-10 w-10 text-accent-ink/70" />
            <p className="mt-4 font-serif text-lg leading-7 text-muted">
              Your story belongs here. Share your unforgettable Zion experience.
            </p>
          </div>
        )}

        <ButtonLink href="/testimonies" variant="secondary" size="lg" className="mt-8">
          Read all testimonies
        </ButtonLink>
      </div>
    </section>
  );
}
