'use client';

import { useId, useRef, useState, type ReactNode } from 'react';
import { Columns3, X } from 'lucide-react';
import { Button, IconButton } from '@/components/shared/Button';
import { useModalDialog } from '@/components/shared/useModalDialog';
import { effectiveGroups, formatPeso, type PackageFamily } from '@/lib/event-packages';
import styles from './EventPackages.module.css';

type CompareCell = { items: string[]; from: string | null } | null;
type CompareRow = { label: string; cells: ReactNode[]; differs: boolean };

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

function listCell(cell: CompareCell, packageName: string) {
  if (!cell) return <p className={styles.missing}>Not in {packageName}</p>;
  return (
    <>
      {cell.from ? <p className={styles.inherited}>As in {cell.from}</p> : null}
      <ul className={styles.cellList}>
        {cell.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </>
  );
}

/** The rows to compare: prices by guest count, extra guests, hours, then each category. */
function compareRows(families: readonly PackageFamily[]): CompareRow[] {
  const signature = (values: string[]) => new Set(values).size > 1;
  const rows: CompareRow[] = [];
  const guestCounts = [
    ...new Set(families.flatMap((family) => family.tiers.map((tier) => tier.paxIncluded))),
  ].sort((left, right) => left - right);
  for (const guests of guestCounts) {
    const values = families.map((family) => {
      const tier = family.tiers.find((item) => item.paxIncluded === guests);
      return tier ? formatPeso(tier.price) : 'Not offered';
    });
    rows.push({
      label: `Price for ${plural(guests, 'guest')}`,
      cells: values,
      differs: signature(values),
    });
  }
  const fees = families.map((family) =>
    family.extraGuestFee ? `${formatPeso(family.extraGuestFee)} per guest` : 'Not listed',
  );
  rows.push({ label: 'Extra guests', cells: fees, differs: signature(fees) });
  if (families.some((family) => family.venueHours)) {
    const hours = families.map((family) => family.venueHours ?? 'Not listed');
    rows.push({ label: 'Venue hours', cells: hours, differs: signature(hours) });
  }
  const perFamily = families.map((family) => effectiveGroups(family, families));
  const titles: string[] = [];
  for (const groups of perFamily)
    for (const group of groups)
      if (!titles.some((title) => title.toLowerCase() === group.title.toLowerCase()))
        titles.push(group.title);
  for (const title of titles) {
    const cells = perFamily.map(
      (groups) => groups.find((group) => group.title.toLowerCase() === title.toLowerCase()) ?? null,
    );
    rows.push({
      label: title,
      cells: cells.map((cell, index) => listCell(cell, families[index].name)),
      differs: signature(cells.map((cell) => (cell ? cell.items.join('\n') : ''))),
    });
  }
  return rows;
}

/**
 * "Compare packages": every package side by side in a native modal dialog (a table on wider
 * screens, a stacked list on phones), with the rows that differ marked in text and shading.
 */
export default function PackageCompare({ families }: { families: readonly PackageFamily[] }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useModalDialog(dialogRef);
  const [differencesOnly, setDifferencesOnly] = useState(false);
  const titleId = useId();
  const rows = compareRows(families).filter((row) => !differencesOnly || row.differs);

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="lg"
        icon={<Columns3 aria-hidden="true" />}
        aria-haspopup="dialog"
        onClick={() => dialogRef.current?.showModal()}
      >
        Compare packages
      </Button>
      <dialog ref={dialogRef} className={styles.dialog} aria-labelledby={titleId}>
        <div className={styles.dialogHeader}>
          <h2 id={titleId} className={styles.dialogTitle}>
            Compare packages
          </h2>
          <div className={styles.dialogTools}>
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={differencesOnly}
                onChange={(event) => setDifferencesOnly(event.target.checked)}
              />
              Show only differences
            </label>
            <IconButton
              label="Close comparison"
              icon={<X aria-hidden="true" />}
              onClick={() => dialogRef.current?.close()}
            />
          </div>
        </div>
        <div className={styles.dialogBody}>
          <div className={styles.wideOnly}>
            <table className={styles.compareTable}>
              <caption className="sr-only">
                Packages side by side; rows marked Different are not the same in every package.
              </caption>
              <thead>
                <tr>
                  <td />
                  {families.map((family) => (
                    <th key={family.key} scope="col">
                      {family.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.label} data-differs={row.differs || undefined}>
                    <th scope="row">
                      {row.label}
                      {row.differs ? (
                        <>
                          <br />
                          <span className={styles.differs}>Different</span>
                        </>
                      ) : null}
                    </th>
                    {row.cells.map((cell, index) => (
                      <td key={families[index].key}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={`${styles.stacked} ${styles.narrowOnly}`}>
            {rows.map((row) => (
              <section
                key={row.label}
                className={styles.stackedRow}
                data-differs={row.differs || undefined}
              >
                <h3>
                  {row.label}
                  {row.differs ? (
                    <>
                      {' '}
                      <span className={styles.differs}>Different</span>
                    </>
                  ) : null}
                </h3>
                <dl>
                  {row.cells.map((cell, index) => (
                    <div key={families[index].key}>
                      <dt>{families[index].name}</dt>
                      <dd>{cell}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
        </div>
      </dialog>
    </>
  );
}
