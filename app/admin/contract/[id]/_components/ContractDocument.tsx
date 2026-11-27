import ZentraWordmark from '@/components/shared/ZentraWordmark';
import { BRAND } from '@/config/brand';
import {
  contractBalance,
  termsOutline,
  type ContractSnapshot,
  type TermsGroup,
} from '@/lib/admin/contract-document';
import { money } from '@/lib/admin/domain';
import { PAYMENT_METHOD_LABELS } from '@/lib/admin/payment-accounts';
import styles from './Contract.module.css';

const manila = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', ...options });
const longDate = manila({ year: 'numeric', month: 'long', day: 'numeric' });
const eventDay = manila({ weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
const shortDate = manila({ year: 'numeric', month: 'short', day: 'numeric' });
const clock = manila({ hour: 'numeric', minute: '2-digit' });
const dayKey = manila({ year: 'numeric', month: '2-digit', day: '2-digit' });

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft for review',
  ISSUED: 'Issued for signing',
  SIGNED: 'Signed',
};

export type SignedRecord = { by: string; at: Date; reference: string };

function eventTime(startsAt: Date, endsAt: Date) {
  const nextDay = dayKey.format(startsAt) !== dayKey.format(endsAt);
  return `${clock.format(startsAt)} – ${clock.format(endsAt)}${nextDay ? ` (${shortDate.format(endsAt)})` : ''}`;
}

function paymentStatus(snapshot: ContractSnapshot, paidCents: number, balanceCents: number) {
  if (balanceCents === 0) return 'Fully paid';
  if (snapshot.amounts.reservationFeeCents > 0 && paidCents >= snapshot.amounts.reservationFeeCents)
    return 'Reservation fee paid';
  return paidCents > 0 ? 'Partly paid' : 'Awaiting payment';
}

/** The ZENTRA wordmark with Zion's address and contacts, at the top of every contract. */
export function Letterhead() {
  return (
    <header className={styles.letterhead}>
      <ZentraWordmark size="md" subtitle={BRAND.legalName} className={styles.wordmark} />
      <address className={styles.venue}>
        <span>{BRAND.address.lines.join(', ')}</span>
        <span>
          {BRAND.contact.email} · {BRAND.contact.phone}
        </span>
      </address>
    </header>
  );
}

/** The document title, its number and date, and where the contract stands. */
export function TitleRow({ meta, status }: { meta: string; status: string }) {
  return (
    <div className={styles.titleRow}>
      <div>
        <h1 id="contract-title" className={styles.title}>
          Event Service Agreement
        </h1>
        <p className={styles.meta}>{meta}</p>
      </div>
      <p className={styles.status} data-status={status}>
        {STATUS_LABELS[status] ?? status}
      </p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.detail}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

/** A blank line to sign on, the printed name under it, then a date line. */
function SignatureBlock({ party, name, title }: { party: string; name: string; title?: string }) {
  return (
    <div className={styles.signature}>
      <p className={styles.party}>{party}</p>
      <div className={styles.signatureLine} aria-hidden="true" />
      <p className={styles.signatureName}>{name}</p>
      <p className={styles.signatureCaption}>
        {title ? `${title} · ` : ''}Signature over printed name
      </p>
      <p className={styles.signatureDate}>
        Date <span className={styles.dateLine} aria-hidden="true" />
      </p>
    </div>
  );
}

/** The venue policy's terms: groups, numbered clauses, and the points each clause lists. */
function Terms({ groups }: { groups: TermsGroup[] }) {
  return groups.map((group, groupIndex) => {
    const ClauseHeading = group.title ? 'h4' : 'h3';
    return (
      <div className={styles.termsGroup} key={groupIndex}>
        {group.title && <h3 className={styles.termsGroupTitle}>{group.title}</h3>}
        {group.sections.map((section, sectionIndex) => (
          <div className={styles.clause} key={sectionIndex}>
            {section.title && (
              <ClauseHeading className={styles.clauseTitle}>{section.title}</ClauseHeading>
            )}
            <ul className={styles.clauseList}>
              {section.entries.map((entry, entryIndex) =>
                entry.kind === 'note' ? (
                  <li className={styles.clauseNote} key={entryIndex}>
                    {entry.text}
                  </li>
                ) : (
                  <li key={entryIndex}>
                    {entry.item.text}
                    {entry.item.sub.length > 0 && (
                      <ul className={styles.clauseSub}>
                        {entry.item.sub.map((point, pointIndex) => (
                          <li key={pointIndex}>{point}</li>
                        ))}
                      </ul>
                    )}
                  </li>
                ),
              )}
            </ul>
          </div>
        ))}
      </div>
    );
  });
}

/**
 * The contract as Zion prints it, on the ZENTRA letterhead: event details and inclusions, the
 * contract amount with the payments received (Zion's acknowledgment receipt), the venue policy's
 * terms, then both signatures. Everything comes from the snapshot frozen when it was generated.
 */
export default function ContractDocument({
  snapshot,
  status,
  signed,
}: {
  snapshot: ContractSnapshot;
  status: string;
  signed: SignedRecord | null;
}) {
  const { client, event, amounts, signatory } = snapshot;
  const pkg = snapshot.package;
  const startsAt = new Date(event.startsAt);
  const endsAt = new Date(event.endsAt);
  const preparedAt = new Date(snapshot.preparedAt);
  const balanceDueAt = new Date(amounts.balanceDueAt);
  const { paidCents, balanceCents } = contractBalance(snapshot);
  // Generated after the due date (an event less than the due days away): owed at once.
  const dueNow = balanceDueAt <= preparedAt;
  const balanceDue = dueNow ? 'immediately' : `by ${longDate.format(balanceDueAt)}`;
  const guestTerms = [
    pkg.paxIncluded ? `For up to ${pkg.paxIncluded} guests` : null,
    pkg.excessPaxFeeCents ? `${money(pkg.excessPaxFeeCents)} for each additional guest` : null,
  ].filter(Boolean);
  const terms = termsOutline(snapshot.terms.text);

  return (
    <article className={styles.sheet} aria-labelledby="contract-title">
      <Letterhead />
      <TitleRow
        meta={`Contract ${snapshot.reference}-v${snapshot.version} · Generated ${longDate.format(preparedAt)}`}
        status={status}
      />

      <dl className={styles.summary}>
        <div>
          <dt>Booking reference</dt>
          <dd>{snapshot.reference}</dd>
        </div>
        <div>
          <dt>Payment status</dt>
          <dd>{paymentStatus(snapshot, paidCents, balanceCents)}</dd>
        </div>
        <div>
          <dt>Balance</dt>
          <dd>{balanceCents > 0 ? `${money(balanceCents)} due ${balanceDue}` : 'None'}</dd>
        </div>
      </dl>

      <section className={styles.section} aria-labelledby="contract-event">
        <h2 id="contract-event" className={styles.heading}>
          <span className={styles.number}>1</span> Event details
        </h2>
        <dl className={styles.details}>
          <Detail label="Client" value={client.name} />
          <Detail label="Event" value={event.type} />
          <Detail label="Date" value={eventDay.format(startsAt)} />
          <Detail label="Time" value={eventTime(startsAt, endsAt)} />
          <Detail label="Guests" value={String(event.guests)} />
          <Detail label="Package" value={pkg.name} />
          <Detail label="Venue" value={event.venue} />
          {pkg.checkIn && <Detail label="Check-in" value={pkg.checkIn} />}
          {pkg.checkOut && <Detail label="Check-out" value={pkg.checkOut} />}
          <Detail label="Email" value={client.email} />
          <Detail label="Phone" value={client.phone} />
        </dl>
      </section>

      <section className={styles.section} aria-labelledby="contract-inclusions">
        <h2 id="contract-inclusions" className={styles.heading}>
          <span className={styles.number}>2</span> Package inclusions
        </h2>
        <p className={styles.packageName}>{pkg.name}</p>
        {pkg.inclusions.length ? (
          <div className={styles.inclusions}>
            {pkg.inclusions.map((group, index) => (
              <div className={styles.inclusionGroup} key={index}>
                <h3 className={styles.inclusionTitle}>{group.title}</h3>
                {group.items.length > 0 && (
                  <ul className={styles.inclusionList}>
                    {group.items.map((item, itemIndex) => (
                      <li key={itemIndex}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className={styles.body}>
            The inclusions are as agreed with {BRAND.legalName} for this booking.
          </p>
        )}
      </section>

      <section className={`${styles.section} ${styles.newPage}`} aria-labelledby="contract-amount">
        <h2 id="contract-amount" className={styles.heading}>
          <span className={styles.number}>3</span> Contract amount and payments
        </h2>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Description</th>
              <th scope="col" className={styles.amount}>
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <span className={styles.item}>{pkg.name}</span>
                {guestTerms.length > 0 && (
                  <span className={styles.itemNote}>{guestTerms.join(' · ')}</span>
                )}
              </td>
              <td className={styles.amount}>{money(amounts.totalCents)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Total contract amount</th>
              <td className={styles.amount}>{money(amounts.totalCents)}</td>
            </tr>
          </tfoot>
        </table>

        <h3 className={styles.subheading}>Payments received</h3>
        {snapshot.payments.length ? (
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Receipt no.</th>
                <th scope="col">Date</th>
                <th scope="col">Paid by</th>
                <th scope="col" className={styles.amount}>
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {snapshot.payments.map((payment) => (
                <tr key={payment.receiptNumber}>
                  <td>{payment.acknowledgmentNumber ?? payment.receiptNumber}</td>
                  <td>{shortDate.format(new Date(payment.receivedAt))}</td>
                  <td>
                    {PAYMENT_METHOD_LABELS[payment.method as keyof typeof PAYMENT_METHOD_LABELS] ??
                      payment.method}
                  </td>
                  <td className={styles.amount}>{money(payment.amountCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className={styles.body}>No payment was recorded when this contract was generated.</p>
        )}
        <dl className={styles.totals}>
          <div>
            <dt>Total paid</dt>
            <dd>{money(paidCents)}</dd>
          </div>
          <div>
            <dt>Remaining balance</dt>
            <dd>{money(balanceCents)}</dd>
          </div>
          {balanceCents > 0 && (
            <div>
              <dt>Balance due</dt>
              <dd>{dueNow ? 'Immediately' : `On or before ${longDate.format(balanceDueAt)}`}</dd>
            </div>
          )}
        </dl>
        <div className={styles.acknowledgment}>
          <p className={styles.body}>
            Payments of {money(paidCents)} as of {longDate.format(preparedAt)} acknowledged by
          </p>
          <SignatureBlock
            party={`For ${BRAND.legalName}`}
            name={signatory.name}
            title={signatory.title}
          />
        </div>
      </section>

      <section className={`${styles.section} ${styles.newPage}`} aria-labelledby="contract-terms">
        <h2 id="contract-terms" className={styles.heading}>
          <span className={styles.number}>4</span> Terms and conditions
        </h2>
        <p className={styles.meta}>Venue policy, version {snapshot.terms.policyVersion}</p>
        <div className={styles.terms}>
          <Terms groups={terms} />
        </div>
      </section>

      <section className={styles.signatures} aria-labelledby="contract-signatures">
        <h2 id="contract-signatures" className={styles.heading}>
          <span className={styles.number}>5</span> Signatures
        </h2>
        <p className={styles.body}>
          Kindly sign upon confirming the event details, the contract amount and the terms above.
        </p>
        <div className={styles.signatureGrid}>
          <SignatureBlock
            party={`For ${BRAND.legalName}`}
            name={signatory.name}
            title={signatory.title}
          />
          <SignatureBlock party="Client" name={client.name} />
        </div>
        {signed && (
          <p className={styles.signedNote}>
            Signed copy on file: {signed.reference}, recorded {longDate.format(signed.at)} (signed
            by {signed.by}).
          </p>
        )}
      </section>
    </article>
  );
}
