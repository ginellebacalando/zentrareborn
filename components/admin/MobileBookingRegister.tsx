import { money, paidTotal, paymentStatus } from '@/lib/admin/domain';
import { useAdminDate } from './AdminPreferencesProvider';
import { Badge } from './AdminBadge';
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
                  <dt>Approval</dt>
                  <dd>
                    <Badge value={booking.approval} />
                  </dd>
                  <dt>Reservation</dt>
                  <dd>
                    <Badge value={booking.reservation} />
                  </dd>
                  <dt>Cash payment</dt>
                  <dd>
                    <Badge value={paymentStatus(booking.totalCents, paid)} />
                    <small>
                      {money(paid)} / {money(booking.totalCents)}
                    </small>
                  </dd>
                </>
              )}
            </dl>
            <button
              className={styles.secondary}
              onClick={() => onOpen(booking)}
              aria-label={`Open ${booking.reference}`}
            >
              Open booking
            </button>
          </li>
        );
      })}
    </ul>
  );
}
