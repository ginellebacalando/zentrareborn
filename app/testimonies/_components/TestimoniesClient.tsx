'use client';

import React, { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import {
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MessageSquareQuote,
  Package,
  Send,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  CalendarHeart,
  Star,
  User,
  X,
} from 'lucide-react';
import ZionDatePicker from '@/components/client/ZionDatePicker';
import ZionSelectPopover from '@/components/client/ZionSelectPopover';
import { useReducedMotion } from '@/components/shared/useReducedMotion';
import type { PublicTestimoniesResponse, PublicTestimony } from '@/lib/testimony-types';

const FALLBACK_EVENT_TYPES = [
  'Wedding Reception',
  'Debut',
  'Birthday',
  'Christening',
  'Gender Reveal',
  'Christmas Party',
  'Anniversary',
  'Reunion',
  'Corporate Event',
  'Custom Event',
];

const TESTIMONY_PLACEHOLDERS = [
  'Share what made your celebration special...',
  'How was the food, service, and venue atmosphere?',
  'What moment stood out most for you and your guests?',
  'Tell future celebrants what you loved about Zion...',
];

const EMPTY_FORM = {
  clientName: '',
  eventType: '',
  eventDate: '',
  packageName: '',
  overallRating: 0,
  approachRating: 0,
  foodRating: 0,
  serviceRating: 0,
  venueRating: 0,
  communicationRating: 0,
  comment: '',
  consent: false,
};

function Stars({ value, size = 'h-4 w-4' }: { value: number; size?: string }) {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1"
      aria-label={`${value} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${size} shrink-0 ${star <= value ? 'fill-[var(--palette-gold-hover)] text-accent-ink' : 'text-neutral-300'}`}
          strokeWidth={1.8}
        />
      ))}
    </span>
  );
}

function StarInput({
  label,
  value,
  onChange,
  required = false,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  required?: boolean;
}) {
  const [hovered, setHovered] = useState(0);
  const display = hovered || value;
  const ratingLabel = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][display];

  return (
    <fieldset className="rounded-2xl border border-zion-accent/20 bg-surface p-4 shadow-sm transition-all duration-300 hover:border-zion-accent/45 hover:bg-surface">
      <legend className="px-1 font-sans text-xs font-bold uppercase tracking-[0.14em] text-ink">
        {label}
        {required && <span className="text-accent-ink"> *</span>}
      </legend>
      <div
        className="mt-2 flex items-center justify-between gap-2"
        onMouseLeave={() => setHovered(0)}
      >
        <div className="flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => onChange(star)}
              onMouseEnter={() => setHovered(star)}
              className="rounded-lg p-1 transition-transform duration-200 hover:scale-115 focus:outline-none focus:ring-2 focus:ring-zion-accent"
              aria-label={`${star} star${star > 1 ? 's' : ''} for ${label}`}
            >
              <Star
                className={`h-6 w-6 transition-colors duration-200 sm:h-7 sm:w-7 ${
                  star <= display
                    ? 'fill-[var(--palette-client-button)] text-accent-ink'
                    : 'text-neutral-300'
                }`}
              />
            </button>
          ))}
        </div>
        <span
          className={`rounded-full px-2.5 py-1 font-sans text-xs font-semibold transition-colors ${
            display > 0
              ? 'bg-[var(--palette-client-button)]/25 text-ink'
              : 'bg-zion-accent/10 text-muted'
          }`}
        >
          {ratingLabel || 'Select'}
        </span>
      </div>
    </fieldset>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function RatingDetail({ label, value }: { label: string; value: number | null }) {
  if (!value) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-1.5 first:pt-0 last:pb-0">
      <span className="font-sans text-xs font-bold uppercase tracking-[0.12em] text-muted">
        {label}
      </span>
      <Stars value={value} size="h-4 w-4" />
    </div>
  );
}

function TestimonyCard({ testimony }: { testimony: PublicTestimony }) {
  return (
    <article className="group overflow-hidden rounded-[2rem] border border-white/80 bg-surface shadow-[0_18px_60px_color-mix(in_srgb,var(--palette-night)_8%,transparent)] transition duration-500 hover:-translate-y-0.5">
      {testimony.photoUrl && (
        <div className="relative h-56 overflow-hidden">
          <Image
            src={testimony.photoUrl}
            alt={`${testimony.clientName}'s ${testimony.eventType} at Zion Events Place`}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover transition duration-700 group-hover:scale-105"
          />
        </div>
      )}
      <div className="p-6 md:p-7">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <div>
            <p className="font-sahitya text-2xl font-bold text-ink">{testimony.clientName}</p>
            <p className="mt-1 flex flex-wrap items-center gap-2.5 text-sm text-muted">
              <span>{testimony.eventType}</span>
              <span aria-hidden="true" className="h-3.5 w-px bg-zion-accent/40" />
              <span>{formatDate(testimony.eventDate)}</span>
            </p>
          </div>
          <div className="rounded-full border border-zion-accent/25 bg-[var(--palette-gold-soft)]/75 px-3 py-1.5">
            <Stars value={testimony.overallRating} />
          </div>
        </div>

        {testimony.packageName && (
          <p className="mt-4 inline-flex rounded-full bg-[var(--palette-forest)]/8 px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-ink">
            {testimony.packageName}
          </p>
        )}

        {testimony.comment.trim() && (
          <>
            <MessageSquareQuote className="mt-6 h-8 w-8 text-accent-ink/60" />
            <p className="mt-3 whitespace-pre-wrap font-serif text-[17px] leading-7 text-muted">
              “{testimony.comment}”
            </p>
          </>
        )}

        <div className="mt-6 flex flex-col divide-y divide-zion-accent/10 rounded-2xl border border-zion-accent/15 bg-[var(--palette-paper)]/70 p-4">
          <RatingDetail label="Approach" value={testimony.approachRating} />
          <RatingDetail label="Food" value={testimony.foodRating} />
          <RatingDetail label="Service" value={testimony.serviceRating} />
          <RatingDetail label="Venue" value={testimony.venueRating} />
          <RatingDetail label="Communication" value={testimony.communicationRating} />
        </div>
        <p className="mt-4 text-xs text-neutral-400">Shared {formatDate(testimony.submittedAt)}</p>
      </div>
    </article>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  placeholder = 'Select...',
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<'down' | 'up'>('down');
  const ref = useRef<HTMLDivElement>(null);

  const toggleOpen = () => {
    if (!open && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setDirection(spaceBelow < 250 ? 'up' : 'down');
    }
    setOpen(!open);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selected = options.find((opt) => opt.value === value);

  return (
    <div className="flex-1 min-w-[140px]">
      {label && (
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-gray-500">
          {label}
        </label>
      )}
      <div className={`relative group/input ${open ? 'z-50' : 'z-10'}`} ref={ref}>
        <button
          type="button"
          onClick={toggleOpen}
          className={`flex h-[46px] w-full items-center justify-between rounded-xl border ${open ? 'border-zion-accent bg-surface ring-2 ring-zion-accent/20 ' : 'border-zion-accent/20 bg-surface '} px-4 font-sans text-sm shadow-sm transition-all duration-300 hover:border-zion-accent/50 hover:bg-[var(--palette-gold-soft)]/30 cursor-pointer`}
        >
          <span className="block min-w-0 truncate pr-10 text-left font-sans text-sm font-medium text-ink">
            {selected?.label || placeholder}
          </span>
        </button>

        <div
          className={`pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 transition-all duration-300 ${open ? 'text-accent-ink rotate-180' : 'text-gray-400 group-hover/input:text-accent-ink'}`}
        >
          <ChevronDown className="h-4 w-4" />
        </div>

        {open && (
          <div
            className={`events-scrollbar absolute left-0 z-50 max-h-64 w-full overflow-y-auto rounded-2xl border border-zion-accent/25 bg-surface py-1.5 shadow-[0_12px_40px_color-mix(in_srgb,var(--palette-night)_15%,transparent)] ${direction === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'}`}
          >
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`flex w-full cursor-pointer items-center px-4 py-2.5 text-left text-sm transition-colors ${value === opt.value ? 'bg-[var(--palette-gold-soft)] font-semibold text-accent-ink' : 'text-ink/85 hover:bg-[var(--palette-gold-soft)]/50 hover:text-ink'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function TestimoniesClient({
  allowSubmissions = true,
  disabledMessage = 'Testimony submissions are temporarily unavailable.',
}: {
  allowSubmissions?: boolean;
  disabledMessage?: string;
}) {
  const [testimonies, setTestimonies] = useState<PublicTestimony[]>([]);
  const [filterOptions, setFilterOptions] = useState<PublicTestimoniesResponse['filterOptions']>({
    eventTypes: FALLBACK_EVENT_TYPES,
    packages: [],
  });
  const [filters, setFilters] = useState({
    eventType: '',
    rating: '',
    sort: 'recent',
    withPhotos: false,
    package: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [photo, setPhoto] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submissionNotice, setSubmissionNotice] = useState<{
    message: string;
    flagged: boolean;
    reasons: string[];
  } | null>(null);
  const reducedMotion = useReducedMotion();
  const [rotationIndex, setRotationIndex] = useState(0);
  const [isGridPaused, setIsGridPaused] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [typedLength, setTypedLength] = useState(0);
  const [isDeletingPlaceholder, setIsDeletingPlaceholder] = useState(false);
  const [isPlaceholderPaused, setIsPlaceholderPaused] = useState(false);
  const [placeholderCursorVisible, setPlaceholderCursorVisible] = useState(true);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.eventType) params.set('eventType', filters.eventType);
    if (filters.rating) params.set('rating', filters.rating);
    if (filters.sort) params.set('sort', filters.sort);
    if (filters.withPhotos) params.set('withPhotos', 'true');
    if (filters.package) params.set('package', filters.package);
    return params.toString();
  }, [filters]);

  const loadTestimonies = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/client/testimonies?${query}`, { cache: 'no-store' });
      const payload = (await response.json()) as PublicTestimoniesResponse;
      if (!response.ok) throw new Error(payload.error || 'Unable to load testimonies.');
      setTestimonies(payload.testimonies);
      setRotationIndex(0);
      setFilterOptions({
        eventTypes: payload.filterOptions.eventTypes.length
          ? payload.filterOptions.eventTypes
          : FALLBACK_EVENT_TYPES,
        packages: payload.filterOptions.packages,
      });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to load testimonies.');
    } finally {
      setIsLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadTestimonies(), 150);
    return () => window.clearTimeout(timeout);
  }, [loadTestimonies]);

  const updateRating = (
    key:
      | 'overallRating'
      | 'approachRating'
      | 'foodRating'
      | 'serviceRating'
      | 'venueRating'
      | 'communicationRating',
    value: number,
  ) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError('');

    if (!allowSubmissions) {
      setSubmitError(disabledMessage);
      return;
    }

    if (!form.eventType) {
      setSubmitError('Please select an event type.');
      return;
    }

    if (!form.eventDate) {
      setSubmitError('Please select your event date.');
      return;
    }

    if (!form.overallRating || !form.approachRating || !form.foodRating || !form.serviceRating) {
      setSubmitError('Overall, approach, food, and service ratings are required.');
      return;
    }

    const trimmedComment = form.comment.trim();
    if (trimmedComment.length > 0 && trimmedComment.length < 8) {
      setSubmitError(
        'If you write a testimony, please enter at least 8 characters (or leave it blank).',
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const body = new FormData();
      Object.entries(form).forEach(([key, value]) => body.set(key, String(value)));
      if (photo) body.set('photo', photo);
      const response = await fetch('/api/client/testimonies', { method: 'POST', body });
      const payload = (await response.json()) as {
        error?: string;
        message?: string;
        flagged?: boolean;
        flagReasons?: string[];
        testimony?: PublicTestimony | null;
      };
      if (!response.ok) throw new Error(payload.error || 'Unable to submit testimony.');

      if (!payload.flagged && payload.testimony) {
        const created = payload.testimony;
        setTestimonies((current) => [created, ...current.filter((item) => item.id !== created.id)]);
        void loadTestimonies();
      }

      setSubmissionNotice({
        message: payload.flagged
          ? payload.message ||
            'Your testimony was automatically tagged for safety review and placed on hold.'
          : 'Your testimony has been successfully shared and is now visible below.',
        flagged: Boolean(payload.flagged),
        reasons: payload.flagReasons ?? [],
      });
      setForm(EMPTY_FORM);
      setPhoto(null);
      setIsFormOpen(false);
    } catch (caughtError) {
      setSubmitError(
        caughtError instanceof Error ? caughtError.message : 'Unable to submit testimony.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (!isFormOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsFormOpen(false);
      }
    };
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFormOpen]);

  useEffect(() => {
    if (!submissionNotice) return;
    const timeout = window.setTimeout(() => setSubmissionNotice(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [submissionNotice]);

  const stepEntries = useCallback(
    (direction: 1 | -1) => {
      setRotationIndex((current) => {
        if (testimonies.length < 2) return 0;
        return (current + direction + testimonies.length) % testimonies.length;
      });
    },
    [testimonies.length],
  );

  useEffect(() => {
    if (isGridPaused || isFormOpen || testimonies.length < 2) return;
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }
    const interval = window.setInterval(() => stepEntries(1), 5000);
    return () => window.clearInterval(interval);
  }, [isGridPaused, isFormOpen, stepEntries, testimonies.length]);

  const activePlaceholderText =
    TESTIMONY_PLACEHOLDERS[placeholderIndex] ?? TESTIMONY_PLACEHOLDERS[0];
  const shouldAnimatePlaceholder = isFormOpen && !reducedMotion && form.comment.length === 0;

  useEffect(() => {
    if (!shouldAnimatePlaceholder) return;

    let delay = isDeletingPlaceholder ? 20 : 38;
    if (!isDeletingPlaceholder && typedLength === activePlaceholderText.length) {
      delay = isPlaceholderPaused ? 1700 : 100;
    } else if (isDeletingPlaceholder && typedLength === 0) {
      delay = 280;
    }

    const timer = window.setTimeout(() => {
      if (!isDeletingPlaceholder) {
        if (typedLength < activePlaceholderText.length) {
          setTypedLength((count) => count + 1);
          setIsPlaceholderPaused(false);
        } else if (!isPlaceholderPaused) {
          setIsPlaceholderPaused(true);
        } else {
          setIsDeletingPlaceholder(true);
          setIsPlaceholderPaused(false);
        }
      } else if (typedLength > 0) {
        setTypedLength((count) => count - 1);
      } else {
        setIsDeletingPlaceholder(false);
        setPlaceholderIndex((current) => (current + 1) % TESTIMONY_PLACEHOLDERS.length);
      }
    }, delay);

    return () => window.clearTimeout(timer);
  }, [
    shouldAnimatePlaceholder,
    activePlaceholderText.length,
    typedLength,
    isDeletingPlaceholder,
    isPlaceholderPaused,
  ]);

  useEffect(() => {
    if (!shouldAnimatePlaceholder || !isPlaceholderPaused) return;
    const blink = window.setInterval(() => {
      setPlaceholderCursorVisible((visible) => !visible);
    }, 480);
    return () => window.clearInterval(blink);
  }, [shouldAnimatePlaceholder, isPlaceholderPaused]);

  const rotatedTestimonies = useMemo(() => {
    if (testimonies.length < 2) return testimonies;
    const start = rotationIndex % testimonies.length;
    return [...testimonies.slice(start), ...testimonies.slice(0, start)];
  }, [rotationIndex, testimonies]);

  const modalInputClasses =
    'w-full rounded-2xl border border-zion-accent/25 bg-surface py-3.5 pl-11 pr-4 font-sans text-sm font-normal text-ink shadow-sm transition-all duration-300 placeholder:text-muted/70 hover:border-zion-accent/45 hover:bg-surface focus:border-zion-accent focus:bg-surface focus:outline-none focus:ring-4 focus:ring-zion-accent/15';

  return (
    <>
      <section className="relative z-10 mx-auto w-full max-w-[1600px] px-4 py-8 sm:px-6 md:px-8 md:py-12">
        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-accent-ink">
              Real celebrations. Real stories.
            </p>
            <h1 className="mt-3 font-sahitya text-4xl text-ink md:text-5xl">
              Experiences worth sharing
            </h1>
          </div>
          <button
            type="button"
            onClick={() => {
              if (allowSubmissions) {
                setIsFormOpen(true);
              } else {
                setSubmissionNotice(null);
                setSubmitError(disabledMessage);
              }
            }}
            disabled={!allowSubmissions}
            className="group relative inline-flex min-h-12 items-center justify-center gap-2 overflow-hidden rounded-full border-2 border-[var(--palette-client-button)] bg-[var(--palette-client-button)] px-7 py-3.5 text-sm font-bold uppercase tracking-[0.14em] text-[var(--text-on-action)] shadow-lg transition-all duration-500 hover:-translate-y-0.5 hover:shadow-[0_18px_36px_-14px_color-mix(in_srgb,var(--palette-client-button)_65%,transparent)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span
              aria-hidden="true"
              className="absolute inset-0 translate-y-full bg-[var(--palette-client-button-hover)] transition-transform duration-500 ease-in-out group-hover:translate-y-0 motion-reduce:hidden"
            />
            <span className="relative z-10 inline-flex items-center gap-2">
              <MessageSquareQuote className="h-5 w-5" aria-hidden="true" />
              Share Your Experience
            </span>
          </button>
        </div>

        {!allowSubmissions && (
          <div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-800">
            {disabledMessage}
          </div>
        )}

        {submissionNotice && (
          <div
            role={submissionNotice.flagged ? 'alert' : 'status'}
            aria-live="polite"
            className={`mb-8 flex items-start justify-between gap-4 rounded-2xl border px-5 py-4 shadow-sm animate-[fadeIn_300ms_ease-out] ${
              submissionNotice.flagged
                ? 'border-[var(--palette-danger)]/45 bg-[var(--palette-danger-soft)] text-[var(--palette-danger)]'
                : 'border-[var(--palette-success)]/30 bg-[var(--palette-success-soft)] text-[var(--palette-success)]'
            }`}
          >
            <div className="flex items-start gap-3">
              {submissionNotice.flagged ? (
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              )}
              <div>
                <p className="font-sans text-sm font-bold">
                  {submissionNotice.flagged
                    ? 'Entry placed on hold for safety review'
                    : 'Successfully shared'}
                </p>
                <p className="mt-0.5 font-sans text-sm text-ink/85">{submissionNotice.message}</p>
                {submissionNotice.flagged && submissionNotice.reasons.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {submissionNotice.reasons.map((reason) => (
                      <span
                        key={reason}
                        className="inline-flex items-center rounded-full border border-[var(--palette-danger)]/35 bg-white/80 px-2.5 py-0.5 font-sans text-xs font-semibold text-[var(--palette-danger)]"
                      >
                        {reason}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <button
              type="button"
              aria-label="Dismiss status indicator"
              onClick={() => setSubmissionNotice(null)}
              className="rounded-full p-1 text-muted transition-colors hover:bg-black/5 hover:text-ink"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}

        <div className="relative z-30 mb-8 rounded-[1.75rem] border border-white/80 bg-surface p-4 shadow-sm md:p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.14em] text-ink">
            <SlidersHorizontal className="h-4 w-4 text-accent-ink" />
            Browse testimonies
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 relative z-40">
            <FilterSelect
              value={filters.eventType}
              onChange={(value) => setFilters((current) => ({ ...current, eventType: value }))}
              options={[
                { value: '', label: 'All event types' },
                ...filterOptions.eventTypes.map((type) => ({ value: type, label: type })),
              ]}
            />
            <FilterSelect
              value={filters.rating}
              onChange={(value) => setFilters((current) => ({ ...current, rating: value }))}
              options={[
                { value: '', label: 'All ratings' },
                ...[5, 4, 3, 2, 1].map((rating) => ({
                  value: String(rating),
                  label: `${rating} star${rating === 1 ? '' : 's'}`,
                })),
              ]}
            />
            <FilterSelect
              value={filters.sort}
              onChange={(value) => setFilters((current) => ({ ...current, sort: value }))}
              options={[
                { value: 'recent', label: 'Most recent' },
                { value: 'highest', label: 'Highest rated' },
              ]}
            />
            <FilterSelect
              value={filters.package}
              onChange={(value) => setFilters((current) => ({ ...current, package: value }))}
              options={[
                { value: '', label: 'All packages' },
                ...filterOptions.packages.map((pkg) => ({ value: pkg, label: pkg })),
              ]}
            />
            <FilterSelect
              value={filters.withPhotos ? 'true' : ''}
              onChange={(value) =>
                setFilters((current) => ({ ...current, withPhotos: value === 'true' }))
              }
              options={[
                { value: '', label: 'Any photo' },
                { value: 'true', label: 'With photos' },
              ]}
            />
          </div>
        </div>

        {error ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-10 text-center">
            <p className="font-bold text-red-700">Unable to load testimonies.</p>
            <p className="mt-1 text-sm text-red-600">Please try again later.</p>
            <button
              type="button"
              onClick={() => void loadTestimonies()}
              className="mt-5 rounded-full bg-red-700 px-5 py-2 text-sm font-bold text-white"
            >
              Try again
            </button>
          </div>
        ) : isLoading ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <div
                key={item}
                className="h-96 animate-pulse rounded-[2rem] border border-white/70 bg-surface"
              />
            ))}
          </div>
        ) : testimonies.length === 0 ? (
          <div className="rounded-[2rem] border border-dashed border-zion-accent/40 bg-surface px-6 py-20 text-center">
            <MessageSquareQuote className="mx-auto h-12 w-12 text-accent-ink" />
            <h3 className="mt-5 font-sahitya text-3xl text-ink">No testimonies yet.</h3>
            <p className="mt-2 text-muted">
              Be the first to share your Zion Events Place experience.
            </p>
          </div>
        ) : (
          <div
            className="relative"
            onMouseEnter={() => setIsGridPaused(true)}
            onMouseLeave={() => setIsGridPaused(false)}
            onFocusCapture={() => setIsGridPaused(true)}
            onBlurCapture={() => setIsGridPaused(false)}
          >
            {testimonies.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => stepEntries(-1)}
                  aria-label="Previous testimonies"
                  className="touch-target absolute left-1 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-zion-accent/30 bg-surface text-ink shadow-md transition-all duration-300 hover:scale-105 hover:border-zion-accent hover:bg-[var(--palette-client-button)] hover:text-[var(--text-on-action)] motion-reduce:transform-none sm:-left-4 lg:-left-5"
                >
                  <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => stepEntries(1)}
                  aria-label="Next testimonies"
                  className="touch-target absolute right-1 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-zion-accent/30 bg-surface text-ink shadow-md transition-all duration-300 hover:scale-105 hover:border-zion-accent hover:bg-[var(--palette-client-button)] hover:text-[var(--text-on-action)] motion-reduce:transform-none sm:-right-4 lg:-right-5"
                >
                  <ChevronRight className="h-5 w-5" aria-hidden="true" />
                </button>
              </>
            )}

            <div
              key={rotationIndex}
              className={`grid grid-cols-1 items-start gap-6 animate-[fadeInUp_500ms_ease-out] motion-reduce:animate-none md:grid-cols-2 xl:grid-cols-3 ${
                testimonies.length > 1 ? 'px-12 sm:px-8' : ''
              }`}
            >
              {rotatedTestimonies.map((testimony) => (
                <TestimonyCard key={testimony.id} testimony={testimony} />
              ))}
            </div>
          </div>
        )}
      </section>

      {isFormOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="share-experience-title"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsFormOpen(false);
            }
          }}
          className="fixed inset-0 z-[160] flex items-center justify-center overscroll-contain bg-black/55 px-3 py-6 animate-[fadeIn_200ms_ease-out]"
        >
          <div className="events-scrollbar relative max-h-[92vh] w-full max-w-4xl overflow-y-auto overscroll-contain rounded-[2rem] border border-zion-accent/25 bg-[var(--palette-paper)] shadow-[0_32px_90px_-24px_color-mix(in_srgb,var(--palette-night)_45%,transparent)]">
            {/* Sticky Modal Header */}
            <div className="sticky top-0 z-10 border-b border-zion-accent/15 bg-[var(--palette-paper)]/95 px-6 py-5 md:px-10">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="font-sans text-xs font-bold uppercase tracking-[0.2em] text-accent-ink">
                    Client Testimony
                  </span>
                  <h2
                    id="share-experience-title"
                    className="mt-2 font-sahitya text-3xl text-ink md:text-4xl"
                  >
                    Share your Zion experience
                  </h2>
                  <div className="mt-3 flex items-start gap-2.5 rounded-2xl border border-zion-accent/25 bg-[var(--palette-gold-soft)]/45 px-4 py-3 text-left">
                    <ShieldCheck
                      className="mt-0.5 h-4 w-4 shrink-0 text-accent-ink"
                      aria-hidden="true"
                    />
                    <p className="font-sans text-xs leading-relaxed text-ink/90">
                      <span className="font-bold text-ink">Community reminder:</span> Please use
                      proper, respectful, and ethical words when sharing your experience, and avoid
                      curses, profanity, or any inappropriate or unethical remarks and photos.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Close share experience dialog"
                  onClick={() => setIsFormOpen(false)}
                  className="touch-target flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-zion-accent/25 bg-surface text-muted transition-all duration-300 hover:border-[var(--palette-client-button)] hover:bg-[var(--palette-client-button)] hover:text-ink"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
            </div>

            <form onSubmit={submit} className="space-y-8 p-6 md:p-10">
              {/* Section 01: Your Celebration */}
              <section className="space-y-5">
                <div className="flex items-center gap-3">
                  <span className="font-sans text-xs font-bold uppercase tracking-[0.2em] text-accent-ink">
                    01
                  </span>
                  <span aria-hidden="true" className="h-px w-8 bg-zion-accent/50" />
                  <h3 className="font-serif text-xl font-semibold text-ink">Your Celebration</h3>
                </div>

                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <div className="group/input">
                    <label
                      htmlFor="testimony-client-name"
                      className="mb-2 block font-sans text-xs font-bold uppercase tracking-[0.14em] text-ink"
                    >
                      Name or Nickname <span className="text-accent-ink">*</span>
                    </label>
                    <div className="relative flex items-center">
                      <User
                        aria-hidden="true"
                        className="pointer-events-none absolute left-4 h-4 w-4 text-muted/80 transition-colors group-focus-within/input:text-accent-ink"
                      />
                      <input
                        id="testimony-client-name"
                        required
                        maxLength={160}
                        placeholder="e.g., Maria & Juan"
                        value={form.clientName}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, clientName: event.target.value }))
                        }
                        className={modalInputClasses}
                      />
                    </div>
                  </div>

                  <div className="group/input">
                    <label
                      htmlFor="testimony-package"
                      className="mb-2 block font-sans text-xs font-bold uppercase tracking-[0.14em] text-ink"
                    >
                      Package Availed{' '}
                      <span className="font-normal lowercase text-muted">(optional)</span>
                    </label>
                    <div className="relative flex items-center">
                      <Package
                        aria-hidden="true"
                        className="pointer-events-none absolute left-4 h-4 w-4 text-muted/80 transition-colors group-focus-within/input:text-accent-ink"
                      />
                      <input
                        id="testimony-package"
                        maxLength={255}
                        placeholder="e.g., Wedding Premium Package"
                        value={form.packageName}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, packageName: event.target.value }))
                        }
                        className={modalInputClasses}
                      />
                    </div>
                  </div>

                  <div className="group/input">
                    <label
                      htmlFor="testimony-event-type"
                      className="mb-2 block font-sans text-xs font-bold uppercase tracking-[0.14em] text-ink"
                    >
                      Event Type <span className="text-accent-ink">*</span>
                    </label>
                    <ZionSelectPopover
                      id="testimony-event-type"
                      value={form.eventType}
                      placeholder="Select event type"
                      leadingIcon={
                        <CalendarHeart aria-hidden="true" className="h-4 w-4 text-accent-ink" />
                      }
                      options={filterOptions.eventTypes.map((eventType) => ({
                        value: eventType,
                        label: eventType,
                      }))}
                      onChange={(value) => setForm((current) => ({ ...current, eventType: value }))}
                      triggerClassName="rounded-2xl border border-zion-accent/25 bg-surface px-4 py-3.5 shadow-sm hover:border-zion-accent/45 hover:bg-surface focus:border-zion-accent focus:bg-surface focus:ring-4 focus:ring-zion-accent/15"
                    />
                  </div>

                  <div className="group/input">
                    <label
                      htmlFor="testimony-event-date"
                      className="mb-2 block font-sans text-xs font-bold uppercase tracking-[0.14em] text-ink"
                    >
                      Event Date <span className="text-accent-ink">*</span>
                    </label>
                    <ZionDatePicker
                      id="testimony-event-date"
                      value={form.eventDate}
                      maxDate={new Date().toISOString().slice(0, 10)}
                      placeholder="Select event date"
                      onChange={(value) => setForm((current) => ({ ...current, eventDate: value }))}
                    />
                  </div>
                </div>
              </section>

              {/* Section 02: Ratings */}
              <section className="space-y-5 border-t border-zion-accent/15 pt-7">
                <div className="flex items-center gap-3">
                  <span className="font-sans text-xs font-bold uppercase tracking-[0.2em] text-accent-ink">
                    02
                  </span>
                  <span aria-hidden="true" className="h-px w-8 bg-zion-accent/50" />
                  <h3 className="font-serif text-xl font-semibold text-ink">
                    Rate Your Experience
                  </h3>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <StarInput
                    label="Overall rating"
                    value={form.overallRating}
                    onChange={(value) => updateRating('overallRating', value)}
                    required
                  />
                  <StarInput
                    label="Approach"
                    value={form.approachRating}
                    onChange={(value) => updateRating('approachRating', value)}
                    required
                  />
                  <StarInput
                    label="Food"
                    value={form.foodRating}
                    onChange={(value) => updateRating('foodRating', value)}
                    required
                  />
                  <StarInput
                    label="Service"
                    value={form.serviceRating}
                    onChange={(value) => updateRating('serviceRating', value)}
                    required
                  />
                  <StarInput
                    label="Venue"
                    value={form.venueRating}
                    onChange={(value) => updateRating('venueRating', value)}
                  />
                  <StarInput
                    label="Communication"
                    value={form.communicationRating}
                    onChange={(value) => updateRating('communicationRating', value)}
                  />
                </div>
              </section>

              {/* Section 03: Written Testimony & Photo */}
              <section className="space-y-5 border-t border-zion-accent/15 pt-7">
                <div className="flex items-center gap-3">
                  <span className="font-sans text-xs font-bold uppercase tracking-[0.2em] text-accent-ink">
                    03
                  </span>
                  <span aria-hidden="true" className="h-px w-8 bg-zion-accent/50" />
                  <h3 className="font-serif text-xl font-semibold text-ink">
                    Your Story &amp; Photo
                  </h3>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <label
                      htmlFor="testimony-comment"
                      className="font-sans text-xs font-bold uppercase tracking-[0.14em] text-ink"
                    >
                      Written Testimony{' '}
                      <span className="font-normal lowercase text-muted">(optional)</span>
                    </label>
                    <span className="font-sans text-xs font-medium text-muted">
                      {form.comment.length.toLocaleString()} / 1,000
                    </span>
                  </div>
                  <div className="relative">
                    {form.comment.length === 0 && (
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-x-5 top-4 select-none font-serif text-base leading-relaxed text-muted/70"
                      >
                        {shouldAnimatePlaceholder
                          ? activePlaceholderText.slice(0, typedLength)
                          : TESTIMONY_PLACEHOLDERS[0]}
                        {shouldAnimatePlaceholder && (
                          <span
                            className={`ml-0.5 inline-block font-sans font-light text-accent-ink transition-opacity duration-150 ${
                              isPlaceholderPaused && !placeholderCursorVisible
                                ? 'opacity-0'
                                : 'opacity-100'
                            }`}
                          >
                            |
                          </span>
                        )}
                      </span>
                    )}
                    <textarea
                      id="testimony-comment"
                      maxLength={1000}
                      rows={5}
                      value={form.comment}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, comment: event.target.value }))
                      }
                      className="w-full resize-y rounded-2xl border border-zion-accent/25 bg-surface px-5 py-4 font-serif text-base leading-relaxed text-ink shadow-sm transition-all duration-300 hover:border-zion-accent/45 hover:bg-surface focus:border-zion-accent focus:bg-surface focus:outline-none focus:ring-4 focus:ring-zion-accent/15"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-zion-accent/40 bg-surface p-5 transition-colors duration-300 hover:border-zion-accent/70 hover:bg-surface sm:flex-row sm:items-center sm:justify-between">
                  <label className="flex flex-1 cursor-pointer items-center gap-4">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--palette-client-button)]/25 text-accent-ink shadow-sm">
                      <Camera className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-sans text-sm font-bold text-ink">
                        Optional event photo
                      </span>
                      <span className="mt-0.5 block truncate font-sans text-xs text-muted">
                        {photo ? photo.name : 'Click to upload JPG, PNG, or WebP (up to 4 MB)'}
                      </span>
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(event) => setPhoto(event.target.files?.[0] ?? null)}
                      className="sr-only"
                    />
                  </label>
                  {photo && (
                    <button
                      type="button"
                      onClick={() => setPhoto(null)}
                      aria-label="Remove selected photo"
                      className="inline-flex items-center gap-1.5 self-start rounded-full border border-zion-accent/25 bg-surface px-3 py-1.5 font-sans text-xs font-semibold text-muted transition-colors hover:border-zion-accent hover:text-ink sm:self-center"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                      Remove
                    </button>
                  )}
                </div>

                <label className="flex cursor-pointer items-start gap-3.5 rounded-2xl border border-zion-accent/20 bg-surface p-4 text-sm leading-6 text-muted transition-colors hover:border-zion-accent/35">
                  <input
                    required
                    type="checkbox"
                    checked={form.consent}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, consent: event.target.checked }))
                    }
                    className="mt-1 h-4 w-4 flex-shrink-0 accent-[var(--palette-gold-ink)]"
                  />
                  <span className="font-serif">
                    I consent to Zion Events Place publishing my ratings, written testimony, and any
                    attached photo publicly right away.
                  </span>
                </label>
              </section>

              {submitError && (
                <div
                  role="alert"
                  className="rounded-2xl border border-red-200 bg-red-50 px-5 py-3.5 text-sm font-semibold text-red-700"
                >
                  {submitError}
                </div>
              )}

              <div className="flex flex-col-reverse gap-3 border-t border-zion-accent/15 pt-6 sm:flex-row sm:items-center sm:justify-end">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="inline-flex min-h-12 items-center justify-center rounded-full border border-zion-accent/30 bg-transparent px-7 py-3 font-sans text-xs font-bold uppercase tracking-[0.16em] text-muted transition-colors duration-300 hover:border-zion-accent hover:bg-surface hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="group/submit relative inline-flex min-h-12 items-center justify-center overflow-hidden rounded-full border-2 border-[var(--palette-client-button)] bg-[var(--palette-client-button)] px-8 py-3 font-sans text-xs font-bold uppercase tracking-[0.18em] text-[var(--text-on-action)] shadow-sm transition-all duration-500 hover:shadow-[0_16px_34px_-14px_color-mix(in_srgb,var(--palette-client-button)_65%,transparent)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 translate-y-full bg-[var(--palette-client-button-hover)] transition-transform duration-500 ease-in-out group-hover/submit:translate-y-0 motion-reduce:hidden"
                  />
                  <span className="relative z-10 inline-flex items-center gap-2">
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Send
                        className="h-4 w-4 transition-transform duration-300 group-hover/submit:-translate-y-0.5 group-hover/submit:translate-x-0.5 motion-reduce:transform-none"
                        aria-hidden="true"
                      />
                    )}
                    {isSubmitting ? 'Submitting...' : 'Submit Testimony'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
