const ADDRESS_QUERY =
  '82MH+QPG, United Bayanihan Proper Rd, United Bayanihan, San Pedro, 4023 Laguna';
const MAPS_QUERY = encodeURIComponent('Zion Events Place, San Pedro, Laguna');

export const BRAND = {
  name: 'Zion',
  legalName: 'Zion Events Place',
  nameUpper: 'ZION EVENTS PLACE',
  shortName: 'Zion',
  tagline: "Celebrate life's best moments with the view you'll always remember.",
  venueType: 'Event Place & Management',
  logo: {
    src: '/zion-logo.png',
    markSrc: '/zion-logo.png',
    exportSrc: '/zion-logo.png',
    alt: 'Zion Events Place logo',
  },
  assets: {
    publicFolder: '/zion-media',
  },
  contact: {
    email: 'zioneventsplace@gmail.com',
    emailHref: 'mailto:zioneventsplace@gmail.com',
    phone: '0912 345 6789',
    phoneHref: 'tel:09123456789',
  },
  address: {
    full: ADDRESS_QUERY,
    lines: [
      '82MH+QPG, United Bayanihan Proper Rd',
      'United Bayanihan, San Pedro',
      '4023 Laguna',
    ],
  },
  maps: {
    embedUrl: `https://www.google.com/maps?q=${MAPS_QUERY}&output=embed`,
    directionsUrl: `https://www.google.com/maps/search/?api=1&query=${MAPS_QUERY}`,
  },
  social: [
    { label: 'Facebook', handle: 'Facebook', href: 'https://www.facebook.com/' },
    { label: 'Instagram', handle: 'Instagram', href: 'https://www.instagram.com/' },
    { label: 'TikTok', handle: 'TikTok', href: 'https://www.tiktok.com/' },
  ],
  directions: [
    "When coming up from United Bayanihan, don't go straight. Turn at the San Pedro Transport Cooperative / Former HBC Jeepney Terminal and continue toward R. Berroya Street.",
    'From R. Berroya Street, pass Oliver, continue along San Vicente Road, then follow the route through Narra and Kerimoto.',
    'From PUP San Pedro Campus or SM Supermarket, follow United Bayanihan Proper Road to the Zion Events Place entrance.',
  ],
} as const;

export function brandAsset(fileName: string) {
  return `${BRAND.assets.publicFolder}/${encodeURIComponent(fileName)}`;
}
