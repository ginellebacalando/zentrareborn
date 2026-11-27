/**
 * Links between the booking lists and each booking's own page (/admin/bookings/[reference]).
 * Opening a booking from a list remembers the list's address (with its filters) and scroll
 * position, so "← Bookings" returns to the same place. Session storage may be unavailable, for
 * example in a private window; the links still work without it.
 */
const RETURN_KEY = 'zentra-admin-list-return';

export type BookingTab = 'overview' | 'payments' | 'agreements' | 'activity';

type ListReturn = { path: string; y: number; reference: string };

export function bookingPagePath(reference: string, tab?: BookingTab) {
  const query = tab && tab !== 'overview' ? `?tab=${tab}` : '';
  return `/admin/bookings/${encodeURIComponent(reference)}${query}`;
}

function readReturn(): ListReturn | null {
  try {
    const stored = JSON.parse(sessionStorage.getItem(RETURN_KEY) ?? 'null') as ListReturn | null;
    return stored?.path?.startsWith('/admin/') ? stored : null;
  } catch {
    // Storage unavailable or unreadable: behave as if nothing was remembered.
    return null;
  }
}

export function rememberListPosition(reference: string) {
  try {
    const value: ListReturn = {
      path: `${window.location.pathname}${window.location.search}`,
      y: Math.round(window.scrollY),
      reference,
    };
    sessionStorage.setItem(RETURN_KEY, JSON.stringify(value));
  } catch {
    // Without storage, "← Bookings" opens the full list instead.
  }
}

/** Where "← Bookings" leads, and whether going back in history returns to that list. */
export function listReturn(reference: string) {
  const stored = readReturn();
  return {
    href: stored?.path ?? '/admin/bookings',
    viaHistory: stored?.reference === reference,
  };
}

/** Scrolls a list back to where staff left it, once, after its rows have loaded. */
export function restoreListPosition() {
  const stored = readReturn();
  if (!stored || stored.path !== `${window.location.pathname}${window.location.search}`) return;
  try {
    sessionStorage.removeItem(RETURN_KEY);
  } catch {
    // The position is restored anyway; it may be restored again on a later visit.
  }
  requestAnimationFrame(() => window.scrollTo(0, stored.y));
}
