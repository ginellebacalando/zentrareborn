export type FacilityIcon =
  | 'Camera'
  | 'MonitorPlay'
  | 'Snowflake'
  | 'Sparkles'
  | 'Sunset'
  | 'TreePine'
  | 'UsersRound'
  | 'Waves'
  | 'Wine';
type FacilityFeature = {
  icon: FacilityIcon;
  label: string;
};

export type PublicFacilitySpace = {
  id: 'selah-hall' | 'pavilion-garden' | 'pool';
  sourceSlugs: readonly string[];
  number: string;
  name: string;
  category: string;
  description: string;
  imageSrc: string;
  imageAlt: string;
  isNew?: boolean;
  features: readonly FacilityFeature[];
};

export const publicFacilities: readonly PublicFacilitySpace[] = [
  {
    id: 'selah-hall',
    sourceSlugs: ['selah-hall', 'the-selah-hall', 'the-glass-hall'],
    number: '01',
    name: 'Selah Hall',
    category: 'Signature indoor venue',
    description:
      'An elegant indoor venue with panoramic views, air-conditioned comfort, a built-in LED wall, and space for up to 100 guests—beautifully designed for celebrations in any weather.',
    imageSrc: '/images/about/about-story-2.webp',
    imageAlt: 'Elegant interior of Selah Hall prepared for a formal celebration',
    isNew: true,
    features: [
      { icon: 'Snowflake', label: 'Air-conditioned comfort' },
      { icon: 'MonitorPlay', label: 'Built-in LED wall' },
      { icon: 'UsersRound', label: 'Up to 100 guests' },
      { icon: 'Sunset', label: 'Panoramic views' },
    ],
  },
  {
    id: 'pavilion-garden',
    sourceSlugs: ['pavilion-garden', 'the-pavilion-garden'],
    number: '02',
    name: 'Pavilion Garden',
    category: 'Scenic outdoor venue',
    description:
      'The Pavilion Garden offers a versatile outdoor setting perfect for wedding ceremonies, cocktail hour, and intimate celebrations—all with our signature overlooking skyline as your backdrop.',
    imageSrc: '/images/venue/venue-view.webp',
    imageAlt: 'Pavilion Garden ceremony setup overlooking the skyline at sunset',
    features: [
      { icon: 'TreePine', label: 'Open-air garden' },
      { icon: 'Wine', label: 'Cocktail-ready setting' },
      { icon: 'Sunset', label: 'Signature skyline view' },
      { icon: 'Sparkles', label: 'Flexible styling' },
    ],
  },
  {
    id: 'pool',
    sourceSlugs: ['pool', 'the-pool', 'pool-and-grounds', 'the-pool-and-grounds'],
    number: '03',
    name: 'The Pool & Scenic Grounds',
    category: 'Relaxed outdoor setting',
    description:
      'An inviting waterside setting with scenic skyline views, a relaxed open-air atmosphere, and picture-perfect surroundings—ideal for cocktail moments, portraits, intimate gatherings, and polished celebrations beneath the open sky.',
    imageSrc: '/images/venue/zion-pool-sunset.webp',
    imageAlt: 'The Zion swimming pool and scenic outdoor grounds at sunset',
    features: [
      { icon: 'Waves', label: 'Waterside atmosphere' },
      { icon: 'Camera', label: 'Picture-perfect backdrop' },
      { icon: 'Sunset', label: 'Open-sky views' },
      { icon: 'UsersRound', label: 'Intimate gatherings' },
    ],
  },
] as const;
