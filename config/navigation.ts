/**
 * Public navigation. The items and labels are the team's original menu, unchanged; only the
 * layout follows the Figma header (a row of links under the ZENTRA wordmark, no menu button).
 */
export type NavLink = {
  label: string;
  href: string;
};

/** A header item that opens a short list of links, like the original "Packages" submenu. */
export type NavGroup = {
  label: string;
  links: readonly NavLink[];
};

export type NavItem = NavLink | NavGroup;

export const PACKAGE_LINKS: readonly NavLink[] = [
  { label: 'Weddings', href: '/events/weddings' },
  { label: 'Debuts', href: '/events/debuts' },
  { label: 'Christening', href: '/events/christening' },
  { label: 'Birthdays', href: '/events/birthdays' },
  { label: 'Gender Reveal', href: '/events/gender-reveal' },
  { label: 'Christmas Party', href: '/events/christmas-party' },
];

/** The original menu, in its original order. */
export const MAIN_NAV: readonly NavItem[] = [
  { label: 'Home', href: '/' },
  { label: 'Packages', links: PACKAGE_LINKS },
  { label: 'Gallery', href: '/gallery' },
  { label: 'About Us', href: '/about' },
  { label: 'Facilities', href: '/facilities' },
  { label: 'Testimonies', href: '/testimonies' },
  { label: 'Contact Us', href: '/contact' },
  { label: 'FAQ', href: '/faq' },
];

export const BOOK_LINK: NavLink = { label: 'Book Now', href: '/booking' };

/** The original footer list. */
export const FOOTER_LINKS: readonly NavLink[] = [
  { label: 'Home', href: '/' },
  { label: 'Packages', href: '/events/weddings' },
  { label: 'Gallery', href: '/gallery' },
  { label: 'About Us', href: '/about' },
  { label: 'Facilities', href: '/facilities' },
  { label: 'Testimonies', href: '/testimonies' },
  { label: 'FAQ', href: '/faq' },
  { label: 'Contact Us', href: '/contact' },
];
