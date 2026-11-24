import type { CSSProperties } from 'react';
import styles from './admin.module.css';

const images = {
  dashboard: 'dashboard.png',
  bookings: 'booking.png',
  calendar: 'calendar.png',
  inquiries: 'inquiries.png',
  analytics: 'reports.png',
  settings: 'profile-settings.png',
  services: 'services.png',
} as const;
const glyphs = {
  logs: 'fi-rr-time-past',
  contracts: 'fi-rr-file-signature',
  payments: 'fi-rr-wallet',
  team: 'fi-rr-users',
} as const;
export type AdminNavIconName = keyof typeof images | keyof typeof glyphs;

export default function AdminNavIcon({ name }: { name: AdminNavIconName }) {
  if (name in images) {
    const source = `/images/admin/icons/${images[name as keyof typeof images]}`;
    return (
      <span
        className={styles.sidebarIcon}
        aria-hidden="true"
        style={
          {
            maskImage: `url("${source}")`,
            WebkitMaskImage: `url("${source}")`,
            backgroundColor: 'currentColor',
          } as CSSProperties
        }
      />
    );
  }
  return (
    <i
      className={`fi ${glyphs[name as keyof typeof glyphs]} ${styles.sidebarIcon}`}
      aria-hidden="true"
    />
  );
}
