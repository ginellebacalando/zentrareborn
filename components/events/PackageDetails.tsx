'use client';

import { useId, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { priceLine, type InclusionGroup, type PackageFamily } from '@/lib/event-packages';
import styles from './EventPackages.module.css';

/**
 * One inclusion category. Wider screens list every category at once; on phones each is a
 * collapsible section (its toggle button is hidden on wider screens, so it is announced only where
 * it works).
 */
function InclusionCategory({
  group,
  initiallyOpen,
}: {
  group: InclusionGroup;
  initiallyOpen: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const bodyId = useId();
  return (
    <section className={styles.group} data-open={open || undefined}>
      <h3 className={styles.groupTitle}>
        <button
          type="button"
          className={styles.groupToggle}
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((value) => !value)}
        >
          {group.title}
          <ChevronDown size={18} aria-hidden="true" />
        </button>
        <span className={styles.groupHeading}>{group.title}</span>
      </h3>
      <div id={bodyId} className={styles.groupBody}>
        {group.intro ? <p className={styles.groupIntro}>{group.intro}</p> : null}
        <ul className={styles.items}>
          {group.items.map((item) => (
            <li key={item}>
              <Check size={16} aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** A package's name, rates, facts and inclusions, all from the published catalog. */
export default function PackageDetails({ family }: { family: PackageFamily }) {
  return (
    <>
      <header className={styles.panelHeader}>
        <h2 className={styles.packageName}>{family.name}</h2>
        {family.tagline ? <p className={styles.tagline}>{family.tagline}</p> : null}
        <ul className={styles.prices} aria-label={`${family.name} rates`}>
          {priceLine(family)
            .split(' · ')
            .map((part) => (
              <li key={part}>{part}</li>
            ))}
        </ul>
        {family.facts.length || family.venueHours ? (
          <dl className={styles.facts}>
            {family.venueHours ? (
              <div>
                <dt>Venue hours:</dt>
                <dd>{family.venueHours}</dd>
              </div>
            ) : null}
            {family.facts.map((fact) => (
              <div key={fact.label}>
                <dt>{fact.label}:</dt>
                <dd>{fact.text}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </header>
      {family.includesFrom ? (
        <p className={styles.includesFrom}>Everything in {family.includesFrom}, plus:</p>
      ) : null}
      {family.groups.length ? (
        <div className={styles.groups}>
          {family.groups.map((group, index) => (
            <InclusionCategory key={group.title} group={group} initiallyOpen={index === 0} />
          ))}
        </div>
      ) : null}
      {family.notes.length || family.ratesEffective ? (
        <div className={styles.notes}>
          {family.notes.map((note) => (
            <p key={note}>{note}</p>
          ))}
          {family.ratesEffective ? <p>Rates effective {family.ratesEffective}.</p> : null}
        </div>
      ) : null}
    </>
  );
}
