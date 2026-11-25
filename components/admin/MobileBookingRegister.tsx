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
          <li key={booking.id}>
            <h3>{booking.clientName}</h3>
            <p>
              {booking.reference} · {booking.eventType}
            </p>
            <dl>
              <dt>Event schedule</dt>
              <dd>
                {date(booking.startsAt)}
                <small>{booking.packageName}</small>
              </dd>
              {section === 'contracts' ? (
                <>
                  <dt>Latest agreement</dt>
                  <dd>
                    {contract ? (
                      <>
                        <span>Version {contract.version} </span>
                        <Badge value={contract.status} />
                      </>
                    ) : (
                      'Not prepared'
                    )}
                  </dd>
                </>
              ) : (
                <>
                  {section === 'bookings' && (
                    <>
                      <dt>Status</dt>
                      <dd>
                        <StatusChip status={displayStatus(booking)} />
                      </dd>
                    </>
                  )}
                  <dt>Approval</dt>
                  <dd>
                    <Badge value={booking.approval} />
                  </dd>
                  <dt>Reservation</dt>
                  <dd>
                    <Badge value={booking.reservation} />
                  </dd>
                  <dt>Payment</dt>
                  <dd>
                    <Badge value={paymentStatus(booking.totalCents, paid)} />
                    <small>
                      {money(paid)} / {money(booking.totalCents)}
                    </small>
                    {!!booking.proofsToVerify && (
                      <small className={styles.proofWaiting}>Screenshot to verify</small>
                    )}
                  </dd>
                </>
              )}
            </dl>
            <button
              type="button"
              className={styles.viewDetails}
              onClick={() => onOpen(booking)}
              aria-label={`View details for ${booking.reference}, ${booking.clientName}`}
            >
              View details
            </button>
          </li>
        );
      })}
    </ul>
  );
}
