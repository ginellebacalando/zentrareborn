'use client';
import { FileText } from 'lucide-react';
import { Button, ButtonLink } from '@/components/shared/Button';
import { Badge } from './AdminBadge';
import { useAdminDate } from './AdminPreferencesProvider';
import type { Booking, Contract, Mutate } from './types';
import styles from './admin.module.css';
import page from './BookingDetail.module.css';

/** What staff do next with a contract, in the order Zion works. */
const NEXT_STEP: Record<string, string> = {
  DRAFT: 'Check it, then issue it for signing.',
  ISSUED: 'Print it for the client to sign, then record the signature.',
};

/** The contract's own page, where it prints or saves as PDF (app/admin/contract/[id]). */
export function contractPath(id: string) {
  return `/admin/contract/${encodeURIComponent(id)}`;
}

type Run = (payload: Record<string, unknown>) => void;

function ContractCard({
  contract: c,
  current,
  closed,
  busy,
  clientName,
  run,
}: {
  contract: Contract;
  current: boolean;
  closed: boolean;
  busy: boolean;
  clientName: string;
  run: Run;
}) {
  const formatDate = useAdminDate();
  const next = current && !closed ? NEXT_STEP[c.status] : undefined;
  return (
    <article className={page.contractCard} aria-labelledby={`contract-${c.id}`}>
      <div className={page.contractHead}>
        <FileText className={page.contractIcon} aria-hidden="true" />
        <div className={page.contractTitle}>
          <h2 id={`contract-${c.id}`}>Contract v{c.version}</h2>
          <p className={page.quiet}>
            Generated {formatDate(c.createdAt)}
            {current ? '' : ' · before the booking’s latest change'}
          </p>
        </div>
        <Badge value={c.status} />
      </div>
      {next && <p className={page.contractNote}>{next}</p>}
      <div className={styles.actions}>
        <ButtonLink
          href={contractPath(c.id)}
          variant={c.status === 'ISSUED' ? 'primary' : 'secondary'}
          size="sm"
          icon={<FileText aria-hidden="true" />}
        >
          Open contract
        </ButtonLink>
        {c.status === 'DRAFT' && current && !closed && (
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={busy}
            onClick={() => {
              if (
                window.confirm(
                  'Issue this contract for signing? Check the event details, the amounts and the terms first.',
                )
              )
                run({ op: 'contract-action', contractId: c.id, action: 'ISSUE' });
            }}
          >
            Issue for signing
          </Button>
        )}
      </div>
      {c.status === 'ISSUED' && current && !closed && (
        <form
          className={styles.inlineForm}
          onSubmit={(event) => {
            event.preventDefault();
            const f = new FormData(event.currentTarget);
            run({
              op: 'contract-action',
              contractId: c.id,
              action: 'SIGN',
              signer: f.get('signer'),
              reference: f.get('reference'),
            });
          }}
        >
          <label>
            Signed by
            <input name="signer" required minLength={2} maxLength={180} defaultValue={clientName} />
          </label>
          <label>
            Where the signed copy is filed
            <input name="reference" required minLength={3} maxLength={180} />
          </label>
          <Button variant="primary" size="sm" disabled={busy}>
            Record signature
          </Button>
        </form>
      )}
      {c.signedAt && (
        <p className={page.contractNote}>
          Signed by {c.signedBy} · recorded {formatDate(c.signedAt)} · filed as {c.signedReference}
        </p>
      )}
    </article>
  );
}

/**
 * The booking page's Agreements tab (docs/admin-panel.md, "Contracts"). Once the booking is
 * confirmed, staff generate the contract from it, open it to print or save as PDF, issue it, and
 * record the signature after the client signs the printed copy. The contract stays with the
 * booking; nothing is emailed. A booking change after generating needs an updated version.
 */
export default function BookingAgreements({
  booking: b,
  busy,
  mutate,
}: {
  booking: Booking;
  busy: boolean;
  mutate: Mutate;
}) {
  const closed = ['CANCELLED', 'COMPLETED'].includes(b.reservation);
  const confirmed = b.reservation === 'CONFIRMED';
  const [latest, ...earlier] = b.contracts;
  const outdated = latest ? latest.bookingRevision !== b.revision : false;
  const canGenerate = confirmed && b.approval === 'APPROVED' && (!latest || outdated);
  const run: Run = (payload) => {
    mutate('contracts', { id: b.id, revision: b.revision, ...payload }).catch(() => {
      // The page shows the server's message.
    });
  };
  const intro = latest
    ? 'The contract stays with this booking: print it for the client to sign. It is not emailed.'
    : closed
      ? 'No contract was generated for this booking.'
      : confirmed
        ? 'Generate the contract from this booking: event details, package inclusions, receipts, the venue policy and both signatories.'
        : 'The contract can be generated once the booking is confirmed.';

  return (
    <section className={styles.subsection} aria-label="Agreements">
      <div className={page.tabIntro}>
        <p className={page.quiet}>{intro}</p>
        {canGenerate && (
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={busy}
            onClick={() => run({ op: 'create-contract' })}
          >
            {latest ? 'Generate updated contract' : 'Generate contract'}
          </Button>
        )}
      </div>
      {latest && (
        <ContractCard
          contract={latest}
          current={!outdated}
          closed={closed}
          busy={busy}
          clientName={b.clientName}
          run={run}
        />
      )}
      {earlier.length > 0 && (
        <details className={page.earlierContracts}>
          <summary>Earlier versions ({earlier.length})</summary>
          <ul>
            {earlier.map((c) => (
              <li key={c.id}>
                <span>Contract v{c.version}</span>
                <Badge value={c.status} />
                <ButtonLink href={contractPath(c.id)} variant="secondary" size="sm">
                  Open
                </ButtonLink>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
