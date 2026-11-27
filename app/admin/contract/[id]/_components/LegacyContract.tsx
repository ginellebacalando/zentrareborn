import { Letterhead, TitleRow } from './ContractDocument';
import styles from './Contract.module.css';

/** A contract prepared before the printed layout: its text as it was saved, on the letterhead. */
export default function LegacyContract({
  reference,
  version,
  status,
  body,
}: {
  reference: string;
  version: number;
  status: string;
  body: string;
}) {
  return (
    <article className={styles.sheet} aria-labelledby="contract-title">
      <Letterhead />
      <TitleRow
        meta={`Contract ${reference}-v${version} · Prepared before the printed layout`}
        status={status}
      />
      <pre className={styles.legacyText}>{body}</pre>
    </article>
  );
}
