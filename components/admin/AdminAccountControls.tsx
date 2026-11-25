'use client';

import { useEffect, useRef, useState, type MouseEvent } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import useSWR from 'swr';
import {
  ArrowUpRight,
  Bell,
  CalendarCheck,
  CheckCheck,
  ChevronDown,
  CircleUserRound,
  FileSignature,
  LogOut,
  Mail,
  MessageSquare,
  Moon,
  RefreshCw,
  ShieldCheck,
  Sun,
  TriangleAlert,
  Wallet,
  X,
} from 'lucide-react';
import type { AdminNotificationSummary } from './types';
import styles from './admin.module.css';
import AdminAvatar from './AdminAvatar';
import { useAdminPreferences } from './AdminPreferencesProvider';

export type AdminHeaderUser = {
  fullName: string | null;
  username: string;
  email: string;
  profileImage: string | null;
  role: string;
  mustChangePassword: boolean;
};

const notificationIcons = {
  booking: CalendarCheck,
  inquiry: MessageSquare,
  warning: TriangleAlert,
  policy: ShieldCheck,
  payment: Wallet,
  contract: FileSignature,
};

export default function AdminAccountControls({
  user,
  inactive,
  onNavigate,
}: {
  user: AdminHeaderUser;
  inactive: boolean;
  onNavigate: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useAdminPreferences();
  const [panel, setPanel] = useState<'notifications' | 'profile' | null>(null);
  const controlsRef = useRef<HTMLElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);
  const profileRef = useRef<HTMLButtonElement>(null);
  const displayName = user.fullName?.trim() || user.username;
  const roleLabel = user.role === 'SUPERADMIN' ? 'Super Administrator' : 'Administrator';
  const roleShort = user.role === 'SUPERADMIN' ? 'Super admin' : 'Admin';
  const activePanel = inactive ? null : panel;
  const { data, error, isLoading, mutate } = useSWR<AdminNotificationSummary>(
    user.mustChangePassword ? null : '/api/admin/notifications',
    async (url: string) => {
      const response = await fetch(url, { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to load notifications.');
      return body;
    },
    { refreshInterval: 60000, shouldRetryOnError: false },
  );
  const notifications = data?.notifications ?? [];
  const newInquiries = !error && notifications.some((notice) => notice.id === 'new-inquiries');

  useEffect(() => {
    if (!activePanel) return;
    function outside(event: PointerEvent) {
      if (!controlsRef.current?.contains(event.target as Node)) setPanel(null);
    }
    function escape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setPanel(null);
      (activePanel === 'notifications' ? bellRef : profileRef).current?.focus();
    }
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [activePanel]);

  function navigate(event: MouseEvent<HTMLAnchorElement>) {
    if (
      !event.defaultPrevented &&
      event.button === 0 &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.shiftKey &&
      !event.altKey
    )
      setPanel(null);
    onNavigate(event);
  }

  return (
    <nav
      ref={controlsRef}
      className={styles.accountNav}
      aria-label="Account navigation"
      inert={inactive}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPanel(null);
      }}
    >
      <button
        type="button"
        className={styles.headerIcon}
        aria-label="Dark theme"
        aria-pressed={theme === 'dark'}
        data-tip={theme === 'dark' ? 'Switch to the light theme' : 'Switch to the dark theme'}
        onClick={toggleTheme}
      >
        {theme === 'dark' ? (
          <Sun size={20} strokeWidth={1.5} aria-hidden="true" />
        ) : (
          <Moon size={20} strokeWidth={1.5} aria-hidden="true" />
        )}
      </button>
      <div className={styles.accountPopoverAnchor}>
        <button
          ref={bellRef}
          type="button"
          className={styles.headerIcon}
          aria-label={`Notifications${notifications.length && !error ? `, ${notifications.length} ${notifications.length === 1 ? 'alert' : 'alerts'}` : ''}`}
          data-tip="Notifications"
          aria-expanded={activePanel === 'notifications'}
          aria-controls="admin-notification-panel"
          onClick={() => {
            setPanel(panel === 'notifications' ? null : 'notifications');
            if (!user.mustChangePassword) void mutate();
          }}
        >
          <Bell size={20} strokeWidth={1.5} aria-hidden="true" />
          {notifications.length > 0 && !error && (
            <span className={styles.notificationCount} aria-hidden="true">
              {notifications.length}
            </span>
          )}
        </button>
        {activePanel === 'notifications' && (
          <section
            id="admin-notification-panel"
            className={`${styles.accountPopover} ${styles.notificationsPanel}`}
            aria-label="Notifications"
          >
            <div className={styles.popoverHeading}>
              <div>
                <h2>Notifications</h2>
                <p>Items needing your attention</p>
              </div>
              <button
                type="button"
                className={styles.popoverClose}
                aria-label="Close notifications"
                onClick={() => {
                  setPanel(null);
                  bellRef.current?.focus();
                }}
              >
                <X size={17} aria-hidden="true" />
              </button>
            </div>
            <div className={styles.notificationList} aria-live="polite" aria-busy={isLoading}>
              {user.mustChangePassword ? (
                <div className={styles.notificationEmpty}>
                  <ShieldCheck size={25} aria-hidden="true" />
                  <strong>Secure your account</strong>
                  <p>Change your password in your profile to view operational updates.</p>
                  <Link href="/admin/profile" onClick={navigate}>
                    Open my profile <ArrowUpRight size={14} aria-hidden="true" />
                  </Link>
                </div>
              ) : error ? (
                <div className={styles.notificationEmpty} role="status">
                  <TriangleAlert size={25} aria-hidden="true" />
                  <strong>Notifications are unavailable</strong>
                  <p>{error.message}</p>
                  <button type="button" className={styles.linkButton} onClick={() => void mutate()}>
                    <RefreshCw size={14} aria-hidden="true" /> Try again
                  </button>
                </div>
              ) : isLoading ? (
                <div className={styles.notificationEmpty} role="status">
                  <RefreshCw size={24} aria-hidden="true" />
                  <p>Loading notifications…</p>
                </div>
              ) : notifications.length ? (
                notifications.map((notice) => {
                  const Icon = notificationIcons[notice.kind];
                  return (
                    <Link
                      key={notice.id}
                      href={notice.href}
                      className={styles.notificationItem}
                      onClick={navigate}
                    >
                      <span
                        className={`${styles.notificationIcon} ${notice.kind === 'warning' ? styles.notificationWarning : ''}`}
                      >
                        <Icon size={18} strokeWidth={1.5} aria-hidden="true" />
                      </span>
                      <span className={styles.notificationText}>
                        <strong>{notice.title}</strong>
                        <span>{notice.message}</span>
                      </span>
                      <ArrowUpRight
                        size={15}
                        className={styles.notificationArrow}
                        aria-hidden="true"
                      />
                    </Link>
                  );
                })
              ) : (
                <div className={styles.notificationEmpty}>
                  <CheckCheck size={27} aria-hidden="true" />
                  <strong>You’re all caught up</strong>
                  <p>No items need your attention right now.</p>
                </div>
              )}
            </div>
            <div className={styles.popoverFooter}>Updates automatically while you work</div>
          </section>
        )}
      </div>
      <Link
        href="/admin/inquiries"
        className={`${styles.headerIcon} ${styles.messagesLink}`}
        onClick={navigate}
        aria-label={newInquiries ? 'Messages, new inquiries waiting' : 'Messages'}
        data-tip="Messages"
        aria-current={pathname === '/admin/inquiries' ? 'page' : undefined}
      >
        <Mail size={20} strokeWidth={1.5} aria-hidden="true" />
        {newInquiries && <span className={styles.headerDot} aria-hidden="true" />}
      </Link>

      <div className={styles.accountPopoverAnchor}>
        <button
          ref={profileRef}
          type="button"
          className={styles.accountButton}
          aria-label={`Account menu, ${displayName}, ${roleShort}`}
          data-tip="Account menu"
          data-tip-align="end"
          aria-expanded={activePanel === 'profile'}
          aria-controls="admin-profile-panel"
          onClick={() => setPanel(panel === 'profile' ? null : 'profile')}
        >
          <AdminAvatar user={user} />
          <span className={styles.accountRole}>{roleShort}</span>
          <ChevronDown size={16} className={styles.accountChevron} aria-hidden="true" />
        </button>
        {activePanel === 'profile' && (
          <section
            id="admin-profile-panel"
            className={`${styles.accountPopover} ${styles.profilePanel}`}
            aria-label="Admin account"
          >
            <Link
              href="/admin/profile"
              className={styles.profileIdentity}
              onClick={navigate}
              aria-label={`Open profile for ${displayName}`}
            >
              <AdminAvatar user={user} size="menu" />
              <div>
                <strong title={displayName}>{displayName}</strong>
                <span className={styles.profileRole}>{roleLabel}</span>
                <span className={styles.profileEmail} title={user.email}>
                  {user.email}
                </span>
              </div>
            </Link>
            <div className={styles.profilePanelActions}>
              <Link
                href="/admin/profile"
                className={styles.profileMenuLink}
                onClick={navigate}
                aria-current={pathname === '/admin/profile' ? 'page' : undefined}
              >
                <CircleUserRound size={18} strokeWidth={1.5} aria-hidden="true" />
                <span>My profile</span>
              </Link>
            </div>
            <div className={styles.profilePanelFooter}>
              <button
                type="button"
                className={`${styles.profileMenuLink} ${styles.profileSignOut}`}
                onClick={() => void signOut({ callbackUrl: '/admin?signed-out=1' })}
              >
                <LogOut size={18} strokeWidth={1.5} aria-hidden="true" />
                <span>Sign out</span>
              </button>
            </div>
          </section>
        )}
      </div>
    </nav>
  );
}
