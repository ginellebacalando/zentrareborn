import { money, paidTotal, paymentStatus } from '@/lib/admin/domain';
import { displayStatus } from '@/lib/admin/dashboard-status';
import { useAdminDate } from './AdminPreferencesProvider';
import { Badge } from './AdminBadge';
import { StatusChip } from './BookingStatus';
import type { Booking } from './types';
import styles from './admin.module.css';

export default function MobileBookingRegister({
  bookings,
  section,
  onOpen,
}: {
  bookings: Booking[];
  section: string;
  onOpen: (booking: Booking) => void;
}) {
  const date = useAdminDate();
  return (
    <ul className={styles.mobileRecords} aria-label="Booking records">
      {bookings.map((booking) => {
        const paid = paidTotal(booking.payments);
        const contract = booking.contracts[0];
        return (
          <li key={booking.id} className={styles.clickableCard}>
            <h3>
              {/* The record's one control; its ::after makes the whole card clickable. */}
              <button
                type="button"
                className={styles.rowLink}
                onClick={() => onOpen(booking)}
                aria-label={`${booking.clientName}, ${booking.reference}: open details`}
              >
                {booking.clientName}
              </button>
            </h3>
            <p>
              {booking.eventType} · {booking.packageName}
            </p>
            <p>
              {date(booking.startsAt)} · {booking.reference}
            </p>
            <div className={styles.mobileRecordTags}>
              {section === 'contracts' ? (
                contract ? (
                  <>
                    <span>Agreement version {contract.version}</span>
                    <Badge value={contract.status} />
                  </>
                ) : (
                  <span>Agreement not prepared</span>
                )
              ) : (
                <>
                  <StatusChip status={displayStatus(booking)} />
                  <Badge value={paymentStatus(booking.totalCents, paid)} />
                  <small>
                    {money(paid)} / {money(booking.totalCents)}
                  </small>
                  {!!booking.proofsToVerify && (
                    <small className={styles.proofWaiting}>Screenshot to verify</small>
                  )}
                </>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
