import 'server-only';

import { applicationUrl } from '@/lib/automation/config';
import { idFromSignedToken, signedToken } from '@/lib/signed-link';

/**
 * The private page where a visitor reschedules or cancels their ocular visit (docs/visits.md):
 * /visit/manage/<visit id>.<signature> (lib/signed-link.ts), sent only to the visitor's email.
 */
const PURPOSE = 'zentra-visit-manage-link:v1';

export function visitManageToken(visitId: string) {
  return signedToken(PURPOSE, visitId);
}

/** The visit id a manage link token stands for, or null when the token is not genuine. */
export function visitIdFromManageToken(token: string) {
  return idFromSignedToken(PURPOSE, token);
}

/** The page's path, or null when AUTH_SECRET is missing, so a saved visit never fails on it. */
export function visitManagePath(visitId: string) {
  try {
    return `/visit/manage/${visitManageToken(visitId)}`;
  } catch {
    return null;
  }
}

/** The absolute link for emails, or null without the site's public address or AUTH_SECRET. */
export function visitManageUrl(visitId: string) {
  const origin = applicationUrl();
  const path = visitManagePath(visitId);
  return origin && path ? `${origin}${path}` : null;
}
