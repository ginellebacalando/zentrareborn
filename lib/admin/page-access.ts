import 'server-only';
import { forbidden, redirect } from 'next/navigation';
import { currentAdmin } from './access';
import { canOpenPage, type AdminPage } from './permissions';

/**
 * The signed-in administrator for an admin page. Signed-out visitors go to sign-in, a required
 * password change comes first, and a role that may not open the page gets the "You don't have
 * access" screen with a 403 status (app/admin/(panel)/forbidden.tsx, lib/admin/permissions.ts).
 */
export async function adminPageActor(page: AdminPage) {
  const actor = await currentAdmin();
  if (!actor) redirect('/admin');
  if (actor.mustChangePassword && page !== 'profile') redirect('/admin/profile');
  if (!canOpenPage(actor.role, page)) forbidden();
  return actor;
}
