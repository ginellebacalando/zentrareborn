import Link from 'next/link';
import { ArrowUpRight, Info } from 'lucide-react';
import type { ConversationSummary } from '@/lib/chatbot/types';
import styles from './Chatbot.module.css';

const statusLabels: Record<string, string> = {
  stale: 'Previous result needs a fresh check',
  none: 'Information only',
  collecting: 'Preparing your details',
  ready: 'Waiting for your permission',
  checking: 'Checking with the booking service',
  available: 'Schedule check received',
  unavailable: 'Requested schedule unavailable',
  held: 'Temporary hold reported',
  pending_payment: 'Awaiting verified payment',
  confirmed: 'Confirmation received',
  failed: 'Booking service assistance needed',
  manual_review: 'Staff review needed',
};

export function ConversationDetails({
  context,
  busy,
  forgetting,
  canForget,
  onForget,
  onNavigate,
}: {
  context: ConversationSummary | null;
  busy: boolean;
  forgetting: boolean;
  canForget: boolean;
  onForget: () => void;
  onNavigate: () => void;
}) {
  const entries = [
    ['Name', context?.name],
    ['Contact', context?.contact],
    ['Event', context?.eventType],
    ['Package', context?.packageName],
    ['Preferred date', context?.date],
    ['Preferred venue', context?.venue],
    ['Preferred time', context?.timePreference],
    ['Planned guests', context?.guests?.toString()],
    ['Request / booking reference', context?.bookingReference],
  ].filter((entry) => entry[1]);
  const hasRequest = entries.length > 0 || Boolean(context && context.status !== 'none');
  return (
    <details
      className={hasRequest ? styles.savedDetails : styles.chatInfo}
      open={context?.status === 'ready'}
    >
      <summary>
        <Info size={16} aria-hidden="true" />{' '}
        {hasRequest ? 'Your request details' : 'About this chat'}
      </summary>
      <div className={styles.detailsContent}>
        {hasRequest && context && (
          <p className={styles.help}>
            Last saved: {statusLabels[context.status] ?? 'Preparing your request'}. This is not a
            new availability check.
          </p>
        )}
        {entries.length > 0 && (
          <dl>
            {entries.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        )}
        <p className={styles.help}>
          Saved request details can resume here for up to 24 hours. Zeni asks before sending them to
          the booking service or staff.
        </p>
        <div className={styles.detailsActions}>
          <Link className={styles.contact} href="/contact" onClick={onNavigate}>
            Contact the Zion team <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
          {canForget && (
            <button className={styles.forget} type="button" disabled={busy} onClick={onForget}>
              {forgetting ? 'Forgetting…' : 'Forget saved details'}
            </button>
          )}
        </div>
        {canForget && (
          <p className={styles.help}>
            Forgetting details does not cancel bookings or submitted inquiries.
          </p>
        )}
      </div>
    </details>
  );
}
