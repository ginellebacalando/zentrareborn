/**
 * The admin header's numbers (docs/admin-panel.md, "Header numbers"): the bell counts the notices
 * that came in since this admin last opened it, Messages the inquiries that came in since they
 * last opened Messages. Browser-safe, so the header clears a number at once by the server's rule.
 */

/** What an admin looked at: the bell, Messages, or both ("Mark all as read"). */
export type SeenTarget = 'bell' | 'messages' | 'all';
export const SEEN_TARGETS = ['bell', 'messages', 'all'] as const satisfies readonly SeenTarget[];

/**
 * Whether something is new to this admin: it arrived after their last look, or they never looked.
 * Something without a time (the policy review) is new only until the first look.
 */
export function isNewSince(arrivedAt: Date | null, seenAt: Date | null) {
  if (!seenAt) return true;
  return arrivedAt !== null && arrivedAt > seenAt;
}

type HeaderNumbers = {
  notifications: { id: string; isNew: boolean }[];
  /** The bell's number. */
  unseen: number;
  /** The Messages number. */
  newMessages: number;
};

/**
 * The header right after a look: an opened bell has nothing new left and opened Messages no new
 * inquiries. `wasNew` names the notices the look revealed, which the open panel marks "New".
 */
export function afterLook<S extends HeaderNumbers>(
  summary: S,
  target: SeenTarget,
): S & { wasNew: string[] } {
  const bell = target !== 'messages';
  return {
    ...summary,
    notifications: bell
      ? summary.notifications.map((notice) => ({ ...notice, isNew: false }))
      : summary.notifications,
    unseen: bell ? 0 : summary.unseen,
    newMessages: target === 'bell' ? summary.newMessages : 0,
    wasNew: bell
      ? summary.notifications.filter((notice) => notice.isNew).map((notice) => notice.id)
      : [],
  };
}
