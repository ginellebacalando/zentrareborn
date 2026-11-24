'use client';

import { useSyncExternalStore } from 'react';
import { useAdminPreferences } from './AdminPreferencesProvider';
import styles from './admin.module.css';

function subscribeToTime(onChange: () => void) {
  const timer = window.setInterval(onChange, 60_000);
  window.addEventListener('focus', onChange);
  document.addEventListener('visibilitychange', onChange);
  return () => {
    window.clearInterval(timer);
    window.removeEventListener('focus', onChange);
    document.removeEventListener('visibilitychange', onChange);
  };
}

function serverGreeting() {
  return 'Welcome back|';
}

/**
 * The dashboard's visible header: greeting and date in the configured timezone (naming rule 3).
 * The page's h1 is the visually hidden module name rendered by AdminWorkspace.
 */
export default function DashboardGreeting({ name }: { name: string }) {
  const { settings } = useAdminPreferences();
  const timeZone = settings.admin.localization.timezone;
  const [greeting, today] = useSyncExternalStore(
    subscribeToTime,
    () => {
      const now = new Date();
      const hour = Number(
        new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hourCycle: 'h23' }).format(
          now,
        ),
      );
      const date = new Intl.DateTimeFormat('en-PH', {
        timeZone,
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }).format(now);
      return `${hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'}|${date}`;
    },
    serverGreeting,
  ).split('|');

  return (
    <>
      <p className={styles.greeting}>
        {greeting}
        {name ? `, ${name}` : ''}
      </p>
      <p className={styles.pageContext}>
        {today && <span className={styles.greetingDate}>{today}</span>}
        Track revenue, bookings, upcoming events, and pending inquiries in one place.
      </p>
    </>
  );
}
