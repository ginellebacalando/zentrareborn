import type { NavGroup, NavItem } from '@/config/navigation';

export function isNavGroup(item: NavItem): item is NavGroup {
  return 'links' in item;
}

/** True when the visitor is on one of the group's pages, for example any event package page. */
export function isGroupCurrent(pathname: string, group: NavGroup): boolean {
  return group.links.some((link) => link.href === pathname);
}
