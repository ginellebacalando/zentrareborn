'use client';
import { useState, type MouseEvent } from 'react';
import useSWR, { mutate as refreshCache } from 'swr';
import { useRouter, useSearchParams } from 'next/navigation';
import { canDo } from '@/lib/admin/permissions';
import BookingDetail from './BookingDetail';
import LoadingSkeleton from './LoadingSkeleton';
import { listReturn, type BookingTab } from './booking-links';
import type { Booking, Mutate, Policy } from './types';
import styles from './admin.module.css';

const TAB_IDS: BookingTab[] = ['overview', 'payments', 'agreements', 'activity'];

/**
 * The booking page's data (/admin/bookings/[reference]): the booking with its payments, proofs
 * and agreements, and the venue policy its actions follow. Saving works as it did in the list:
 * every change posts to the admin API, then the booking reloads.
 */
export default function BookingPage({ bookingId, role }: { bookingId: string; role: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const initialTab = TAB_IDS.find((tab) => tab === requestedTab) ?? 'overview';
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const {
    data,
    error,
    mutate: reload,
  } = useSWR<{ booking: Booking; policy?: Policy }>(
    `/api/admin/bookings?id=${encodeURIComponent(bookingId)}`,
    async (url: string) => {
      const response = await fetch(url, { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to load booking.');
      return body;
    },
  );

  const mutate: Mutate = async (module, payload, options = {}) => {
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/${module}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to save.');
      setNotice({ kind: 'success', text: 'Saved. The activity history has been updated.' });
      await reload();
      // Lists, the dashboard and reports read the same records.
      void refreshCache(
        (key) =>
          typeof key === 'string' &&
          (key.startsWith('/api/admin/analytics?') || key.startsWith('/api/admin/bookings?')),
      );
    } catch (failure) {
      if (!options.inlineErrors)
        setNotice({
          kind: 'error',
          text: failure instanceof Error ? failure.message : 'Unable to save.',
        });
      throw failure;
    } finally {
      setBusy(false);
    }
  };

  if (error)
    return (
      <p className={styles.error} role="alert">
        {error instanceof Error ? error.message : 'Unable to load booking.'}
      </p>
    );
  if (!data) return <LoadingSkeleton label="Loading booking…" />;
  const returnTo = listReturn(data.booking.reference);
  return (
    <BookingDetail
      booking={data.booking}
      policy={data.policy}
      owner={canDo(role, 'void-receipt')}
      busy={busy}
      mutate={mutate}
      refresh={() => reload()}
      initialTab={initialTab}
      notice={notice}
      back={{
        href: returnTo.href,
        onClick: (event: MouseEvent<HTMLAnchorElement>) => {
          // Opened from a list: going back restores its filters and scroll position.
          if (!returnTo.viaHistory || event.metaKey || event.ctrlKey) return;
          event.preventDefault();
          router.back();
        },
      }}
    />
  );
}
