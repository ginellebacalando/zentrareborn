'use client';
import { Download } from 'lucide-react';
import { Button } from '@/components/shared/Button';
import { Badge } from './AdminBadge';
import { useAdminDate } from './AdminPreferencesProvider';
import type { Booking, Mutate } from './types';
import styles from './admin.module.css';
import page from './BookingDetail.module.css';

/** Saves an agreement version as a text file in the browser. */
function downloadAgreement(reference: string, version: number, body: string) {
  const url = URL.createObjectURL(new Blob([body], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${reference}-agreement-v${version}.txt`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * The booking page's Agreements tab (unchanged rules): a review draft prepared from the booking,
 * issued after review, then the physical signature recorded. Nothing is signed automatically.
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
  const eventDate = useAdminDate();
  const closed = ['CANCELLED', 'COMPLETED'].includes(b.reservation);
  const run = (payload: Record<string, unknown>) =>
    mutate('contracts', { id: b.id, revision: b.revision, ...payload }).catch(() => {
      // The page shows the server's message.
    });

  return (
    <section className={styles.subsection} aria-label="Agreements">
      <div className={page.tabIntro}>
        <p className={page.quiet}>
          Prepared from the booking as it is now. Nothing is signed automatically.
        </p>
        {b.approval === 'APPROVED' && !closed && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => void run({ op: 'create-contract' })}
          >
            Prepare review draft
          </Button>
        )}
      </div>
      {b.contracts.map((c) => (
        <details className={styles.contract} key={c.id}>
          <summary>
            <strong>Agreement v{c.version}</strong>
            <Badge value={c.status} />
            {c.bookingRevision !== b.revision && (
              <span className={styles.help}>Historical snapshot</span>
            )}
          </summary>
          <pre className={styles.preview}>{c.body}</pre>
          <div className={styles.actions}>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={<Download aria-hidden="true" />}
              onClick={() => downloadAgreement(b.reference, c.version, c.body)}
            >
              Download (.txt)
            </Button>
            {c.status === 'DRAFT' && !closed && c.bookingRevision === b.revision && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      'Confirm the agreement details and terms have been reviewed before issuing.',
                    )
                  )
                    void run({ op: 'contract-action', contractId: c.id, action: 'ISSUE' });
                }}
              >
                Issue reviewed agreement
              </Button>
            )}
          </div>
          {c.status === 'ISSUED' && !closed && c.bookingRevision === b.revision && (
            <form
              className={styles.inlineForm}
              onSubmit={(event) => {
                event.preventDefault();
                const f = new FormData(event.currentTarget);
                void run({
                  op: 'contract-action',
                  contractId: c.id,
                  action: 'SIGN',
                  signer: f.get('signer'),
                  reference: f.get('reference'),
                });
              }}
            >
              <label>
                Physical document signed by
                <input name="signer" required minLength={2} maxLength={180} />
              </label>
              <label>
                Signed document reference
                <input
                  name="reference"
                  required
                  minLength={3}
                  maxLength={180}
                  placeholder="Filed document / record reference"
                />
              </label>
              <Button variant="primary" size="sm" disabled={busy}>
                Record physical signature
              </Button>
            </form>
          )}
          {c.signedAt && (
            <p>
              Signed by {c.signedBy} · {eventDate(c.signedAt)} · {c.signedReference}
            </p>
          )}
        </details>
      ))}
      {!b.contracts.length && <p className={page.quiet}>No agreement prepared yet.</p>}
    </section>
  );
}
