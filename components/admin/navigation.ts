/**
 * Sidebar destinations, in themed groups so the list reads at a glance (docs/admin-design.md).
 * Labels follow the ZENTRA naming rules (plural, non-repeating module names); the route slugs are
 * unchanged, so bookmarks keep working: services → Packages, analytics → Reports, logs → Activity
 * log. Zeni, Front desk and Automation are owned by their own route folders
 * (app/admin/(panel)/zeni|front-desk|automation).
 */
export const adminModuleGroups = [
  { label: '', modules: [{ key: 'dashboard', label: 'Dashboard' }] },
  {
    label: 'Events',
    modules: [
      { key: 'bookings', label: 'Bookings' },
      // Ocular visits and today's agenda (app/admin/(panel)/front-desk, docs/visits.md).
      { key: 'front-desk', label: 'Front desk' },
      { key: 'calendar', label: 'Calendar' },
      { key: 'contracts', label: 'Contracts' },
      { key: 'payments', label: 'Payments' },
    ],
  },
  {
    label: 'Clients',
    modules: [
      { key: 'inquiries', label: 'Inquiries' },
      { key: 'live-chat', label: 'Live chat' },
      { key: 'zeni', label: 'Zeni' },
    ],
  },
  {
    label: 'Business',
    modules: [
      { key: 'services', label: 'Packages' },
      { key: 'analytics', label: 'Reports' },
      { key: 'team', label: 'Team' },
    ],
  },
] as const;

type AdminModule = (typeof adminModuleGroups)[number]['modules'][number];

export const adminModules: readonly AdminModule[] = adminModuleGroups.flatMap(
  (group): readonly AdminModule[] => group.modules,
);

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

/** The page's h1 equals its sidebar label (naming rule 2). */
export function adminPageLabel(section: string) {
  return pageLabels[section] ?? 'Admin';
}

export function isActiveModule(pathname: string, key: string) {
  const href = `/admin/${key}`;
  return pathname === href || pathname.startsWith(`${href}/`);
}
