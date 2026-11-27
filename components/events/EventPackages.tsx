'use client';

import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { ButtonLink, IconButton } from '@/components/shared/Button';
import { buttonClassName } from '@/components/shared/button-classes';
import { useModalDialog } from '@/components/shared/useModalDialog';
import {
  bookableGuests,
  formatPeso,
  nextStepLinks,
  typedGuests,
  type PackageFamily,
} from '@/lib/event-packages';
import BookingEstimate from './BookingEstimate';
import PackageCompare from './PackageCompare';
import PackageDetails from './PackageDetails';
import styles from './EventPackages.module.css';

/**
 * An event's packages (docs/event-pages.md): a tab per package with its rates and inclusions,
 * "Compare packages", and the booking estimate beside them (a bar fixed at the bottom on phones
 * and tablets, whose sheet holds the same estimate). Every panel is in the page, so its text
 * reaches search engines and readers without script; inactive ones are hidden.
 */
export default function EventPackages({
  families,
  bookingEvent,
  eventLabel,
}: {
  families: readonly PackageFamily[];
  /** The booking page's event key (wedding, debut, …). */
  bookingEvent: string;
  /** "Debut", for names such as "Debut packages". */
  eventLabel: string;
}) {
  const baseId = useId();
  const [selected, setSelected] = useState(0);
  const [guestsText, setGuestsText] = useState(String(families[0].tiers[0].paxIncluded));
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const sheetRef = useRef<HTMLDialogElement>(null);
  useModalDialog(sheetRef);
  const family = families[selected];
  const guests = typedGuests(guestsText) ?? bookableGuests(Number(guestsText));
  const { estimate, booking } = nextStepLinks(bookingEvent, family, guests);

  function choose(index: number, focus = false) {
    setSelected(index);
    if (focus) tabs.current[index]?.focus();
  }

  function onTabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = families.length - 1;
    const next: Record<string, number> = {
      ArrowRight: index === last ? 0 : index + 1,
      ArrowLeft: index === 0 ? last : index - 1,
      Home: 0,
      End: last,
    };
    if (!(event.key in next)) return;
    event.preventDefault();
    choose(next[event.key], true);
  }

  const estimateProps = { family, bookingEvent, guestsText, onGuestsText: setGuestsText };

  return (
    <section id="packages" className={styles.section} aria-label={`${eventLabel} packages`}>
      <div className={styles.layout}>
        <div>
          <div className={styles.toolbar}>
            <div className={styles.tabs} role="tablist" aria-label={`${eventLabel} packages`}>
              {families.map((item, index) => (
                <button
                  key={item.key}
                  ref={(element) => {
                    tabs.current[index] = element;
                  }}
                  type="button"
                  role="tab"
                  id={`${baseId}-tab-${index}`}
                  // The shared button look and the large 48px size, like every other button here.
                  className={buttonClassName(
                    { variant: index === selected ? 'primary' : 'secondary', size: 'lg' },
                    styles.tab,
                  )}
                  aria-selected={index === selected}
                  aria-controls={`${baseId}-panel-${index}`}
                  tabIndex={index === selected ? 0 : -1}
                  onClick={() => choose(index)}
                  onKeyDown={(event) => onTabKey(event, index)}
                >
                  <span className={styles.tabName}>{item.name}</span>
                  <span className={styles.tabPrice}>From {formatPeso(item.tiers[0].price)}</span>
                </button>
              ))}
            </div>
            {families.length > 1 ? (
              <div className={styles.compare}>
                <PackageCompare families={families} />
              </div>
            ) : null}
          </div>
          {families.map((item, index) => (
            <div
              key={item.key}
              id={`${baseId}-panel-${index}`}
              role="tabpanel"
              aria-labelledby={`${baseId}-tab-${index}`}
              className={index === selected ? styles.panel : undefined}
              hidden={index !== selected}
            >
              <PackageDetails family={item} />
            </div>
          ))}
        </div>
        <aside className={styles.aside} aria-labelledby={`${baseId}-estimate`}>
          <div className={styles.card}>
            <BookingEstimate
              {...estimateProps}
              title={
                <h2 id={`${baseId}-estimate`} className={styles.cardTitle}>
                  Estimate your price
                </h2>
              }
            />
          </div>
        </aside>
      </div>

      <div className={styles.bar} data-booking-bar>
        <button
          type="button"
          className={styles.barSummary}
          aria-haspopup="dialog"
          aria-label={`Estimated price for ${family.name}, ${guests} guests: ${formatPeso(estimate.totalCents / 100)}. Change the guest count`}
          onClick={() => sheetRef.current?.showModal()}
        >
          <span className={styles.barTotal}>{formatPeso(estimate.totalCents / 100)}</span>
          <span className={styles.barMeta}>{guests} guests · Change</span>
        </button>
        <ButtonLink href={booking} variant="primary" size="lg">
          Check dates
        </ButtonLink>
      </div>
      <dialog ref={sheetRef} className={styles.sheet} aria-labelledby={`${baseId}-sheet`}>
        <div className={styles.sheetBody}>
          <BookingEstimate
            {...estimateProps}
            title={
              <div className={styles.sheetHeader}>
                <h2 id={`${baseId}-sheet`} className={styles.cardTitle}>
                  Estimate your price
                </h2>
                <IconButton
                  type="button"
                  label="Close"
                  icon={<X aria-hidden="true" />}
                  onClick={() => sheetRef.current?.close()}
                />
              </div>
            }
          />
        </div>
      </dialog>
    </section>
  );
}
