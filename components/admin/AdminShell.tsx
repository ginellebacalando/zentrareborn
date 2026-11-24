'use client';
import { useEffect, useRef, useState, useSyncExternalStore, type MouseEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BRAND } from '@/config/brand';
import AdminNavIcon from './AdminNavIcon';
import { useAdminPreferences } from './AdminPreferencesProvider';
import styles from './admin.module.css';
import AdminAccountControls, { type AdminHeaderUser } from './AdminAccountControls';

const mobileQuery = '(max-width: 780px)';
function subscribeToViewport(onChange: () => void) {
  const media = window.matchMedia(mobileQuery);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}
function isMobileViewport() {
  return window.matchMedia(mobileQuery).matches;
}
function serverViewport() {
  return false;
}

export const modules = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'bookings', label: 'Booking' },
  { key: 'contracts', label: 'Contract' },
  { key: 'calendar', label: 'Calendar' },
  { key: 'inquiries', label: 'Inquiries' },
  { key: 'payments', label: 'Payment' },
  { key: 'services', label: 'Services & Packages' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'team', label: 'Team' },
] as const;
export default function AdminShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: AdminHeaderUser;
}) {
  const pathname = usePathname();
  const { theme } = useAdminPreferences();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isMobile = useSyncExternalStore(subscribeToViewport, isMobileViewport, serverViewport);
  const sidebarRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const open = isMobile ? mobileOpen : !collapsed;
  const mobileOverlay = isMobile && mobileOpen;
  const compact = !isMobile && collapsed;
  const settingsActive = pathname === '/admin/settings';
  const logsActive = pathname === '/admin/logs';
  const currentPage =
    modules.find(({ key }) => pathname === `/admin/${key}`)?.label ??
    (settingsActive
      ? 'Settings'
      : logsActive
        ? 'System Logs'
        : pathname === '/admin/profile'
          ? 'My Profile'
          : 'Admin Panel');
  const toggleLabel = isMobile
    ? mobileOpen
      ? 'Close sidebar'
      : 'Open sidebar'
    : collapsed
      ? 'Expand sidebar'
      : 'Collapse sidebar';

  function closeMobileNavigation() {
    setMobileOpen(false);
    if (isMobile) menuRef.current?.focus();
  }

  function toggleNavigation() {
    if (isMobile) setMobileOpen((value) => !value);
    else setCollapsed((value) => !value);
  }

  function navigatePage(event: MouseEvent<HTMLAnchorElement>) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;

    closeMobileNavigation();
  }

  useEffect(() => {
    if (!mobileOverlay) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMobileOpen(false);
        menuRef.current?.focus();
      }
      if (event.key !== 'Tab') return;
      const links = sidebarRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled])',
      );
      const first = links?.[0];
      const last = links?.[links.length - 1];
      const focused = document.activeElement;
      if (!event.shiftKey && focused === menuRef.current) {
        event.preventDefault();
        first?.focus();
      } else if (event.shiftKey && focused === first) {
        event.preventDefault();
        menuRef.current?.focus();
      } else if (!event.shiftKey && focused === last) {
        event.preventDefault();
        menuRef.current?.focus();
      } else if (event.shiftKey && focused === menuRef.current) {
        event.preventDefault();
        last?.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [mobileOverlay]);

  return (
    <div
      data-admin-theme={theme}
      className={`${styles.root} ${theme === 'dark' ? styles.adminDark : ''} ${collapsed ? styles.sidebarCollapsed : ''}`}
    >
      <a className={styles.skip} href="#admin-content" inert={mobileOverlay}>
        Skip to content
      </a>
      <button
        type="button"
        className={`${styles.backdrop} ${mobileOpen ? styles.backdropOpen : ''}`}
        aria-label="Close navigation"
        aria-hidden={!mobileOverlay}
        tabIndex={-1}
        onClick={closeMobileNavigation}
      />
      <button
        ref={menuRef}
        type="button"
        className={styles.menuToggle}
        onClick={toggleNavigation}
        aria-label={toggleLabel}
        title={toggleLabel}
        aria-expanded={open}
        aria-controls="admin-sidebar"
      >
        <svg
          className={styles.panelToggleIcon}
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="3" width="18" height="18" rx="1.5" />
          <path className={styles.panelDivider} d="M15 3v18" />
          <g className={styles.panelArrow}>
            <path d="M6.5 12H12m-2.5-2.5L12 12l-2.5 2.5" />
          </g>
        </svg>
      </button>
      <aside
        ref={sidebarRef}
        id="admin-sidebar"
        className={`${styles.sidebar} ${mobileOpen ? styles.open : ''}`}
        aria-label="Administration navigation"
        inert={isMobile && !mobileOpen}
      >
        <div className={styles.sidebarHeader}>
          <AdminBrand compact={compact} onNavigate={navigatePage} />
        </div>
        <nav aria-label="Workspace navigation">
          {modules.map(({ key, label }) => (
            <Link
              key={key}
              href={`/admin/${key}`}
              onClick={navigatePage}
              aria-label={label}
              title={compact ? label : undefined}
              aria-current={pathname === `/admin/${key}` ? 'page' : undefined}
              className={`${styles.navItem} ${pathname === `/admin/${key}` ? styles.active : ''}`}
            >
              <AdminNavIcon name={key} />
              <span className={styles.navText}>{label}</span>
            </Link>
          ))}
        </nav>
        <div className={styles.sidebarBottom}>
          <Link
            href="/admin/logs"
            className={`${styles.navItem} ${styles.footerLink} ${logsActive ? styles.active : ''}`}
            onClick={navigatePage}
            aria-label="System Logs"
            title={compact ? 'System Logs' : undefined}
            aria-current={logsActive ? 'page' : undefined}
          >
            <AdminNavIcon name="logs" />
            <span className={styles.navText}>System Logs</span>
          </Link>
          <Link
            href="/admin/settings"
            className={`${styles.navItem} ${styles.footerLink} ${settingsActive ? styles.active : ''}`}
            onClick={navigatePage}
            aria-label="Settings"
            title={compact ? 'Settings' : undefined}
            aria-current={settingsActive ? 'page' : undefined}
          >
            <AdminNavIcon name="settings" />
            <span className={styles.navText}>Settings</span>
          </Link>
        </div>
      </aside>
      <div className={styles.content}>
        <header className={styles.header} aria-label="Administration header" inert={mobileOverlay}>
          {!open && <span className={styles.currentPage}>{currentPage}</span>}
          <AdminAccountControls
            key={pathname}
            user={user}
            inactive={mobileOverlay}
            onNavigate={navigatePage}
          />
        </header>
        <main id="admin-content" className={styles.main} inert={mobileOverlay}>
          {user.mustChangePassword && (
            <div className={styles.notice}>
              Your account requires a password change. Open Admin profile to continue.
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}

function AdminBrand({
  compact,
  onNavigate,
}: {
  compact: boolean;
  onNavigate: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <Link
      href="/admin/dashboard"
      className={styles.brand}
      onClick={onNavigate}
      aria-label="Zion Events Place Admin Panel dashboard"
      aria-hidden={compact || undefined}
      tabIndex={compact ? -1 : undefined}
    >
      <span className={styles.brandMark}>
        <Image src={BRAND.logo.src} alt="" width={48} height={48} />
      </span>
      <span className={styles.brandText}>
        <span className={styles.brandName}>Zion Events Place</span>
        <span className={styles.brandSubtitle}>Admin Panel</span>
      </span>
    </Link>
  );
}
