'use client';

import Image from 'next/image';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Award,
  BadgeCheck,
  Banknote,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  Crown,
  Lock,
  ShieldCheck,
  Sparkles,
  Upload,
  Users,
  Wallet,
} from 'lucide-react';
import { useState } from 'react';

import { formatPhp, type RecommendedPackage } from './packageRecommendations';

export interface DownpaymentDetails {
  method: string;
  senderName: string;
  referenceNumber: string;
  receiptFileName: string;
  agreedToTerms: boolean;
}

interface PaymentChannel {
  readonly id: string;
  readonly label: string;
  readonly kind: 'wallet' | 'bank' | 'cash';
  readonly accountName: string;
  readonly accountNumber: string;
  readonly note: string;
}

const PAYMENT_CHANNELS: readonly PaymentChannel[] = [
  {
    id: 'GCash',
    label: 'GCash',
    kind: 'wallet',
    accountName: 'Zion Events Place',
    accountNumber: '0917 884 2190',
    note: 'Instant mobile wallet transfer',
  },
  {
    id: 'Maya',
    label: 'Maya',
    kind: 'wallet',
    accountName: 'Zion Events Place',
    accountNumber: '0917 884 2190',
    note: 'Instant mobile wallet transfer',
  },
  {
    id: 'GoTyme',
    label: 'GoTyme',
    kind: 'wallet',
    accountName: 'Zion Events Place',
    accountNumber: '0148 9203 7714',
    note: 'Digital bank transfer',
  },
  {
    id: 'BDO',
    label: 'BDO',
    kind: 'bank',
    accountName: 'Zion Events Place Corp.',
    accountNumber: '0045 8120 9341',
    note: 'InstaPay / PESONet bank transfer',
  },
  {
    id: 'BPI',
    label: 'BPI',
    kind: 'bank',
    accountName: 'Zion Events Place Corp.',
    accountNumber: '3089 4412 07',
    note: 'InstaPay / PESONet bank transfer',
  },
  {
    id: 'Metrobank',
    label: 'Metrobank',
    kind: 'bank',
    accountName: 'Zion Events Place Corp.',
    accountNumber: '007-412-50891-3',
    note: 'InstaPay / PESONet bank transfer',
  },
  {
    id: 'UnionBank',
    label: 'UnionBank',
    kind: 'bank',
    accountName: 'Zion Events Place Corp.',
    accountNumber: '1094 2810 4456',
    note: 'InstaPay / PESONet bank transfer',
  },
  {
    id: 'On-Hand Cash',
    label: 'On-Hand Cash',
    kind: 'cash',
    accountName: 'Zion Events Place Admin Office',
    accountNumber: 'Direct to Zion Admin',
    note: 'Cash downpayment handed to Zion admin',
  },
] as const;

interface PackageSuggestionsViewProps {
  eventType: string;
  guestCount: number;
  eventDateLabel: string;
  budgetRange: string;
  recommendations: readonly RecommendedPackage[];
  selectedPackageId: string;
  onSelectPackage: (packageId: string) => void;
  onBackToReview: () => void;
  onProceedToDownpayment: () => void;
}

export function PackageSuggestionsView({
  eventType,
  guestCount,
  eventDateLabel,
  budgetRange,
  recommendations,
  selectedPackageId,
  onSelectPackage,
  onBackToReview,
  onProceedToDownpayment,
}: PackageSuggestionsViewProps) {
  const selectedRec =
    recommendations.find((item) => item.pkg.id === selectedPackageId) ?? recommendations[0] ?? null;

  return (
    <section
      aria-labelledby="package-suggestions-heading"
      className="w-full space-y-4 rounded-[1.75rem] border border-[var(--palette-gold)]/30 bg-[var(--palette-paper)]/95 p-4 shadow-[0_24px_60px_-30px_color-mix(in_srgb,var(--palette-ink)_22%,transparent)] sm:p-5 lg:p-6"
    >
      {/* Modern Structured Header & Event Brief Bar */}
      <div className="space-y-3.5 border-b border-[var(--palette-gold)]/20 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--palette-booklet-cover)]/45 px-3 py-0.5 font-sans text-xs font-bold uppercase tracking-[0.14em] text-ink">
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              Ranked by Relevancy
            </span>
            <h2
              id="package-suggestions-heading"
              className="mt-1.5 font-serif text-2xl tracking-tight text-ink sm:text-3xl"
            >
              Recommended Packages for Your {eventType}
            </h2>
          </div>

          <button
            type="button"
            onClick={onBackToReview}
            className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border border-[var(--palette-gold)]/35 bg-[var(--palette-white)] px-4 py-2 font-sans text-xs font-semibold uppercase tracking-[0.14em] text-ink shadow-2xs transition-all hover:border-[var(--palette-gold-ink)] hover:bg-[var(--palette-cream)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Edit Details</span>
          </button>
        </div>

        {/* Structured Event Brief Strip */}
        <div className="grid grid-cols-1 gap-2 rounded-2xl border border-[var(--palette-gold)]/20 bg-[var(--palette-cream)]/45 p-3 sm:grid-cols-3 sm:divide-x sm:divide-[var(--palette-gold)]/20 sm:gap-0">
          <div className="flex items-center gap-2.5 sm:px-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--palette-white)] text-[var(--palette-gold-ink)] shadow-2xs">
              <Users className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <p className="font-sans text-xs text-ink/60">Guest Count</p>
              <p className="font-sans text-xs font-semibold text-ink sm:text-sm">
                {guestCount} pax
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 sm:px-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--palette-white)] text-[var(--palette-gold-ink)] shadow-2xs">
              <Calendar className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <p className="font-sans text-xs text-ink/60">Event Date</p>
              <p className="font-sans text-xs font-semibold text-ink sm:text-sm">
                {eventDateLabel}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 sm:px-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--palette-white)] text-[var(--palette-gold-ink)] shadow-2xs">
              <Wallet className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <p className="font-sans text-xs text-ink/60">Budget Range</p>
              <p className="font-sans text-xs font-semibold text-ink sm:text-sm">{budgetRange}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Full-Width Compact Ranked Package Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {recommendations.map((rec, index) => {
          const isSelected = selectedRec?.pkg.id === rec.pkg.id;
          const isTopPick = index === 0;

          return (
            <article
              key={rec.pkg.id}
              className={`group flex flex-col overflow-hidden rounded-2xl border transition-all duration-300 ${
                isSelected
                  ? 'border-[var(--palette-booklet-cover)] bg-[var(--palette-cream)]/55 shadow-md ring-2 ring-[var(--palette-booklet-cover)]/60'
                  : 'border-[var(--palette-gold)]/25 bg-[var(--palette-white)] hover:border-[var(--palette-booklet-cover)] hover:shadow-sm'
              }`}
            >
              {/* Compact Package Photo + Relevancy Badges */}
              <div className="relative h-32 w-full overflow-hidden bg-[var(--palette-cream)]">
                <Image
                  src={rec.pkg.imageSrc}
                  alt={rec.pkg.imageAlt}
                  fill
                  sizes="(max-width: 639px) 100vw, (max-width: 1279px) 33vw, 25vw"
                  className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/55 via-ink/10 to-transparent"
                />

                {/* Top-Left Best Match / Best Value Badge */}
                <div className="absolute top-2.5 left-2.5">
                  {rec.badge === 'Best Match' ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--palette-booklet-cover)] px-2.5 py-0.5 font-sans text-xs font-bold uppercase tracking-[0.1em] text-[var(--text-on-action)] shadow-sm">
                      <Crown className="h-3 w-3" strokeWidth={2.4} aria-hidden="true" />
                      Best Match
                    </span>
                  ) : rec.badge === 'Best Value' ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--palette-success)] px-2.5 py-0.5 font-sans text-xs font-bold uppercase tracking-[0.1em] text-[var(--palette-white)] shadow-sm">
                      <BadgeCheck className="h-3 w-3" strokeWidth={2.4} aria-hidden="true" />
                      Best Value
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-[var(--palette-paper)]/92 px-2.5 py-0.5 font-sans text-xs font-semibold text-ink shadow-xs backdrop-blur-xs">
                      #{index + 1} Match
                    </span>
                  )}
                </div>

                {/* Top-Right Match % */}
                <span className="absolute top-2.5 right-2.5 rounded-full border border-[var(--palette-white)]/50 bg-[var(--palette-paper)]/92 px-2.5 py-0.5 font-sans text-xs font-bold text-ink shadow-xs backdrop-blur-xs">
                  {rec.matchScore}%
                </span>

                {/* Bottom-Left Style & Budget Fit */}
                <div className="absolute bottom-2 left-2.5 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full bg-[var(--palette-paper)]/90 px-2.5 py-0.5 font-sans text-xs font-semibold text-ink backdrop-blur-xs">
                    {rec.pkg.style}
                  </span>
                  {rec.withinBudget ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--palette-success-soft)] px-2 py-0.5 font-sans text-xs font-semibold text-[var(--palette-success)]">
                      <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                      In Budget
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Compact Card Body */}
              <div className="flex flex-1 flex-col justify-between p-3.5">
                <div>
                  <h3 className="font-serif text-lg font-medium leading-snug text-ink">
                    {rec.pkg.name}
                  </h3>
                  <p className="mt-0.5 line-clamp-2 font-sans text-xs leading-relaxed text-ink/70">
                    {rec.pkg.tagline}
                  </p>

                  {/* Compact Pricing & Downpayment Strip */}
                  <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-[var(--palette-gold)]/20 bg-[var(--palette-cream)]/40 p-2.5">
                    <div>
                      <p className="font-sans text-xs font-semibold text-ink/60">Total</p>
                      <p className="font-serif text-base font-bold text-ink">
                        {formatPhp(rec.estimatedTotal)}
                      </p>
                      <p className="font-sans text-xs text-ink/60">
                        {rec.excessGuests > 0
                          ? `${rec.pkg.paxIncluded} + ${rec.excessGuests} pax`
                          : `Up to ${rec.pkg.paxIncluded} pax`}
                      </p>
                    </div>
                    <div className="border-l border-[var(--palette-gold)]/20 pl-2">
                      <p className="font-sans text-xs font-semibold text-[var(--palette-gold-ink)]">
                        {rec.pkg.downpaymentPercent}% Down
                      </p>
                      <p className="font-serif text-base font-bold text-[var(--palette-gold-ink)]">
                        {formatPhp(rec.downpaymentAmount)}
                      </p>
                      <p className="font-sans text-xs text-ink/60">Locks date</p>
                    </div>
                  </div>

                  {/* Top 3 Concise Inclusions */}
                  <ul className="mt-3 space-y-1 font-sans text-xs text-ink/80">
                    {rec.pkg.highlights.slice(0, 3).map((item) => (
                      <li key={item} className="flex items-start gap-1.5">
                        <Check
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--palette-gold-ink)]"
                          strokeWidth={2.5}
                          aria-hidden="true"
                        />
                        <span className="line-clamp-1">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Compact Select Action */}
                <div className="mt-3.5 pt-1">
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => onSelectPackage(rec.pkg.id)}
                    className={`flex min-h-10 w-full items-center justify-center gap-1.5 rounded-full border px-4 py-2 font-sans text-xs font-bold uppercase tracking-[0.14em] transition-all ${
                      isSelected
                        ? 'border-[var(--palette-booklet-cover)] bg-[var(--palette-booklet-cover)] text-[var(--text-on-action)] shadow-xs'
                        : isTopPick
                          ? 'border-[var(--palette-gold)] bg-[var(--palette-cream)] text-ink hover:bg-[var(--palette-booklet-cover)] hover:text-[var(--text-on-action)]'
                          : 'border-[var(--palette-gold)]/35 bg-[var(--palette-white)] text-ink hover:border-[var(--palette-booklet-cover)] hover:bg-[var(--palette-cream)]/60'
                    }`}
                  >
                    {isSelected ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Selected</span>
                      </>
                    ) : (
                      <>
                        <Award className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Select Package</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Compact Bottom Action Footer */}
      {selectedRec ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--palette-gold)]/30 bg-[var(--palette-cream)]/65 px-4 py-3.5 sm:px-5">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <span className="font-sans text-xs font-bold uppercase tracking-[0.14em] text-[var(--palette-gold-ink)]">
              Selected:
            </span>
            <span className="font-serif text-lg font-medium text-ink">{selectedRec.pkg.name}</span>
            <span className="font-sans text-xs text-ink/75">
              Total{' '}
              <strong className="font-semibold text-ink">
                {formatPhp(selectedRec.estimatedTotal)}
              </strong>{' '}
              · Downpayment{' '}
              <strong className="font-semibold text-[var(--palette-gold-ink)]">
                {formatPhp(selectedRec.downpaymentAmount)}
              </strong>
            </span>
          </div>

          <button
            type="button"
            onClick={onProceedToDownpayment}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--palette-booklet-cover)] bg-[var(--palette-booklet-cover)] px-6 py-2.5 font-sans text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-on-action)] shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[var(--palette-client-button-hover)] hover:shadow-md"
          >
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Proceed to Downpayment</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </section>
  );
}

interface DownpaymentViewProps {
  eventType: string;
  guestCount: number;
  eventDateLabel: string;
  selectedRecommendation: RecommendedPackage;
  downpayment: DownpaymentDetails;
  onChangeDownpayment: (updater: (prev: DownpaymentDetails) => DownpaymentDetails) => void;
  onBackToSuggestions: () => void;
  onSubmitDownpayment: () => void;
}

export function DownpaymentView({
  eventType,
  guestCount,
  eventDateLabel,
  selectedRecommendation,
  downpayment,
  onChangeDownpayment,
  onBackToSuggestions,
  onSubmitDownpayment,
}: DownpaymentViewProps) {
  const [copiedAccount, setCopiedAccount] = useState(false);
  const [formError, setFormError] = useState('');

  const activeChannel =
    PAYMENT_CHANNELS.find((channel) => channel.id === downpayment.method) ?? PAYMENT_CHANNELS[0];
  const isCashPayment = activeChannel.kind === 'cash';

  const handleCopyAccount = async () => {
    if (isCashPayment) return;
    try {
      await navigator.clipboard.writeText(activeChannel.accountNumber.replace(/\s+/g, ''));
      setCopiedAccount(true);
      window.setTimeout(() => setCopiedAccount(false), 2000);
    } catch {
      // Clipboard API unavailable; user can still select and copy manually.
    }
  };

  const handleConfirm = () => {
    if (downpayment.senderName.trim().length < 3) {
      setFormError(
        isCashPayment
          ? 'Please enter the client or payer name who handed the cash downpayment.'
          : 'Please enter the sender or account holder name used for the transfer.',
      );
      return;
    }
    const cleanRef = downpayment.referenceNumber.trim();
    const minRefLength = isCashPayment ? 4 : 6;
    if (cleanRef.length < minRefLength || !/^[a-zA-Z0-9\-_\s#]+$/.test(cleanRef)) {
      setFormError(
        isCashPayment
          ? 'Please enter the official receipt or acknowledgement number from Zion admin (at least 4 characters).'
          : 'Please enter a valid payment reference number (at least 6 characters).',
      );
      return;
    }
    if (!downpayment.agreedToTerms) {
      setFormError(
        isCashPayment
          ? 'Please confirm that you handed the cash downpayment directly to Zion admin.'
          : 'Please confirm that you have sent the downpayment to lock in your event date.',
      );
      return;
    }
    setFormError('');
    onSubmitDownpayment();
  };

  return (
    <section
      aria-labelledby="downpayment-heading"
      className="w-full space-y-4 rounded-[1.75rem] border border-[var(--palette-gold)]/30 bg-[var(--palette-paper)]/95 p-4 shadow-[0_24px_60px_-30px_color-mix(in_srgb,var(--palette-ink)_22%,transparent)] sm:p-5 lg:p-6"
    >
      {/* Modern Structured Downpayment Header & Lock Summary Strip */}
      <div className="space-y-3.5 border-b border-[var(--palette-gold)]/20 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--palette-booklet-cover)]/45 px-3 py-0.5 font-sans text-xs font-bold uppercase tracking-[0.14em] text-ink">
              <Lock className="h-3 w-3" aria-hidden="true" />
              Date Lock · {selectedRecommendation.pkg.downpaymentPercent}% Downpayment
            </span>
            <h2
              id="downpayment-heading"
              className="mt-1.5 font-serif text-2xl tracking-tight text-ink sm:text-3xl"
            >
              Secure {eventDateLabel} with Your Downpayment
            </h2>
          </div>

          <button
            type="button"
            onClick={onBackToSuggestions}
            className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border border-[var(--palette-gold)]/35 bg-[var(--palette-white)] px-4 py-2 font-sans text-xs font-semibold uppercase tracking-[0.14em] text-ink shadow-2xs transition-all hover:border-[var(--palette-gold-ink)] hover:bg-[var(--palette-cream)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Change Package</span>
          </button>
        </div>

        {/* Structured Date-Lock Summary Bar */}
        <div className="grid grid-cols-1 gap-2 rounded-2xl border border-[var(--palette-gold)]/20 bg-[var(--palette-cream)]/45 p-3 sm:grid-cols-3 sm:divide-x sm:divide-[var(--palette-gold)]/20 sm:gap-0">
          <div className="flex items-center gap-2.5 sm:px-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--palette-white)] text-[var(--palette-gold-ink)] shadow-2xs">
              <Award className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="font-sans text-xs text-ink/60">Selected Package</p>
              <p className="truncate font-sans text-xs font-semibold text-ink sm:text-sm">
                {selectedRecommendation.pkg.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 sm:px-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--palette-white)] text-[var(--palette-gold-ink)] shadow-2xs">
              <Calendar className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <p className="font-sans text-xs text-ink/60">Exclusive Date</p>
              <p className="font-sans text-xs font-semibold text-ink sm:text-sm">
                {eventDateLabel} · {guestCount} pax
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 sm:px-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--palette-booklet-cover)]/45 text-ink shadow-2xs">
              <Wallet className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <p className="font-sans text-xs text-ink/60">
                Required Downpayment ({selectedRecommendation.pkg.downpaymentPercent}%)
              </p>
              <p className="font-serif text-sm font-bold text-[var(--palette-gold-ink)] sm:text-base">
                {formatPhp(selectedRecommendation.downpaymentAmount)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-start">
        {/* Left: Compact Payment Method & Transfer Proof Form */}
        <div className="space-y-4 lg:col-span-8">
          {/* 1. Payment Channel Selector — Single Row on Desktop */}
          <div>
            <p className="mb-2 font-sans text-xs font-bold uppercase tracking-[0.14em] text-[var(--palette-gold-ink)]">
              1. Payment Channel
            </p>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {PAYMENT_CHANNELS.map((channel) => {
                const active = downpayment.method === channel.id;
                return (
                  <button
                    key={channel.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      onChangeDownpayment((prev) => ({ ...prev, method: channel.id }));
                      setFormError('');
                    }}
                    className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left transition-all ${
                      active
                        ? 'border-[var(--palette-booklet-cover)] bg-[var(--palette-cream)]/85 shadow-xs ring-1 ring-[var(--palette-booklet-cover)]/60'
                        : 'border-[var(--palette-gold)]/25 bg-[var(--palette-white)] hover:border-[var(--palette-booklet-cover)]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {channel.kind === 'cash' ? (
                        <Banknote
                          className="h-4 w-4 shrink-0 text-[var(--palette-gold-ink)]"
                          aria-hidden="true"
                        />
                      ) : channel.kind === 'bank' ? (
                        <Building2
                          className="h-4 w-4 shrink-0 text-[var(--palette-gold-ink)]"
                          aria-hidden="true"
                        />
                      ) : (
                        <CreditCard
                          className="h-4 w-4 shrink-0 text-[var(--palette-gold-ink)]"
                          aria-hidden="true"
                        />
                      )}
                      <span className="font-sans text-xs font-bold text-ink">{channel.label}</span>
                    </div>
                    {active ? (
                      <Check
                        className="h-3.5 w-3.5 shrink-0 text-[var(--palette-gold-ink)]"
                        strokeWidth={2.6}
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Official Account / On-Hand Cash Details — Single Compact Row */}
          <div className="rounded-2xl border border-[var(--palette-gold)]/30 bg-[var(--palette-cream)]/55 p-3.5">
            <p className="mb-2.5 font-sans text-xs font-bold uppercase tracking-[0.14em] text-[var(--palette-gold-ink)]">
              {isCashPayment
                ? '2. On-Hand Cash Downpayment (Zion Admin)'
                : '2. Send Downpayment to Official Account'}
            </p>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <div className="rounded-xl border border-[var(--palette-gold)]/20 bg-[var(--palette-white)] px-3 py-2.5">
                <p className="font-sans text-xs text-ink/60">
                  {isCashPayment ? 'Received By' : 'Account Name'}
                </p>
                <p className="mt-0.5 font-sans text-xs font-semibold text-ink sm:text-sm">
                  {activeChannel.accountName}
                </p>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-xl border border-[var(--palette-gold)]/20 bg-[var(--palette-white)] px-3 py-2.5">
                <div>
                  <p className="font-sans text-xs text-ink/60">
                    {isCashPayment ? 'Payment Mode' : `${activeChannel.label} No.`}
                  </p>
                  <p className="mt-0.5 font-sans text-xs font-semibold tracking-wide text-ink sm:text-sm">
                    {activeChannel.accountNumber}
                  </p>
                </div>
                {!isCashPayment ? (
                  <button
                    type="button"
                    onClick={handleCopyAccount}
                    className="inline-flex items-center gap-1 rounded-full border border-[var(--palette-gold)]/30 bg-[var(--palette-cream)]/70 px-2.5 py-1 font-sans text-xs font-semibold text-ink transition-colors hover:bg-[var(--palette-booklet-cover)]/50"
                  >
                    {copiedAccount ? (
                      <>
                        <Check className="h-3 w-3 text-[var(--palette-success)]" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                ) : null}
              </div>
              <div className="rounded-xl border border-[var(--palette-booklet-cover)]/60 bg-[var(--palette-booklet-cover)]/25 px-3 py-2.5">
                <p className="font-sans text-xs text-ink/70">
                  {isCashPayment ? 'Cash Downpayment' : 'Amount Due Now'}
                </p>
                <p className="mt-0.5 font-serif text-base font-bold text-ink">
                  {formatPhp(selectedRecommendation.downpaymentAmount)}
                </p>
              </div>
            </div>
          </div>

          {/* 3. Payment / Receipt Verification Details — Single Compact 3-Column Row */}
          <div className="space-y-3">
            <p className="font-sans text-xs font-bold uppercase tracking-[0.14em] text-[var(--palette-gold-ink)]">
              {isCashPayment
                ? '3. Cash Receipt Verification Details'
                : '3. Transfer Verification Details'}
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label
                  htmlFor="downpayment-sender-name"
                  className="mb-1 block font-sans text-xs font-bold uppercase tracking-[0.12em] text-ink/75"
                >
                  {isCashPayment ? 'Payer Name' : 'Sender Name'}{' '}
                  <span className="text-[var(--palette-danger)]">*</span>
                </label>
                <input
                  id="downpayment-sender-name"
                  type="text"
                  required
                  value={downpayment.senderName}
                  onChange={(event) => {
                    onChangeDownpayment((prev) => ({ ...prev, senderName: event.target.value }));
                    setFormError('');
                  }}
                  placeholder={isCashPayment ? 'Client / payer full name' : 'Account holder name'}
                  className="w-full rounded-xl border border-[var(--palette-gold)]/30 bg-[var(--palette-white)] px-3.5 py-2.5 font-sans text-sm text-ink placeholder:text-ink/40 focus:border-[var(--palette-gold-ink)] focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="downpayment-ref-number"
                  className="mb-1 block font-sans text-xs font-bold uppercase tracking-[0.12em] text-ink/75"
                >
                  {isCashPayment ? 'Official Receipt No.' : 'Reference No.'}{' '}
                  <span className="text-[var(--palette-danger)]">*</span>
                </label>
                <input
                  id="downpayment-ref-number"
                  type="text"
                  required
                  value={downpayment.referenceNumber}
                  onChange={(event) => {
                    onChangeDownpayment((prev) => ({
                      ...prev,
                      referenceNumber: event.target.value,
                    }));
                    setFormError('');
                  }}
                  placeholder={isCashPayment ? 'e.g., OR-2026-0412' : 'e.g., 901234567890'}
                  className="w-full rounded-xl border border-[var(--palette-gold)]/30 bg-[var(--palette-white)] px-3.5 py-2.5 font-sans text-sm text-ink placeholder:text-ink/40 focus:border-[var(--palette-gold-ink)] focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="downpayment-receipt"
                  className="mb-1 block font-sans text-xs font-bold uppercase tracking-[0.12em] text-ink/75"
                >
                  {isCashPayment ? 'Signed Receipt' : 'Receipt'}{' '}
                  <span className="font-normal text-ink/50">(Optional)</span>
                </label>
                <label
                  htmlFor="downpayment-receipt"
                  className="flex min-h-[2.625rem] cursor-pointer items-center justify-between gap-2 rounded-xl border border-dashed border-[var(--palette-gold)]/45 bg-[var(--palette-white)] px-3 py-2 transition-colors hover:border-[var(--palette-gold-ink)] hover:bg-[var(--palette-cream)]/35"
                >
                  <span className="flex min-w-0 items-center gap-2 font-sans text-xs text-ink/80">
                    <Upload
                      className="h-3.5 w-3.5 shrink-0 text-[var(--palette-gold-ink)]"
                      aria-hidden="true"
                    />
                    <span className="truncate">{downpayment.receiptFileName || 'Attach file'}</span>
                  </span>
                  <span className="shrink-0 rounded-full border border-[var(--palette-gold)]/30 px-2 py-0.5 font-sans text-xs font-semibold text-ink">
                    Browse
                  </span>
                  <input
                    id="downpayment-receipt"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,application/pdf"
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      onChangeDownpayment((prev) => ({
                        ...prev,
                        receiptFileName: file ? file.name : '',
                      }));
                    }}
                  />
                </label>
              </div>
            </div>

            {/* Compact Confirmation & Submit Row */}
            <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-[var(--palette-gold)]/25 bg-[var(--palette-cream)]/35 px-3.5 py-3 font-sans text-xs leading-relaxed text-ink/85">
              <input
                type="checkbox"
                checked={downpayment.agreedToTerms}
                onChange={(event) => {
                  onChangeDownpayment((prev) => ({ ...prev, agreedToTerms: event.target.checked }));
                  setFormError('');
                }}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--palette-gold-ink)]"
              />
              <span>
                {isCashPayment ? (
                  <>
                    I confirm that I handed the{' '}
                    <strong className="text-ink">
                      {formatPhp(selectedRecommendation.downpaymentAmount)}
                    </strong>{' '}
                    cash downpayment directly to the Zion Events Place admin to secure{' '}
                    <strong className="text-ink">{eventDateLabel}</strong>, subject to admin
                    verification.
                  </>
                ) : (
                  <>
                    I confirm that I have sent the{' '}
                    <strong className="text-ink">
                      {formatPhp(selectedRecommendation.downpaymentAmount)}
                    </strong>{' '}
                    downpayment to secure <strong className="text-ink">{eventDateLabel}</strong> at
                    Zion Events Place, subject to verification.
                  </>
                )}
              </span>
            </label>

            {formError ? (
              <div
                role="alert"
                className="flex items-center gap-2 rounded-xl border border-[var(--palette-danger)]/35 bg-[var(--palette-danger-soft)] px-3.5 py-2.5 font-sans text-xs font-medium text-[var(--palette-danger)]"
              >
                <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{formError}</span>
              </div>
            ) : null}

            <button
              type="button"
              onClick={handleConfirm}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-[var(--palette-booklet-cover)] bg-[var(--palette-booklet-cover)] px-6 py-2.5 font-sans text-xs font-bold uppercase tracking-[0.16em] text-[var(--text-on-action)] shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[var(--palette-client-button-hover)] hover:shadow-md"
            >
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              <span>Submit Downpayment &amp; Secure Date</span>
            </button>
          </div>
        </div>

        {/* Right: Fixed-Position Reservation & Payment Breakdown Card */}
        <aside className="rounded-2xl border border-[var(--palette-gold)]/25 bg-[var(--palette-cream)]/40 p-4 lg:col-span-4">
          <div className="relative h-28 w-full overflow-hidden rounded-xl bg-[var(--palette-cream)]">
            <Image
              src={selectedRecommendation.pkg.imageSrc}
              alt={selectedRecommendation.pkg.imageAlt}
              fill
              sizes="(max-width: 1023px) 100vw, 360px"
              className="object-cover"
            />
            {selectedRecommendation.badge ? (
              <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-[var(--palette-booklet-cover)] px-2.5 py-0.5 font-sans text-xs font-bold uppercase tracking-[0.1em] text-[var(--text-on-action)] shadow-xs">
                {selectedRecommendation.badge}
              </span>
            ) : null}
          </div>

          <h3 className="mt-3 font-serif text-xl font-medium text-ink">
            {selectedRecommendation.pkg.name}
          </h3>
          <p className="mt-0.5 font-sans text-xs text-ink/70">
            {eventType} · {guestCount} pax · {eventDateLabel}
          </p>

          <dl className="mt-3.5 space-y-2 border-t border-[var(--palette-gold)]/20 pt-3 font-sans text-xs sm:text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-ink/70">
                Package Base ({selectedRecommendation.pkg.paxIncluded} pax)
              </dt>
              <dd className="font-semibold text-ink">
                {formatPhp(selectedRecommendation.pkg.price)}
              </dd>
            </div>
            {selectedRecommendation.excessGuests > 0 ? (
              <div className="flex justify-between gap-2">
                <dt className="text-ink/70">
                  Excess Guests ({selectedRecommendation.excessGuests} pax)
                </dt>
                <dd className="font-semibold text-ink">
                  {formatPhp(
                    selectedRecommendation.excessGuests * selectedRecommendation.pkg.excessPaxFee,
                  )}
                </dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-2 border-t border-[var(--palette-gold)]/15 pt-2">
              <dt className="font-semibold text-ink">Estimated Total</dt>
              <dd className="font-bold text-ink">
                {formatPhp(selectedRecommendation.estimatedTotal)}
              </dd>
            </div>
            <div className="flex justify-between gap-2 rounded-xl bg-[var(--palette-booklet-cover)]/35 px-3 py-2">
              <dt className="font-bold text-ink">
                Downpayment ({selectedRecommendation.pkg.downpaymentPercent}%)
              </dt>
              <dd className="font-serif text-base font-bold text-ink">
                {formatPhp(selectedRecommendation.downpaymentAmount)}
              </dd>
            </div>
            <div className="flex justify-between gap-2 text-xs text-ink/70">
              <dt>Remaining Balance</dt>
              <dd className="font-semibold text-ink">
                {formatPhp(selectedRecommendation.remainingBalance)}
              </dd>
            </div>
          </dl>
        </aside>
      </div>
    </section>
  );
}
