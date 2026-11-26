import 'server-only';
import { AdminError } from './errors';
import {
  canDo,
  canOpenPage,
  requirementFor,
  type AdminAction,
  type AdminPage,
} from './permissions';

/** The message every refused request carries; the reason stays in the server log only. */
export const NO_ACCESS_MESSAGE = "You don't have access to this. Ask a super administrator.";

/**
 * Throws 403 unless the role may open the page and take the action (lib/admin/permissions.ts).
 * `owner` is kept for older callers and means the super administrator role. Kept apart from
 * ./access so the service layer and its tests can use it without the sign-in machinery.
 */
export function assertAccess(
  role: string,
  options: { owner?: boolean; page?: AdminPage; action?: AdminAction },
) {
  if (
    (options.owner && role !== 'SUPERADMIN') ||
    (options.page && !canOpenPage(role, options.page)) ||
    (options.action && !canDo(role, options.action))
  )
    throw new AdminError(NO_ACCESS_MESSAGE, 403);
}

/** Refuses a read of an unknown section (404) or one the role may not open (403). */
export function assertSectionAccess(role: string, section: string, op?: string | null) {
  const requirement = requirementFor(section, op);
  if (!requirement.page) throw new AdminError('This admin section does not exist.', 404);
  assertAccess(role, {
    page: requirement.page,
    ...(requirement.action ? { action: requirement.action } : {}),
  });
}
