/**
 * Who may open which admin page and take which sensitive action: the one place to change access
 * (docs/admin-panel.md, "Roles and access"). The sidebar, the page guards, the API routes, the
 * service layer and the buttons all read these tables, so a change here applies everywhere.
 *
 * Two staff roles exist (prisma/schema.prisma `Role`): SUPERADMIN, the venue owner's top role, and
 * ADMIN for daily work. Pure data and functions, safe to import in server and browser code.
 */
export const ADMIN_ROLES = ['ADMIN', 'SUPERADMIN'] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

const EVERY_ADMIN = ['ADMIN', 'SUPERADMIN'] as const satisfies readonly AdminRole[];
const SUPER_ADMIN = ['SUPERADMIN'] as const satisfies readonly AdminRole[];

/** Admin pages by their route key (the sidebar keys in components/admin/navigation.ts). */
export const PAGE_ACCESS = {
  dashboard: EVERY_ADMIN,
  bookings: EVERY_ADMIN,
  'front-desk': EVERY_ADMIN,
  calendar: EVERY_ADMIN,
  contracts: EVERY_ADMIN,
  payments: EVERY_ADMIN,
  inquiries: EVERY_ADMIN,
  'live-chat': EVERY_ADMIN,
  zeni: EVERY_ADMIN,
  services: EVERY_ADMIN,
  analytics: EVERY_ADMIN,
  profile: EVERY_ADMIN,
  team: SUPER_ADMIN,
  automation: SUPER_ADMIN,
  logs: SUPER_ADMIN,
  settings: SUPER_ADMIN,
} as const satisfies Record<string, readonly AdminRole[]>;
export type AdminPage = keyof typeof PAGE_ACCESS;

/** Sensitive actions inside pages that both roles can open. */
export const ACTION_ACCESS = {
  /** Voiding a recorded cash receipt (the system has no refunds of its own). */
  'void-receipt': SUPER_ADMIN,
  /** Downloads of business data: the Reports CSV and the settings export. */
  'export-data': SUPER_ADMIN,
  /** Inviting staff, changing roles, disabling and re-enabling accounts. */
  'manage-team': SUPER_ADMIN,
  /** Venue policy and the system preferences under Settings. */
  'change-settings': SUPER_ADMIN,
  /** Running queued emails now, retrying failed ones and pausing automations. */
  'run-automation': SUPER_ADMIN,
  /** Adding and editing event categories and packages (prices are a business decision). */
  'edit-packages': SUPER_ADMIN,
  /** Verifying or rejecting payment screenshots and recording cash. */
  'verify-payments': EVERY_ADMIN,
  /**
   * Seeing, requesting, reviewing, taking and removing clients' optional arrival photos
   * (docs/client-photos.md): staff who handle bookings, visits and the Front desk.
   */
  'client-photos': EVERY_ADMIN,
} as const satisfies Record<string, readonly AdminRole[]>;
export type AdminAction = keyof typeof ACTION_ACCESS;

export function isAdminRole(role: unknown): role is AdminRole {
  return role === 'ADMIN' || role === 'SUPERADMIN';
}

export function isAdminPage(page: string): page is AdminPage {
  return Object.prototype.hasOwnProperty.call(PAGE_ACCESS, page);
}

/** Whether this role may open the page. Unknown pages and roles are refused. */
export function canOpenPage(role: string | null | undefined, page: string) {
  return isAdminRole(role) && isAdminPage(page) && PAGE_ACCESS[page].some((r) => r === role);
}

/** Whether this role may take the action. Unknown actions and roles are refused. */
export function canDo(role: string | null | undefined, action: AdminAction) {
  return isAdminRole(role) && ACTION_ACCESS[action].some((r) => r === role);
}

/** Pages only a super administrator may open, for menus, notices and tests. */
export const SUPER_ADMIN_PAGES = (Object.keys(PAGE_ACCESS) as AdminPage[]).filter(
  (page) => !canOpenPage('ADMIN', page),
);

/** Actions only a super administrator may take. */
export const SUPER_ADMIN_ACTIONS = (Object.keys(ACTION_ACCESS) as AdminAction[]).filter(
  (action) => !canDo('ADMIN', action),
);

/**
 * What an API request needs, by admin section and operation (app/api/admin/[section]/route.ts).
 * Reads need the section's page; operations listed here also need their action. Internal sections
 * that every admin page uses map to the dashboard.
 */
const SECTION_PAGE: Record<string, AdminPage> = {
  preferences: 'dashboard',
  'website-activity': 'dashboard',
  notifications: 'dashboard',
};

const OPERATION_ACTION: Record<string, AdminAction> = {
  'void-receipt': 'void-receipt',
  settings: 'change-settings',
  preferences: 'change-settings',
  'catalog-category': 'edit-packages',
  'catalog-package': 'edit-packages',
  'cash-receipt': 'verify-payments',
  'verify-proof': 'verify-payments',
  'reject-proof': 'verify-payments',
  'client-photo-review': 'client-photos',
  'client-photo-request': 'client-photos',
  'client-photo-remove': 'client-photos',
  'team-invite': 'manage-team',
  'team-resend': 'manage-team',
  'team-role': 'manage-team',
  'team-status': 'manage-team',
};

export type AccessRequirement = { page: AdminPage | null; action: AdminAction | null };

export function requirementFor(section: string, op?: string | null): AccessRequirement {
  const page = SECTION_PAGE[section] ?? (isAdminPage(section) ? section : null);
  return { page, action: op ? (OPERATION_ACTION[op] ?? null) : null };
}

/** Whether the role meets a requirement; a section that maps to no page is refused. */
export function meets(role: string | null | undefined, requirement: AccessRequirement) {
  if (!requirement.page || !canOpenPage(role, requirement.page)) return false;
  return !requirement.action || canDo(role, requirement.action);
}
