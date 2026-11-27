'use client';

import { useEffect, useEffectEvent, useRef, useState, type MouseEvent } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import useSWR, { mutate as refreshCache } from 'swr';
import {
  ArrowUpRight,
  Bell,
  CalendarCheck,
  CalendarClock,
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
import type { AdminNotificationLook, AdminNotificationSummary } from './types';
import styles from './admin.module.css';
import AdminAvatar from './AdminAvatar';
import { useAdminTheme } from './AdminPreferencesProvider';
import { Button, IconButton } from '@/components/shared/Button';
import { afterLook, type SeenTarget } from '@/lib/admin/header-numbers';

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
  calendar: CalendarClock,
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
  const { theme, toggleTheme } = useAdminTheme();
  const [panel, setPanel] = useState<'notifications' | 'profile' | null>(null);
  const controlsRef = useRef<HTMLElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);
  const notificationPanelRef = useRef<HTMLElement>(null);
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
  // Both numbers count only what came in since this admin last opened the bell or Messages
  // (docs/admin-panel.md, "Header numbers"); the lists themselves stay until the work is done.
  const unseen = error ? 0 : (data?.unseen ?? 0);
  const newInquiries = error ? 0 : (data?.newMessages ?? 0);
  /** The notices the last opening of the bell revealed, marked "New" while the panel is open. */
  const [shownNew, setShownNew] = useState<ReadonlySet<string>>(() => new Set());
  const markedNew = notifications.filter((notice) => notice.isNew || shownNew.has(notice.id));

  /**
   * Saves this admin's look at the bell, Messages or both, and clears that number at once. The
   * reply is the summary read at the moment of the look, so anything that arrived since the last
   * refresh appears too, marked "New".
   */
  function look(target: SeenTarget) {
    const mark = (wasNew: string[]) => {
      if (target === 'bell') setShownNew(new Set(wasNew));
      if (target === 'all') setShownNew(new Set());
    };
    if (data) {
      const { wasNew, ...after } = afterLook(data, target);
      mark(wasNew);
      void mutate(after, { revalidate: false });
    }
    void fetch('/api/admin/notifications/seen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target }),
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        const { wasNew, ...after } = body as AdminNotificationLook;
        mark(wasNew);
        await mutate(after, { revalidate: false });
      })
      // An unsaved look changes nothing on the server; the refresh shows the number again.
      .catch(() => void mutate());
  }

  // Arriving on Messages is a look, however the page was opened, because its list loads fresh
  // then. An inquiry that comes in while the page stays open keeps its number until the envelope
  // is used, which reloads the list.
  const onInquiries = pathname === '/admin/inquiries';
  const hasSummary = data !== undefined;
  const lookOnArrival = useEffectEvent(() => {
    if (newInquiries > 0) look('messages');
  });
  useEffect(() => {
    if (onInquiries && hasSummary) lookOnArrival();
  }, [onInquiries, hasSummary]);
  /** One badge style for both header icons; long counts stop at 99+. */
  const badge = (count: number) => (
    <span className={styles.headerBadge} aria-hidden="true">
      {count > 99 ? '99+' : count}
    </span>
  );

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
          <Sun size={20} aria-hidden="true" />
        ) : (
          <Moon size={20} aria-hidden="true" />
        )}
      </button>
      <div className={styles.accountPopoverAnchor}>
        <button
          ref={bellRef}
          type="button"
          className={styles.headerIcon}
          aria-label={`Notifications${unseen ? `, ${unseen} new` : ''}`}
          data-tip="Notifications"
          aria-expanded={activePanel === 'notifications'}
          aria-controls="admin-notification-panel"
          onClick={() => {
            const opening = panel !== 'notifications';
            setPanel(opening ? 'notifications' : null);
            if (opening && !user.mustChangePassword) look('bell');
          }}
        >
          <Bell size={20} aria-hidden="true" />
          {unseen > 0 && badge(unseen)}
        </button>
        {activePanel === 'notifications' && (
          <section
            ref={notificationPanelRef}
            id="admin-notification-panel"
            className={`${styles.accountPopover} ${styles.notificationsPanel}`}
            aria-label="Notifications"
            tabIndex={-1}
          >
            <div className={styles.popoverHeading}>
              <div>
                <h2>Notifications</h2>
                <p>Items needing your attention</p>
              </div>
              <IconButton
                type="button"
                label="Close notifications"
                tooltipAlign="end"
                icon={<X aria-hidden="true" />}
                onClick={() => {
                  setPanel(null);
                  bellRef.current?.focus();
                }}
              />
            </div>
            <div className={styles.notificationList} aria-live="polite" aria-busy={isLoading}>
              {user.mustChangePassword ? (
                <div className={styles.notificationEmpty}>
                  <ShieldCheck size={20} aria-hidden="true" />
                  <strong>Secure your account</strong>
                  <p>Change your password in your profile to view operational updates.</p>
                  <Link href="/admin/profile" onClick={navigate}>
                    Open my profile <ArrowUpRight size={16} aria-hidden="true" />
                  </Link>
                </div>
              ) : error ? (
                <div className={styles.notificationEmpty} role="status">
                  <TriangleAlert size={20} aria-hidden="true" />
                  <strong>Notifications are unavailable</strong>
                  <p>{error.message}</p>
                  <Button type="button" variant="ghost" onClick={() => void mutate()}>
                    <RefreshCw size={16} aria-hidden="true" /> Try again
                  </Button>
                </div>
              ) : isLoading ? (
                <div className={styles.notificationEmpty} role="status">
                  <RefreshCw size={20} aria-hidden="true" />
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
                        <Icon size={20} aria-hidden="true" />
                      </span>
                      <span className={styles.notificationText}>
                        <strong>
                          {notice.title}
                          {markedNew.includes(notice) && (
                            <span className={styles.notificationNew}>New</span>
                          )}
                        </strong>
                        <span>{notice.message}</span>
                      </span>
                      <ArrowUpRight
                        size={16}
                        className={styles.notificationArrow}
                        aria-hidden="true"
                      />
                    </Link>
                  );
                })
              ) : (
                <div className={styles.notificationEmpty}>
                  <CheckCheck size={20} aria-hidden="true" />
                  <strong>You’re all caught up</strong>
                  <p>No items need your attention right now.</p>
                </div>
              )}
            </div>
            <div className={styles.popoverFooter}>
              {markedNew.length > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  icon={<CheckCheck aria-hidden="true" />}
                  onClick={() => {
                    // The button goes once nothing is marked: keep the keyboard in the panel.
                    notificationPanelRef.current?.focus();
                    look('all');
                  }}
                >
                  Mark all as read
                </Button>
              ) : (
                'Updates automatically while you work'
              )}
            </div>
          </section>
        )}
      </div>
      <Link
        href="/admin/inquiries"
        className={`${styles.headerIcon} ${styles.messagesLink}`}
        onClick={(event) => {
          // On Messages already, the envelope reloads its list, which counts as a look.
          if (onInquiries) {
            void refreshCache(
              (key) => typeof key === 'string' && key.startsWith('/api/admin/inquiries'),
            );
            if (newInquiries > 0) look('messages');
          }
          navigate(event);
        }}
        aria-label={
          newInquiries
            ? `Messages, ${newInquiries} new ${newInquiries === 1 ? 'inquiry' : 'inquiries'}`
            : 'Messages'
        }
        data-tip="Messages"
        aria-current={pathname === '/admin/inquiries' ? 'page' : undefined}
      >
        <Mail size={20} aria-hidden="true" />
        {newInquiries > 0 && badge(newInquiries)}
      </Link>

      {/* Separates the page tools from the account. */}
      <span className={styles.headerDivider} aria-hidden="true" />
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
                <CircleUserRound size={20} aria-hidden="true" />
                <span>My profile</span>
              </Link>
            </div>
            <div className={styles.profilePanelFooter}>
              <button
                type="button"
                className={`${styles.profileMenuLink} ${styles.profileSignOut}`}
                onClick={() => void signOut({ callbackUrl: '/admin?signed-out=1' })}
              >
                <LogOut size={20} aria-hidden="true" />
                <span>Sign out</span>
              </button>
            </div>
          </section>
        )}
      </div>
    </nav>
  );
}
