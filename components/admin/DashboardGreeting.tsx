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
  return 'Welcome back';
}

export default function DashboardGreeting({ name }: { name: string }) {
  const { settings } = useAdminPreferences();
  const greeting = useSyncExternalStore(
    subscribeToTime,
    () => {
      const hour = Number(
        new Intl.DateTimeFormat('en-US', {
          timeZone: settings.admin.localization.timezone,
          hour: 'numeric',
          hourCycle: 'h23',
        }).format(new Date()),
      );
      return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    },
    serverGreeting,
  );

  return (
    <>
      <h1>
        {greeting}
        {name ? `, ${name}` : ''}!
      </h1>
      <p className={styles.dashboardPurpose}>
        Track revenue, bookings, upcoming events, and pending inquiries in one place.
      </p>
    </>
  );
}
