'use client';

import { useId, type ReactNode } from 'react';
import { CalendarDays, Minus, Plus } from 'lucide-react';
import { ButtonLink } from '@/components/shared/Button';
import { BOOKING_REQUEST_RULES } from '@/config/booking';
import {
  bookableGuests,
  estimateBreakdown,
  formatPeso,
  nextStepLinks,
  typedGuests,
  type PackageFamily,
} from '@/lib/event-packages';
import styles from './EventPackages.module.css';

const GUEST_STEP = 10;

/**
 * The selected package's estimate for a guest count (lib/event-packages.ts, the booking page's
 * pricing), with the next steps. Shown in the desktop card and in the phones' bottom sheet.
 */
export default function BookingEstimate({
  family,
  bookingEvent,
  guestsText,
  onGuestsText,
  title,
}: {
  family: PackageFamily;
  bookingEvent: string;
  guestsText: string;
  onGuestsText: (value: string) => void;
  /** The card's or sheet's heading. */
  title: ReactNode;
}) {
  const fieldId = useId();
  const guests = typedGuests(guestsText);
  const shown = guests ?? bookableGuests(Number(guestsText) || family.tiers[0].paxIncluded);
  const { estimate, booking, visit } = nextStepLinks(bookingEvent, family, shown);
  const step = (delta: number) => onGuestsText(String(bookableGuests(shown + delta)));

  return (
    <>
      {title}
      <p className={styles.cardPackage}>{family.name}</p>
      <div className={styles.field}>
        <label htmlFor={fieldId} className={styles.fieldLabel}>
          Number of guests
        </label>
        <div className={styles.stepper}>
          <button
            type="button"
            aria-label={`${GUEST_STEP} fewer guests`}
            disabled={shown <= BOOKING_REQUEST_RULES.minGuests}
            onClick={() => step(-GUEST_STEP)}
          >
            <Minus size={18} aria-hidden="true" />
          </button>
          <input
            id={fieldId}
            type="number"
            inputMode="numeric"
            min={BOOKING_REQUEST_RULES.minGuests}
            max={BOOKING_REQUEST_RULES.maxGuests}
            step={1}
            value={guestsText}
            aria-invalid={guests === null ? true : undefined}
            aria-describedby={`${fieldId}-hint`}
            onChange={(event) => onGuestsText(event.target.value)}
            onBlur={() => onGuestsText(String(shown))}
          />
          <button
            type="button"
            aria-label={`${GUEST_STEP} more guests`}
            disabled={shown >= BOOKING_REQUEST_RULES.maxGuests}
            onClick={() => step(GUEST_STEP)}
          >
            <Plus size={18} aria-hidden="true" />
          </button>
        </div>
        {guests === null ? (
          <p id={`${fieldId}-hint`} className={styles.fieldError} role="alert">
            Enter {BOOKING_REQUEST_RULES.minGuests} to {BOOKING_REQUEST_RULES.maxGuests} guests. The
            estimate shows {shown} guests.
          </p>
        ) : (
          <p id={`${fieldId}-hint`} className={styles.fieldHint}>
            {BOOKING_REQUEST_RULES.minGuests} to {BOOKING_REQUEST_RULES.maxGuests} guests.
          </p>
        )}
      </div>
      <div className={styles.estimate} aria-live="polite" aria-atomic="true">
        <p className={styles.total}>
          <span className="sr-only">Estimated price: </span>
          {formatPeso(estimate.totalCents / 100)}
        </p>
        <p className={styles.breakdown}>{estimateBreakdown(estimate)}</p>
        <p className={styles.disclaimer}>
          Estimate only. Your final price is confirmed when you book.
        </p>
      </div>
      <div className={styles.actions}>
        <ButtonLink
          href={booking}
          variant="primary"
          size="lg"
          block
          icon={<CalendarDays aria-hidden="true" />}
        >
          Check dates
        </ButtonLink>
        <ButtonLink href={visit} variant="secondary" size="lg" block>
          Schedule an ocular visit
        </ButtonLink>
      </div>
    </>
  );
}
