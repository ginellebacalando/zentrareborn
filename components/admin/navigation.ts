/**
 * Sidebar destinations. Labels follow the ZENTRA naming rules (plural, non-repeating module
 * names); the route slugs are unchanged, so bookmarks keep working:
 * services → Packages, analytics → Reports, logs → Activity log.
 * Zeni and Automation are owned by their own route folders (app/admin/(panel)/zeni|automation).
 */
export const adminModules = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'bookings', label: 'Bookings' },
  { key: 'contracts', label: 'Contracts' },
  { key: 'calendar', label: 'Calendar' },
  { key: 'inquiries', label: 'Inquiries' },
  { key: 'live-chat', label: 'Live chat' },
  { key: 'payments', label: 'Payments' },
  { key: 'services', label: 'Packages' },
  { key: 'zeni', label: 'Zeni' },
  { key: 'analytics', label: 'Reports' },
  { key: 'team', label: 'Team' },
] as const;

/** Pinned to the bottom of the sidebar; Activity log stays directly above Settings. */
export const adminFooterModules = [
  { key: 'automation', label: 'Automation' },
  { key: 'logs', label: 'Activity log' },
  { key: 'settings', label: 'Settings' },
] as const;

export type AdminModuleKey =
  (typeof adminModules)[number]['key'] | (typeof adminFooterModules)[number]['key'];

const pageLabels: Record<string, string> = Object.fromEntries([
  ...[...adminModules, ...adminFooterModules].map(({ key, label }) => [key, label]),
  ['profile', 'My profile'],
]);

/** The page's visually hidden h1 equals its sidebar label (naming rule 2). */
export function adminPageLabel(section: string) {
  return pageLabels[section] ?? 'Admin';
}

export function isActiveModule(pathname: string, key: string) {
  const href = `/admin/${key}`;
  return pathname === href || pathname.startsWith(`${href}/`);
}
