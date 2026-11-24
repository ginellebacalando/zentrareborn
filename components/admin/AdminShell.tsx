'use client';
import { useEffect, useRef, useState, useSyncExternalStore, type MouseEvent } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ZentraWordmark from '@/components/shared/ZentraWordmark';
import AdminNavIcon from './AdminNavIcon';
import { useAdminPreferences } from './AdminPreferencesProvider';
import {
  adminFooterModules,
  adminModules,
  isActiveModule,
  type AdminModuleKey,
} from './navigation';
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
  const toggleLabel = isMobile
    ? mobileOpen
      ? 'Close navigation'
      : 'Open navigation'
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

  function navLink({ key, label }: { key: AdminModuleKey; label: string }) {
    const active = isActiveModule(pathname, key);
    return (
      <li key={key}>
        <Link
          href={`/admin/${key}`}
          onClick={navigatePage}
          title={compact ? label : undefined}
          aria-current={active ? 'page' : undefined}
          className={`${styles.navItem} ${active ? styles.active : ''}`}
        >
          <AdminNavIcon name={key} />
          <span className={styles.navText}>{label}</span>
        </Link>
      </li>
    );
  }

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
      <header className={styles.header}>
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
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="3" width="18" height="18" rx="1.5" />
            <path d="M9 3v18" />
            <g className={styles.panelArrow}>
              <path d="M14.5 9.5L17 12l-2.5 2.5" />
            </g>
          </svg>
        </button>
        <Link
          href="/admin/dashboard"
          className={styles.brand}
          onClick={navigatePage}
          aria-label="ZENTRA Admin dashboard"
          inert={mobileOverlay}
        >
          <ZentraWordmark subtitle="Admin dashboard" size="sm" className={styles.wordmark} />
        </Link>
        <AdminAccountControls
          key={pathname}
          user={user}
          inactive={mobileOverlay}
          onNavigate={navigatePage}
        />
      </header>
      <aside
        ref={sidebarRef}
        id="admin-sidebar"
        className={`${styles.sidebar} ${mobileOpen ? styles.open : ''}`}
        aria-label="Administration"
        inert={isMobile && !mobileOpen}
      >
        <nav aria-label="Workspace" className={styles.sidebarNav}>
          <ul className={styles.navList}>{adminModules.map(navLink)}</ul>
        </nav>
        <nav aria-label="System" className={styles.sidebarBottom}>
          <ul className={styles.navList}>{adminFooterModules.map(navLink)}</ul>
        </nav>
      </aside>
      <div className={styles.content}>
        <main id="admin-content" className={styles.main} inert={mobileOverlay}>
          {user.mustChangePassword && (
            <div className={styles.notice}>
              Your account requires a password change. Open My profile to continue.
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
