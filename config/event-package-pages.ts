import { optimizedPublicMediaPath } from '@/lib/public-media';

export const EVENT_PACKAGE_MEDIA_ROOTS = ['/images/'] as const;

export type EventPackageMediaKey =
  'weddings' | 'birthdays' | 'debuts' | 'christmasParty' | 'christening' | 'genderReveal';

export type EventPackageImage = {
  src: string;
  alt: string;
};

export type EventPackageHeroSlide = EventPackageImage & {
  title: string;
  subtitle: string;
  imageSrc: string;
  imageAlt: string;
};

export type EventPackageContentBlock = {
  text: string;
  image: EventPackageImage;
  secondaryImage?: EventPackageImage;
  imagePosition: 'left' | 'right';
};

type EventPackagePageDefinition = {
  heroKey: EventPackageMediaKey;
  heroEyebrow: string;
  heroTitle: string;
  heroSubtitle: string;
  experienceHeading: string;
  experienceSubtitle: string;
  heroVideoSrc?: string;
  eventCategorySlug: string;
  contentBlocks: readonly EventPackageContentBlock[];
  packageText: string;
  heroSlides: readonly [
    EventPackageHeroSlide,
    EventPackageHeroSlide,
    EventPackageHeroSlide,
    EventPackageHeroSlide,
  ];
  galleryImages: readonly EventPackageImage[];
  packageCardImages: readonly EventPackageImage[];
};

function heroSlide(
  title: string,
  subtitle: string,
  image: EventPackageImage,
): EventPackageHeroSlide {
  return {
    title,
    subtitle,
    src: optimizedPublicMediaPath(image.src),
    alt: image.alt,
    imageSrc: optimizedPublicMediaPath(image.src),
    imageAlt: image.alt,
  };
}

export const eventPackagePages = {
  weddings: {
    heroKey: 'weddings',
    heroEyebrow: 'Wedding Packages',
    heroTitle: 'A Timeless Beginning',
    heroSubtitle:
      'Exchange your vows and celebrate your love story in an elevated sanctuary framed by the panoramic views of San Pedro City.',
    experienceHeading: 'THE WEDDING EXPERIENCE',
    experienceSubtitle: 'From heartfelt vows to an unforgettable evening reception.',
    heroVideoSrc: '/videos/events/weddings-hero.mp4',
    eventCategorySlug: 'wedding-reception',
    heroSlides: [
      heroSlide(
        'A Beautiful Beginning',
        'Exchange your vows in a setting designed to honor the heart of your love story.',
        {
          src: '/images/events/weddings/wedding1.webp',
          alt: 'A bride walking toward an outdoor wedding ceremony at Zion Events Place',
        },
      ),
      heroSlide(
        'Your Reception, Reimagined',
        'Gather everyone you love in an elegant space shaped around your celebration.',
        {
          src: '/images/events/weddings/wedding2.webp',
          alt: 'A newly married couple celebrating beneath the evening lights at Zion',
        },
      ),
      heroSlide(
        'Details That Feel Like You',
        'From styling to flow, each element can reflect the personality and story you share.',
        {
          src: '/images/events/weddings/wedding4.webp',
          alt: 'A wedding couple photographed against the panoramic Zion skyline',
        },
      ),
      heroSlide(
        'A Day to Remember Forever',
        'Celebrate your first chapter together against a breathtaking Zion backdrop.',
        {
          src: '/images/events/weddings/wedding7.webp',
          alt: 'A bride and groom surrounded by an elegant outdoor wedding reception',
        },
      ),
    ],
    contentBlocks: [
      {
        text: "Begin your celebration in a setting that can move naturally from a heartfelt ceremony to a polished reception. Zion's adaptable spaces give every part of your wedding room to feel intentional.",
        image: {
          src: '/images/events/weddings/wedding-alt.webp',
          alt: 'An elegant candlelit wedding reception',
        },
        secondaryImage: {
          src: '/images/events/weddings/wedding2-2.webp',
          alt: 'A bride and groom sharing a quiet wedding portrait',
        },
        imagePosition: 'right',
      },
      {
        text: 'Shape the day around your own story with thoughtful styling, meaningful traditions, and spaces where your guests can gather comfortably and celebrate alongside you.',
        image: {
          src: '/images/events/weddings/wedding3.webp',
          alt: 'Newlyweds dancing beneath a floral wedding arch',
        },
        secondaryImage: {
          src: '/images/events/weddings/wedding5.webp',
          alt: 'A wedding couple posing beside the Zion pavilion',
        },
        imagePosition: 'left',
      },
    ],
    packageText:
      'Crafting the beginning of your forever with curated experiences designed for your unique love story.',
    galleryImages: [
      {
        src: '/images/events/weddings/wedding6.webp',
        alt: 'A bride and groom walking together after their ceremony',
      },
      {
        src: '/images/events/weddings/wedding8.webp',
        alt: 'Newlyweds sharing a romantic moment beneath string lights',
      },
      {
        src: '/images/events/weddings/wedding1-2.webp',
        alt: 'A newly married couple photographed after their vows',
      },
      {
        src: '/images/events/weddings/wedding3-2.webp',
        alt: 'A bride entering an outdoor wedding ceremony',
      },
      {
        src: '/images/events/weddings/dsc03258.webp',
        alt: 'A couple exchanging vows at the Zion wedding pavilion',
      },
      {
        src: '/images/events/weddings/dsc03592.webp',
        alt: 'Newlyweds celebrating beneath a floral ceremony arch',
      },
      {
        src: '/images/events/weddings/dsc03928.webp',
        alt: 'Wedding guests welcoming the newly married couple',
      },
      {
        src: '/images/events/weddings/dsc04088.webp',
        alt: 'A wedding couple celebrating beneath sparkling evening lights',
      },
    ],
    packageCardImages: [
      {
        src: '/images/events/weddings/dsc04920.webp',
        alt: 'A wedding couple enjoying their evening reception',
      },
      {
        src: '/images/events/weddings/dsc05482.webp',
        alt: 'A bride celebrating with guests during the reception',
      },
      {
        src: '/images/events/weddings/dsc08346.webp',
        alt: 'A bride and groom seated at their outdoor wedding ceremony',
      },
      {
        src: '/images/events/weddings/dsc08381.webp',
        alt: 'A wedding couple photographed in the garden at Zion',
      },
    ],
  },
  birthdays: {
    heroKey: 'birthdays',
    heroEyebrow: 'Birthday Packages',
    heroTitle: 'Celebrate Another Radiant Year',
    heroSubtitle:
      'Turn your milestone birthday into a joyful, styled gathering crafted for laughter, warmth, and unforgettable moments.',
    experienceHeading: 'THE BIRTHDAY EXPERIENCE',
    experienceSubtitle: 'Tailored spaces for playful themes and elegant milestone dinners.',
    heroVideoSrc: '/videos/events/birthdays-hero.mp4',
    eventCategorySlug: 'birthday',
    heroSlides: [
      heroSlide(
        'Celebrate Another Beautiful Year',
        'Turn your birthday into a joyful gathering that feels unmistakably yours.',
        {
          src: '/images/events/debuts-birthdays/birthday.webp',
          alt: 'A colorful themed birthday celebration arranged outdoors at Zion',
        },
      ),
      heroSlide(
        'A Theme Brought to Life',
        'Transform the venue around the colors, details, and energy that inspire you.',
        {
          src: '/images/events/debuts-birthdays/birthday1.webp',
          alt: 'A pink balloon birthday setup at the Zion pavilion',
        },
      ),
      heroSlide(
        'Room for Everyone You Love',
        'Share laughter, food, and meaningful time together in a flexible event space.',
        {
          src: '/images/events/debuts-birthdays/birthday-2.webp',
          alt: 'An elegant indoor birthday dinner prepared for guests',
        },
      ),
      heroSlide(
        'Make This Milestone Unforgettable',
        'Celebrate the people and memories that made this year worth remembering.',
        {
          src: '/images/venue/venue-5.webp',
          alt: 'A festive pink and gold balloon birthday backdrop',
        },
      ),
    ],
    contentBlocks: [
      {
        text: 'Build a birthday celebration around the person at its center, from a playful themed gathering to an elegant milestone dinner with everyone who matters.',
        image: {
          src: '/images/events/debuts-birthdays/birthday.webp',
          alt: 'A bright and playful outdoor birthday party',
        },
        secondaryImage: {
          src: '/images/events/debuts-birthdays/birthday1.webp',
          alt: 'A birthday stage decorated with pink balloons',
        },
        imagePosition: 'right',
      },
      {
        text: "Zion's flexible spaces make room for dining, entertainment, portraits, and unhurried time together, all within one memorable setting.",
        image: {
          src: '/images/events/debuts-birthdays/birthday-2.webp',
          alt: 'A refined indoor venue prepared for a birthday dinner',
        },
        secondaryImage: {
          src: '/images/venue/venue-5.webp',
          alt: 'A balloon-decorated birthday portrait area',
        },
        imagePosition: 'left',
      },
    ],
    packageText:
      'Celebrate another trip around the sun in a space designed for laughter, joy, and unforgettable memories.',
    galleryImages: [
      {
        src: '/images/events/debuts-birthdays/birthday.webp',
        alt: 'A colorful birthday party table arrangement',
      },
      {
        src: '/images/events/debuts-birthdays/birthday1.webp',
        alt: 'A pink themed birthday pavilion setup',
      },
      {
        src: '/images/events/debuts-birthdays/birthday-2.webp',
        alt: 'An elegant birthday banquet setting',
      },
      { src: '/images/venue/venue-5.webp', alt: 'A birthday photo area decorated with balloons' },
    ],
    packageCardImages: [
      {
        src: '/images/events/debuts-birthdays/birthday.webp',
        alt: 'A vibrant outdoor birthday celebration',
      },
      {
        src: '/images/events/debuts-birthdays/birthday1.webp',
        alt: 'A balloon-themed birthday setup',
      },
      {
        src: '/images/events/debuts-birthdays/birthday-2.webp',
        alt: 'A formal birthday dinner setting',
      },
      { src: '/images/venue/venue-5.webp', alt: 'A festive birthday portrait backdrop' },
    ],
  },
  debuts: {
    heroKey: 'debuts',
    heroEyebrow: 'Debut Packages',
    heroTitle: 'Step Into Your Moment',
    heroSubtitle:
      'Mark your eighteenth birthday with a grand celebration filled with grace, confidence, and timeless Zion elegance.',
    experienceHeading: 'THE DEBUT EXPERIENCE',
    experienceSubtitle: 'A coming-of-age evening designed to make every debutant shine.',
    heroVideoSrc: '/videos/events/debut-hero.mp4',
    eventCategorySlug: 'debut',
    heroSlides: [
      heroSlide(
        'Step Into Your Moment',
        'Mark your eighteenth birthday with a celebration filled with confidence, grace, and personality.',
        {
          src: '/images/events/debuts-birthdays/debut1.webp',
          alt: 'A debutant in a formal gown at her Zion celebration',
        },
      ),
      heroSlide(
        'An Entrance Worth Remembering',
        'Set the stage for a grand arrival in a venue created for milestone moments.',
        {
          src: '/images/events/debuts-birthdays/debut3.webp',
          alt: 'A debutant posing in a pink gown above the Zion skyline',
        },
      ),
      heroSlide(
        'Elegance in Every Detail',
        'Bring your chosen theme to life through thoughtful styling and a polished event setting.',
        {
          src: '/images/events/debuts-birthdays/debut-party.webp',
          alt: 'An elaborate floral stage styled for an eighteenth birthday',
        },
      ),
      heroSlide(
        'Your Story Takes Center Stage',
        'Share a joyful evening with family and friends as you begin an exciting new chapter.',
        {
          src: '/images/events/debuts-birthdays/debut9.webp',
          alt: 'A debutant in a pink gown overlooking the city at Zion',
        },
      ),
    ],
    contentBlocks: [
      {
        text: 'Mark this coming-of-age milestone with a grand entrance in a venue designed to make every debutant feel truly extraordinary.',
        image: {
          src: '/images/events/debuts-birthdays/debut4-2.webp',
          alt: 'A debutant making a poised entrance in her purple gown',
        },
        secondaryImage: {
          src: '/images/events/debuts-birthdays/debut7.webp',
          alt: 'A debutant displaying her gown at the scenic overlook',
        },
        imagePosition: 'right',
      },
      {
        text: 'From the traditional 18 roses to lively modern dances, our spaces adapt perfectly to your unique coming-out celebration.',
        image: {
          src: '/images/events/debuts-birthdays/debut11.webp',
          alt: 'A debutant presented at a formally decorated outdoor celebration',
        },
        secondaryImage: {
          src: '/images/events/debuts-birthdays/debut-group.webp',
          alt: 'A debutant seated before her illuminated eighteenth-birthday backdrop',
        },
        imagePosition: 'left',
      },
    ],
    packageText:
      'Step into a new chapter of life with a celebration as radiant and unique as you are.',
    galleryImages: [
      {
        src: '/images/events/debuts-birthdays/debut.webp',
        alt: 'A debutant seated at her floral reception table',
      },
      {
        src: '/images/events/debuts-birthdays/debut3-2.webp',
        alt: 'A formal debut reception setup',
      },
      {
        src: '/images/events/debuts-birthdays/debut5-2.webp',
        alt: 'A debutant posing beside an elegant table arrangement',
      },
      {
        src: '/images/events/debuts-birthdays/debut2.webp',
        alt: 'A debutant in a formal gown at her celebration table',
      },
      {
        src: '/images/events/debuts-birthdays/debut4.webp',
        alt: 'A debutant posing against the panoramic skyline',
      },
      {
        src: '/images/events/debuts-birthdays/debut5.webp',
        alt: 'A debut portrait among the garden greenery',
      },
      {
        src: '/images/events/debuts-birthdays/debut7.webp',
        alt: 'A debutant displaying her gown at the scenic overlook',
      },
      {
        src: '/images/events/debuts-birthdays/debut8.webp',
        alt: 'A modern portrait of a debutant in a blue dress',
      },
    ],
    packageCardImages: [
      {
        src: '/images/events/debuts-birthdays/debut1-2.webp',
        alt: 'A themed debut entrance at Zion',
      },
      {
        src: '/images/events/debuts-birthdays/debut2-2.webp',
        alt: 'The Zion pavilion prepared for a debut celebration',
      },
      {
        src: '/images/events/debuts-birthdays/debut6.webp',
        alt: 'A debutant photographed against the mountain view',
      },
      {
        src: '/images/events/debuts-birthdays/inside-the-incredible-swan-lake-themed-18th-birthday-costing-41-000.webp',
        alt: 'A debutant entering a Swan Lake themed eighteenth-birthday reception',
      },
    ],
  },
  christmasParty: {
    heroKey: 'christmasParty',
    heroEyebrow: 'Christmas Party Packages',
    heroTitle: 'Celebrate the Season Together',
    heroSubtitle:
      'Bring family, friends, or colleagues together for a festive year-end evening filled with holiday warmth and refined dining.',
    experienceHeading: 'THE HOLIDAY EXPERIENCE',
    experienceSubtitle: 'Seasonal elegance for year-end toasts and cherished traditions.',
    eventCategorySlug: 'christmas-party',
    heroSlides: [
      heroSlide(
        'Celebrate the Season Together',
        'Bring family, friends, or colleagues together for an evening filled with holiday warmth.',
        {
          src: '/images/events/holidays/christmas-party.webp',
          alt: 'A Christmas party reception with trees and holiday lights',
        },
      ),
      heroSlide(
        'A Setting Filled With Cheer',
        'Create a polished seasonal atmosphere for good food, laughter, and shared traditions.',
        {
          src: '/images/events/holidays/christmas-party-4.webp',
          alt: 'A Christmas table decorated with poinsettias and warm lights',
        },
      ),
      heroSlide(
        'Toast to the Year Behind You',
        'Recognize milestones and reconnect with the people who made the year meaningful.',
        {
          src: '/images/events/holidays/christmas-party-2.webp',
          alt: 'An elegant Christmas party beneath sparkling holiday decorations',
        },
      ),
      heroSlide(
        'End the Year With a Lasting Memory',
        'Let Zion host a festive finale everyone will carry into the new year.',
        {
          src: '/images/events/holidays/christmas-party-3.webp',
          alt: 'A red Christmas celebration stage with seasonal lighting',
        },
      ),
    ],
    contentBlocks: [
      {
        text: 'Bring your team or family together for a festive celebration that perfectly balances holiday cheer with sophisticated dining.',
        image: {
          src: '/images/events/holidays/christmas-party.webp',
          alt: 'A sophisticated dining room decorated for Christmas',
        },
        secondaryImage: {
          src: '/images/events/holidays/christmas.webp',
          alt: 'A Christmas dining table with red and green place settings',
        },
        imagePosition: 'right',
      },
      {
        text: 'Our versatile venues transform into winter wonderlands, offering the ideal backdrop for year-end reflections and joyful toasts.',
        image: {
          src: '/images/events/holidays/christmas-party-2.webp',
          alt: 'A festive Christmas banquet with illuminated seasonal décor',
        },
        secondaryImage: {
          src: '/images/events/holidays/elegant-christmas-wedding-ideas-for-a-timeless-holiday-celebration.webp',
          alt: 'An elegant holiday table prepared in Christmas colors',
        },
        imagePosition: 'left',
      },
    ],
    packageText:
      'Celebrate the season of giving with unforgettable gatherings that capture the magic of the holidays.',
    galleryImages: [
      {
        src: '/images/events/holidays/christmas-party.webp',
        alt: 'A Christmas reception with festive trees',
      },
      {
        src: '/images/events/holidays/christmas.webp',
        alt: 'A holiday table set in red and green',
      },
      {
        src: '/images/events/holidays/christmas-party-4.webp',
        alt: 'A candlelit Christmas dining arrangement',
      },
      {
        src: '/images/events/holidays/christmas-party-2.webp',
        alt: 'A sparkling Christmas party venue',
      },
      {
        src: '/images/events/holidays/christmas-party-3.webp',
        alt: 'An illuminated red Christmas event stage',
      },
      {
        src: '/images/events/holidays/elegant-christmas-wedding-ideas-for-a-timeless-holiday-celebration.webp',
        alt: 'A refined Christmas table arrangement',
      },
    ],
    packageCardImages: [
      {
        src: '/images/events/holidays/christmas-party.webp',
        alt: 'A venue transformed for a Christmas party',
      },
      {
        src: '/images/events/holidays/christmas-party-4.webp',
        alt: 'An intimate holiday dinner setup',
      },
      {
        src: '/images/events/holidays/christmas-party-2.webp',
        alt: 'A festive year-end celebration setting',
      },
      {
        src: '/images/events/holidays/christmas-party-3.webp',
        alt: 'A Christmas party stage illuminated in red',
      },
    ],
  },
  christening: {
    heroKey: 'christening',
    heroEyebrow: 'Christening Packages',
    heroTitle: 'Welcome a Precious Blessing',
    heroSubtitle:
      'Gather generations in a serene, graceful setting to celebrate your little one’s first milestone with love and warmth.',
    experienceHeading: 'THE CHRISTENING EXPERIENCE',
    experienceSubtitle: 'A gentle, welcoming atmosphere centered on faith and family.',
    eventCategorySlug: 'christening',
    heroSlides: [
      heroSlide(
        'Welcome a Precious Blessing',
        "Celebrate your family's newest chapter in a warm and graceful setting.",
        {
          src: '/images/events/christenings/christening.webp',
          alt: 'Parents celebrating their baby at a christening reception',
        },
      ),
      heroSlide(
        'A Gathering Filled With Love',
        'Bring generations together for a meaningful day centered on faith, family, and joy.',
        {
          src: '/images/events/christenings/christening1.webp',
          alt: 'A family portrait during a child christening celebration',
        },
      ),
      heroSlide(
        'Gentle, Thoughtful Styling',
        'Create a welcoming atmosphere with details chosen for your little one.',
        {
          src: '/images/events/christenings/christening-3.webp',
          alt: 'A softly styled christening dessert table',
        },
      ),
      heroSlide(
        'First Milestones, Lasting Memories',
        'Preserve a beautiful family occasion in a venue made for moments that matter.',
        {
          src: '/images/events/christenings/christening3.webp',
          alt: 'Parents and their child posing at a christening backdrop',
        },
      ),
    ],
    contentBlocks: [
      {
        text: 'Welcome your newest family member in a space that feels both sacred and inviting, perfect for meaningful dedications.',
        image: {
          src: '/images/events/christenings/christening4.webp',
          alt: 'Parents sharing a tender moment with their baby at a christening',
        },
        secondaryImage: {
          src: '/images/events/christenings/christening2.webp',
          alt: 'Parents caring for their child during a family milestone',
        },
        imagePosition: 'right',
      },
      {
        text: 'Gather your closest loved ones for a serene celebration filled with light, joy, and the warmth of family connections.',
        image: {
          src: '/images/events/christenings/christening-2.webp',
          alt: 'A blue and white christening backdrop',
        },
        secondaryImage: {
          src: '/images/events/christenings/christening-4.webp',
          alt: 'A christening venue decorated with soft blue balloons',
        },
        imagePosition: 'left',
      },
    ],
    packageText:
      'A beautiful beginning for your little one, celebrated with elegance and heartfelt moments.',
    galleryImages: [
      {
        src: '/images/events/christenings/christening.webp',
        alt: 'A family celebrating their child at Zion',
      },
      {
        src: '/images/events/christenings/christening1.webp',
        alt: 'A christening family portrait on the lawn',
      },
      {
        src: '/images/events/christenings/christening3.webp',
        alt: 'A family portrait at a christening backdrop',
      },
      {
        src: '/images/events/christenings/christening4.webp',
        alt: 'Parents kissing their baby during the celebration',
      },
      {
        src: '/images/events/christenings/christening5.webp',
        alt: 'Family and godparents gathered for a christening',
      },
      {
        src: '/images/events/christenings/christening-5.webp',
        alt: 'A delicate christening table centerpiece',
      },
      {
        src: '/images/events/christenings/christening-3.webp',
        alt: 'A blue christening dessert arrangement',
      },
      {
        src: '/images/events/christenings/christening-4.webp',
        alt: 'A blue balloon christening venue setup',
      },
    ],
    packageCardImages: [
      {
        src: '/images/events/christenings/christening1.webp',
        alt: 'A joyful christening family portrait',
      },
      {
        src: '/images/events/christenings/christening3.webp',
        alt: 'A child celebrated at a christening reception',
      },
      {
        src: '/images/events/christenings/christening-2.webp',
        alt: 'A modern christening backdrop',
      },
      {
        src: '/images/events/christenings/christening-5.webp',
        alt: 'An elegant christening centerpiece',
      },
    ],
  },
  genderReveal: {
    heroKey: 'genderReveal',
    heroEyebrow: 'Gender Reveal Packages',
    heroTitle: 'A Beautiful Secret to Share',
    heroSubtitle:
      'Gather your favorite people for an intimate, joy-filled reveal framed by effortless styling and breathtaking views.',
    experienceHeading: 'THE GENDER REVEAL EXPERIENCE',
    experienceSubtitle: 'A joyful canvas for life’s sweetest surprise.',
    heroVideoSrc: '/videos/events/gender-reveal.mp4',
    eventCategorySlug: 'gender-reveal',
    heroSlides: [
      heroSlide(
        'A Beautiful Secret to Share',
        'Gather your favorite people for a reveal filled with anticipation and wonder.',
        {
          src: '/images/events/gender-reveals/gender-reveal.webp',
          alt: 'A pink and blue balloon gender reveal backdrop',
        },
      ),
      heroSlide(
        'The Moment Everyone Is Waiting For',
        'Create a joyful reveal moment framed by an elegant and welcoming celebration.',
        {
          src: '/images/events/gender-reveals/gender-reveal-2-2.webp',
          alt: 'Expecting parents celebrating with pink reveal smoke',
        },
      ),
      heroSlide(
        'Celebrate Your Growing Family',
        'Share the excitement of a new chapter with thoughtful details and plenty of room for love.',
        {
          src: '/images/events/gender-reveals/gender-reveal-2.webp',
          alt: 'A pink and blue Oh Baby gender reveal dessert table',
        },
      ),
      heroSlide(
        'A Memory Before Hello',
        'Make the story of your little one special from the very first celebration.',
        {
          src: '/images/events/gender-reveals/gender-reveal-4.webp',
          alt: 'A neutral Boy or Girl gender reveal display',
        },
      ),
    ],
    contentBlocks: [
      {
        text: "Share life's most exciting surprise with family and friends in a joyful, intimate setting perfectly scaled for your reveal.",
        image: {
          src: '/images/events/gender-reveals/gender-reveal.webp',
          alt: 'A blue and pink balloon wall for a gender reveal',
        },
        secondaryImage: {
          src: '/images/events/gender-reveals/gender-reveal-2.webp',
          alt: 'A gender reveal table styled in pink and blue',
        },
        imagePosition: 'right',
      },
      {
        text: "Whether you're planning an elaborate display or a quiet family moment, our venues provide the ideal canvas for your big news.",
        image: {
          src: '/images/events/gender-reveals/gender-reveal-2-2.webp',
          alt: 'Parents revealing their baby announcement with pink smoke',
        },
        secondaryImage: {
          src: '/images/events/gender-reveals/gender-reveal-3.webp',
          alt: 'A Boy or Girl balloon backdrop for a gender reveal',
        },
        imagePosition: 'left',
      },
    ],
    packageText:
      'Welcome your newest adventure with a beautiful celebration that everyone will remember.',
    galleryImages: [
      {
        src: '/images/events/gender-reveals/gender-reveal.webp',
        alt: 'A pink and blue gender reveal balloon setup',
      },
      {
        src: '/images/events/gender-reveals/gender-reveal-2.webp',
        alt: 'An Oh Baby gender reveal table',
      },
      {
        src: '/images/events/gender-reveals/gender-reveal-4.webp',
        alt: 'A neutral Boy or Girl reveal display',
      },
      {
        src: '/images/events/gender-reveals/gender-reveal-2-2.webp',
        alt: 'Expecting parents sharing their gender reveal',
      },
      {
        src: '/images/events/gender-reveals/gender-reveal-3.webp',
        alt: 'A modern pink and blue gender reveal backdrop',
      },
    ],
    packageCardImages: [
      {
        src: '/images/events/gender-reveals/gender-reveal.webp',
        alt: 'A colorful gender reveal setup',
      },
      {
        src: '/images/events/gender-reveals/gender-reveal-2.webp',
        alt: 'A pink and blue gender reveal dessert table',
      },
      {
        src: '/images/events/gender-reveals/gender-reveal-2-2.webp',
        alt: 'A joyful gender reveal moment',
      },
      {
        src: '/images/events/gender-reveals/gender-reveal-3.webp',
        alt: 'A modern Boy or Girl party backdrop',
      },
    ],
  },
} as const satisfies Record<EventPackageMediaKey, EventPackagePageDefinition>;

const approvedEventImageSources = Object.fromEntries(
  Object.entries(eventPackagePages).map(([key, page]) => {
    const sources = [
      ...page.heroSlides.map((slide) => slide.imageSrc),
      ...page.contentBlocks.flatMap((block) => [
        block.image.src,
        ...(block.secondaryImage ? [block.secondaryImage.src] : []),
      ]),
      ...page.galleryImages.map((image) => image.src),
      ...page.packageCardImages.map((image) => image.src),
    ];

    for (const source of sources) {
      if (!EVENT_PACKAGE_MEDIA_ROOTS.some((root) => source.startsWith(root))) {
        throw new Error(`Package media must come from an approved public folder: ${source}`);
      }
    }

    return [key, new Set(sources)];
  }),
) as Record<EventPackageMediaKey, Set<string>>;

export function isApprovedEventPackageImage(
  eventType: EventPackageMediaKey,
  imageSrc: string | null | undefined,
) {
  return Boolean(imageSrc && approvedEventImageSources[eventType].has(imageSrc));
}

export function resolveEventPackageCardImage(
  eventType: EventPackageMediaKey,
  requestedImageSrc: string | null | undefined,
  cardIndex: number,
): EventPackageImage {
  const page = eventPackagePages[eventType];

  if (requestedImageSrc && isApprovedEventPackageImage(eventType, requestedImageSrc)) {
    const approvedImage = [
      ...page.heroSlides.map((slide) => ({ src: slide.imageSrc, alt: slide.imageAlt })),
      ...page.contentBlocks.flatMap((block) => [
        block.image,
        ...(block.secondaryImage ? [block.secondaryImage] : []),
      ]),
      ...page.galleryImages,
      ...page.packageCardImages,
    ].find((image) => image.src === requestedImageSrc);

    if (approvedImage) {
      return {
        ...approvedImage,
        src: optimizedPublicMediaPath(approvedImage.src),
      };
    }
  }

  const fallbackImage = page.packageCardImages[cardIndex % page.packageCardImages.length];

  return {
    ...fallbackImage,
    src: optimizedPublicMediaPath(fallbackImage.src),
  };
}
