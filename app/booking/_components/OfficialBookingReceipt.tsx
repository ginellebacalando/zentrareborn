'use client';

import Image from 'next/image';
import Link from 'next/link';
import { AlertCircle, CheckCircle2, Printer, RotateCcw, Send, ShieldCheck } from 'lucide-react';
import { useMemo } from 'react';

import styles from './BookingJourney.module.css';
import type { DownpaymentDetails } from './BookingPostReviewFlow';
import { formatPhp, type RecommendedPackage } from './packageRecommendations';
import { printOfficialReceipt } from './printOfficialReceipt';

import { BRAND } from '@/config/brand';

interface OfficialBookingReceiptProps {
  bookingRef: string;
  eventType: string;
  packageTier: string;
  guestCount: number;
  eventDateLabel: string;
  budgetRange: string;
  addOns: readonly string[];
  fullName: string;
  email: string;
  countryCode: string;
  phoneNumber: string;
  facebookAccount: string;
  notes: string;
  selectedRecommendation: RecommendedPackage | null;
  downpayment: DownpaymentDetails;
  isSendingInquiry: boolean;
  inquiryFeedback: { type: 'success' | 'error'; text: string } | null;
  onSendToZion: () => void;
  onResetJourney: () => void;
}

export default function OfficialBookingReceipt({
  bookingRef,
  eventType,
  packageTier,
  guestCount,
  eventDateLabel,
  budgetRange,
  addOns,
  fullName,
  email,
  countryCode,
  phoneNumber,
  facebookAccount,
  notes,
  selectedRecommendation,
  downpayment,
  isSendingInquiry,
  inquiryFeedback,
  onSendToZion,
  onResetJourney,
}: OfficialBookingReceiptProps) {
  const issuedAtLabel = useMemo(() => {
    return new Intl.DateTimeFormat('en-PH', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date());
  }, []);

  const isCashPayment = downpayment.method === 'On-Hand Cash';

  const handlePrintPdfReceipt = () => {
    printOfficialReceipt({
      bookingRef,
      issuedAtLabel,
      eventType,
      packageTier,
      guestCount,
      eventDateLabel,
      budgetRange,
      addOns,
      fullName,
      email,
      countryCode,
      phoneNumber,
      facebookAccount,
      notes,
      selectedRecommendation,
      downpayment,
    });
  };

  const excessTotal = selectedRecommendation
    ? selectedRecommendation.excessGuests * selectedRecommendation.pkg.excessPaxFee
    : 0;

  return (
    <section
      data-zion-receipt="true"
      aria-labelledby="booking-summary-heading"
      className={`${styles.summaryEnter} ${styles.receiptSheet} mx-auto max-w-5xl overflow-hidden rounded-[1.75rem] border border-[var(--palette-gold)]/40 bg-[var(--palette-white)] shadow-[0_28px_70px_-30px_color-mix(in_srgb,var(--palette-ink)_25%,transparent)]`}
    >
      {/* Top Gold Accent Bar */}
      <div
        aria-hidden="true"
        className="h-2 w-full bg-gradient-to-r from-[var(--palette-gold)] via-[var(--palette-booklet-cover)] to-[var(--palette-gold)]"
      />

      {/* Editorial Receipt Masthead Band — Matches PDF Receipt Layout */}
      <div className="border-b border-[var(--palette-gold)]/25 bg-[var(--palette-paper)] px-6 py-6 sm:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <div className="relative h-14 w-20 shrink-0 sm:h-16 sm:w-24">
              <Image
                src={BRAND.logo.src}
                alt={BRAND.logo.alt}
                fill
                sizes="96px"
                className="object-contain mix-blend-multiply"
              />
            </div>
            <div className="min-w-0">
              <p className="font-sans text-xs font-bold uppercase tracking-[0.18em] text-[var(--palette-gold-ink)]">
                Official Booking &amp; Downpayment Receipt
              </p>
              <h2
                id="booking-summary-heading"
                className="mt-0.5 font-serif text-2xl font-semibold tracking-tight text-ink sm:text-3xl"
              >
                {BRAND.legalName}
              </h2>
              <p className="mt-0.5 font-sans text-xs text-ink/65">
                {BRAND.address.lines.join(', ')}
              </p>
              <p className="font-sans text-xs text-ink/65">
                {BRAND.contact.email} · {BRAND.contact.phone}
              </p>
            </div>
          </div>

          <div className="shrink-0 rounded-2xl border border-[var(--palette-gold)]/25 bg-[var(--palette-white)] px-4 py-3 text-left shadow-2xs md:min-w-56 md:text-right">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--palette-booklet-cover)] bg-[var(--palette-booklet-cover)]/45 px-3 py-0.5 font-sans text-xs font-bold uppercase tracking-[0.12em] text-ink">
              <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.3} aria-hidden="true" />
              Downpayment Submitted
            </span>
            <p className="mt-2 font-mono text-sm font-bold tracking-wider text-ink">{bookingRef}</p>
            <p className="mt-0.5 font-sans text-xs text-ink/60">Issued: {issuedAtLabel}</p>
          </div>
        </div>
      </div>

      <div className="p-6 sm:p-8">
        {/* Client & Event Reservation Details Grid */}
        <div className="grid grid-cols-1 gap-5 border-b border-dashed border-[var(--palette-gold)]/35 pb-6 md:grid-cols-2">
          {/* Billed To / Client Details */}
          <div className="rounded-2xl border border-[var(--palette-gold)]/20 bg-[var(--palette-paper)]/75 p-4">
            <h3 className="font-sans text-xs font-bold uppercase tracking-[0.16em] text-[var(--palette-gold-ink)]">
              Client Details
            </h3>
            <dl className="mt-3 space-y-2 font-sans text-xs sm:text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-ink/60">Client Name</dt>
                <dd className="text-right font-semibold text-ink">{fullName}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink/60">Email</dt>
                <dd className="break-all text-right font-medium text-ink">{email}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink/60">Mobile</dt>
                <dd className="text-right font-medium text-ink">
                  {countryCode} {phoneNumber}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink/60">Facebook</dt>
                <dd className="break-all text-right font-medium text-ink">{facebookAccount}</dd>
              </div>
            </dl>
          </div>

          {/* Event Reservation Details */}
          <div className="rounded-2xl border border-[var(--palette-gold)]/20 bg-[var(--palette-paper)]/75 p-4">
            <h3 className="font-sans text-xs font-bold uppercase tracking-[0.16em] text-[var(--palette-gold-ink)]">
              Event Reservation
            </h3>
            <dl className="mt-3 space-y-2 font-sans text-xs sm:text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-ink/60">Celebration</dt>
                <dd className="text-right font-semibold text-ink">{eventType}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink/60">Secured Date</dt>
                <dd className="text-right font-semibold text-ink">{eventDateLabel}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink/60">Estimated Guests</dt>
                <dd className="text-right font-medium text-ink">{guestCount} pax (Full Day)</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink/60">Budget Range</dt>
                <dd className="text-right font-medium text-ink">{budgetRange}</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Itemized Receipt Table */}
        <div className="mt-6">
          <h3 className="mb-3 font-sans text-xs font-bold uppercase tracking-[0.16em] text-[var(--palette-gold-ink)]">
            Itemized Package &amp; Payment Summary
          </h3>

          <div className="overflow-hidden rounded-2xl border border-[var(--palette-gold)]/25">
            <table className="w-full border-collapse text-left font-sans text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-[var(--palette-gold)]/20 bg-[var(--palette-cream)]/65 text-xs uppercase tracking-[0.12em] text-ink/75">
                  <th scope="col" className="px-4 py-3 font-bold">
                    Description
                  </th>
                  <th scope="col" className="px-4 py-3 font-bold">
                    Details
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-bold">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--palette-gold)]/15 bg-[var(--palette-white)]">
                <tr>
                  <td className="px-4 py-3 font-semibold text-ink">
                    {selectedRecommendation?.pkg.name ?? packageTier}
                  </td>
                  <td className="px-4 py-3 text-ink/70">
                    {selectedRecommendation
                      ? `${selectedRecommendation.pkg.style} · Base ${selectedRecommendation.pkg.paxIncluded} pax`
                      : 'Selected package style'}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-ink">
                    {selectedRecommendation ? formatPhp(selectedRecommendation.pkg.price) : '—'}
                  </td>
                </tr>

                {selectedRecommendation && selectedRecommendation.excessGuests > 0 ? (
                  <tr>
                    <td className="px-4 py-3 font-medium text-ink">Additional Guests</td>
                    <td className="px-4 py-3 text-ink/70">
                      {selectedRecommendation.excessGuests} pax ×{' '}
                      {formatPhp(selectedRecommendation.pkg.excessPaxFee)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-ink">
                      {formatPhp(excessTotal)}
                    </td>
                  </tr>
                ) : null}

                {addOns.length > 0 ? (
                  <tr>
                    <td className="px-4 py-3 font-medium text-ink">Curated Add-Ons</td>
                    <td className="px-4 py-3 text-ink/70">{addOns.join(', ')}</td>
                    <td className="px-4 py-3 text-right font-medium text-ink/70">
                      Included / Quoted
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>

            {/* Receipt Totals Footer */}
            {selectedRecommendation ? (
              <div className="border-t border-[var(--palette-gold)]/25 bg-[var(--palette-paper)]/70 px-4 py-4">
                <div className="ml-auto max-w-sm space-y-2 font-sans text-xs sm:text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-ink/70">Estimated Package Total</span>
                    <span className="font-semibold text-ink">
                      {formatPhp(selectedRecommendation.estimatedTotal)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4 rounded-xl bg-[var(--palette-booklet-cover)]/40 px-3 py-2">
                    <span className="font-bold text-ink">
                      Downpayment Paid ({selectedRecommendation.pkg.downpaymentPercent}%)
                    </span>
                    <span className="font-serif text-base font-bold text-ink">
                      - {formatPhp(selectedRecommendation.downpaymentAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4 border-t border-[var(--palette-gold)]/25 pt-2">
                    <span className="font-bold text-ink">Remaining Balance</span>
                    <span className="font-serif text-lg font-bold text-ink">
                      {formatPhp(selectedRecommendation.remainingBalance)}
                    </span>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Downpayment & Transaction Proof Strip */}
        <div className="mt-6 rounded-2xl border border-[var(--palette-gold)]/25 bg-[var(--palette-cream)]/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--palette-gold)]/15 pb-2.5">
            <h3 className="font-sans text-xs font-bold uppercase tracking-[0.16em] text-[var(--palette-gold-ink)]">
              Downpayment &amp; Payment Verification
            </h3>
            <span className="inline-flex items-center gap-1 font-sans text-xs font-semibold text-ink/75">
              <ShieldCheck className="h-3.5 w-3.5 text-[var(--palette-gold-ink)]" />
              Pending Admin Verification
            </span>
          </div>
          <dl className="mt-3 grid grid-cols-1 gap-3 font-sans text-xs sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-ink/60">Payment Channel</dt>
              <dd className="mt-0.5 font-semibold text-ink">{downpayment.method}</dd>
            </div>
            <div>
              <dt className="text-ink/60">{isCashPayment ? 'Payer Name' : 'Sender Name'}</dt>
              <dd className="mt-0.5 font-semibold text-ink">{downpayment.senderName}</dd>
            </div>
            <div>
              <dt className="text-ink/60">
                {isCashPayment ? 'Official Receipt No.' : 'Reference No.'}
              </dt>
              <dd className="mt-0.5 font-mono font-semibold text-ink">
                {downpayment.referenceNumber}
              </dd>
            </div>
            <div>
              <dt className="text-ink/60">Attached Proof</dt>
              <dd className="mt-0.5 truncate font-medium text-ink">
                {downpayment.receiptFileName || 'None attached'}
              </dd>
            </div>
          </dl>
        </div>

        {/* Optional Notes */}
        {notes.trim() ? (
          <div className="mt-5 rounded-2xl border border-[var(--palette-gold)]/20 bg-[var(--palette-paper)]/60 p-4">
            <p className="font-sans text-xs font-bold uppercase tracking-[0.14em] text-[var(--palette-gold-ink)]">
              Special Requests &amp; Styling Notes
            </p>
            <p className="mt-1 font-sans text-xs leading-relaxed text-ink sm:text-sm">
              {notes.trim()}
            </p>
          </div>
        ) : null}

        {/* Official Receipt Footer / Fine Print */}
        <div className="mt-6 flex flex-wrap items-end justify-between gap-4 border-t border-dashed border-[var(--palette-gold)]/35 pt-4 font-sans text-xs text-ink/65">
          <p className="max-w-xl leading-relaxed">
            This official summary receipt records your submitted event reservation and downpayment
            for {BRAND.legalName}. Your exclusive date lock is finalized once our administration
            team verifies your payment reference.
          </p>
          <div className="text-left sm:text-right">
            <p className="font-semibold text-ink">{BRAND.legalName} · Booking Desk</p>
            <p className="font-mono text-xs text-ink/60">{bookingRef}</p>
          </div>
        </div>

        {/* Submission Feedback (Hidden in PDF Print) */}
        {inquiryFeedback ? (
          <div
            data-booking-no-print="true"
            role={inquiryFeedback.type === 'error' ? 'alert' : 'status'}
            className={`mt-6 flex items-center gap-2.5 rounded-2xl border px-4 py-3.5 font-sans text-sm ${
              inquiryFeedback.type === 'success'
                ? 'border-[var(--palette-success)]/30 bg-[var(--palette-success-soft)] text-[var(--palette-success)]'
                : 'border-[var(--palette-danger)]/30 bg-[var(--palette-danger-soft)] text-[var(--palette-danger)]'
            }`}
          >
            {inquiryFeedback.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            <span>{inquiryFeedback.text}</span>
          </div>
        ) : null}

        {/* Interactive Action Footer (Hidden in PDF Print) */}
        <div
          data-booking-no-print="true"
          className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--palette-gold)]/20 pt-6"
        >
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={isSendingInquiry || inquiryFeedback?.type === 'success'}
              onClick={onSendToZion}
              className="inline-flex min-h-12 items-center gap-2 rounded-full border border-[var(--palette-booklet-cover)] bg-[var(--palette-booklet-cover)] px-6 py-3 font-sans text-xs font-bold uppercase tracking-[0.16em] text-ink shadow-sm transition-all hover:bg-[var(--palette-client-button-hover)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              <span>
                {isSendingInquiry
                  ? 'Submitting Booking…'
                  : inquiryFeedback?.type === 'success'
                    ? 'Booking Submitted to Zion'
                    : 'Confirm & Submit Booking'}
              </span>
            </button>

            <button
              type="button"
              onClick={handlePrintPdfReceipt}
              className="inline-flex min-h-12 items-center gap-2 rounded-full border border-[var(--palette-gold)]/45 bg-[var(--palette-cream)]/70 px-5 py-2.5 font-sans text-xs font-bold uppercase tracking-[0.14em] text-ink transition-colors hover:bg-[var(--palette-booklet-cover)]/50"
            >
              <Printer className="h-4 w-4" aria-hidden="true" />
              <span>Print / Save PDF Receipt</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/contact"
              className="inline-flex min-h-12 items-center rounded-full border border-[var(--palette-gold)]/30 px-5 py-2.5 font-sans text-xs font-semibold uppercase tracking-[0.14em] text-ink transition-colors hover:bg-[var(--palette-cream)]"
            >
              Contact Us
            </Link>
            <button
              type="button"
              onClick={onResetJourney}
              className="inline-flex min-h-12 items-center gap-1.5 rounded-full border border-[var(--palette-gold)]/30 px-5 py-2.5 font-sans text-xs font-semibold uppercase tracking-[0.14em] text-ink transition-colors hover:bg-[var(--palette-cream)]"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Start New Booking</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
