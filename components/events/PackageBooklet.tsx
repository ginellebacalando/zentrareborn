'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useId, useRef, useState, type KeyboardEvent } from 'react';

import type { EventPackageMediaKey } from '@/config/event-package-pages';
import { packageBooklets, type BookletPackage } from '@/config/package-booklets';
import styles from './PackageBooklet.module.css';

const peso = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
});

function lowestPrice(item: BookletPackage) {
  return Math.min(...item.prices.map((price) => price.amount));
}

/**
 * The event's package booklet as real text (QA, 26 November 2026): readable at any size and
 * limited to this event's packages, where the embedded flipbook showed small, blurry pictures of
 * every event's pages. One tab per package; the arrow keys move between tabs.
 */
export default function PackageBooklet({ eventType }: { eventType: EventPackageMediaKey }) {
  const booklet = packageBooklets[eventType];
  const { packages } = booklet;
  const [active, setActive] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const baseId = useId();
  const current = packages[active] ?? packages[0];

  const focusTab = (index: number) => {
    const next = (index + packages.length) % packages.length;
    setActive(next);
    tabRefs.current[next]?.focus();
  };

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const moves: Record<string, number> = {
      ArrowRight: active + 1,
      ArrowLeft: active - 1,
      Home: 0,
      End: packages.length - 1,
    };
    if (!(event.key in moves)) return;
    event.preventDefault();
    focusTab(moves[event.key]);
  };

  const tabId = (index: number) => `${baseId}-tab-${index}`;
  const panelId = `${baseId}-panel`;

  return (
    <div className={styles.booklet}>
      <div className={styles.cover}>
        <Image
          src={booklet.cover.src}
          alt=""
          width={booklet.cover.width}
          height={booklet.cover.height}
          sizes="(min-width: 64rem) 15rem, 0px"
          className={styles.coverImage}
        />
      </div>

      <div className={styles.body}>
        {packages.length > 1 ? (
          <div role="tablist" aria-label="Packages" className={styles.tabs}>
            {packages.map((item, index) => (
              <button
                key={item.id}
                ref={(node) => {
                  tabRefs.current[index] = node;
                }}
                type="button"
                role="tab"
                id={tabId(index)}
                aria-selected={index === active}
                aria-controls={panelId}
                tabIndex={index === active ? 0 : -1}
                className={styles.tab}
                onClick={() => setActive(index)}
                onKeyDown={onTabKeyDown}
              >
                <span className={styles.tabName}>{item.name}</span>
                <span className={styles.tabPrice}>From {peso.format(lowestPrice(item))}</span>
              </button>
            ))}
          </div>
        ) : null}

        <article
          id={panelId}
          role={packages.length > 1 ? 'tabpanel' : undefined}
          aria-labelledby={packages.length > 1 ? tabId(active) : undefined}
          tabIndex={packages.length > 1 ? 0 : undefined}
          className={styles.page}
        >
          <header className={styles.head}>
            {current.series ? <p className={styles.series}>{current.series}</p> : null}
            <h3 className={styles.name}>{current.name}</h3>
            {current.tagline ? <p className={styles.tagline}>{current.tagline}</p> : null}
          </header>

          <ul className={styles.prices} aria-label="Rates">
            {current.prices.map((price) => (
              <li key={price.guests} className={styles.price}>
                <span className={styles.guests}>{price.guests} guests</span>
                <span className={styles.amount}>{peso.format(price.amount)}</span>
              </li>
            ))}
          </ul>
          {current.excessPerHead || current.availability ? (
            <p className={styles.terms}>
              {current.excessPerHead ? (
                <span>{peso.format(current.excessPerHead)} for each additional guest</span>
              ) : null}
              {current.availability ? (
                <strong className={styles.availability}>{current.availability}</strong>
              ) : null}
            </p>
          ) : null}

          {current.description ? <p className={styles.lead}>{current.description}</p> : null}
          {current.idealFor ? (
            <p className={styles.lead}>
              <strong>Ideal for:</strong> {current.idealFor.join(', ')}.
            </p>
          ) : null}
          {current.includesFrom ? (
            <p className={styles.includes}>Includes everything in {current.includesFrom}, plus:</p>
          ) : null}

          <div className={styles.sections}>
            {current.sections.map((section) => (
              <section key={section.title} className={styles.section}>
                <h4 className={styles.sectionTitle}>{section.title}</h4>
                {section.intro ? <p className={styles.intro}>{section.intro}</p> : null}
                <ul className={styles.items}>
                  {section.items.map((entry) => (
                    <li key={entry}>{entry}</li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          {current.schedule ? (
            <section className={styles.schedule}>
              <h4 className={styles.sectionTitle}>Event day</h4>
              <ul className={styles.items}>
                {current.schedule.map((entry) => (
                  <li key={entry}>{entry}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {current.notes || current.ratesEffective ? (
            <div className={styles.notes}>
              {current.notes?.map((note) => (
                <p key={note}>{note}</p>
              ))}
              {current.ratesEffective ? <p>Rates effective {current.ratesEffective}.</p> : null}
            </div>
          ) : null}

          <div className={styles.actions}>
            <Link href={`/booking?event=${booklet.bookingEvent}`} className={styles.book}>
              Start a booking
            </Link>
            <Link href="/visit" className={styles.secondary}>
              Schedule an ocular visit
            </Link>
          </div>
        </article>
      </div>
    </div>
  );
}
