import { optimizedPublicMediaPath } from '@/lib/public-media';

export const EVENT_PACKAGE_MEDIA_ROOTS = [
  '/zion-gallery/',
  '/zion-gallery-2/',
  '/zion-media/',
] as const;

export type EventPackageMediaKey =
  | 'weddings'
  | 'birthdays'
  | 'debuts'
  | 'christmasParty'
  | 'christening'
  | 'genderReveal';

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
    eventCategorySlug: 'wedding-reception',
    heroSlides: [
      heroSlide(
        'A Beautiful Beginning',
        'Exchange your vows in a setting designed to honor the heart of your love story.',
        {
          src: '/zion-gallery-2/wedding1.JPG',
          alt: 'A bride walking toward an outdoor wedding ceremony at Zion Events Place',
        },
      ),
      heroSlide(
        'Your Reception, Reimagined',
        'Gather everyone you love in an elegant space shaped around your celebration.',
        {
          src: '/zion-gallery-2/wedding2.JPG',
          alt: 'A newly married couple celebrating beneath the evening lights at Zion',
        },
      ),
      heroSlide(
        'Details That Feel Like You',
        'From styling to flow, each element can reflect the personality and story you share.',
        {
          src: '/zion-gallery-2/wedding4.JPG',
          alt: 'A wedding couple photographed against the panoramic Zion skyline',
        },
      ),
      heroSlide(
        'A Day to Remember Forever',
        'Celebrate your first chapter together against a breathtaking Zion backdrop.',
        {
          src: '/zion-gallery-2/wedding7.JPG',
          alt: 'A bride and groom surrounded by an elegant outdoor wedding reception',
        },
      ),
    ],
    contentBlocks: [
      {
        text: "Begin your celebration in a setting that can move naturally from a heartfelt ceremony to a polished reception. Zion's adaptable spaces give every part of your wedding room to feel intentional.",
        image: {
          src: '/zion-media/wedding_.jpg',
          alt: 'An elegant candlelit wedding reception',
        },
        secondaryImage: {
          src: '/zion-gallery/wedding2.jpg',
          alt: 'A bride and groom sharing a quiet wedding portrait',
        },
        imagePosition: 'right',
      },
      {
        text: 'Shape the day around your own story with thoughtful styling, meaningful traditions, and spaces where your guests can gather comfortably and celebrate alongside you.',
        image: {
          src: '/zion-gallery-2/wedding3.JPG',
          alt: 'Newlyweds dancing beneath a floral wedding arch',
        },
        secondaryImage: {
          src: '/zion-gallery-2/wedding5.JPG',
          alt: 'A wedding couple posing beside the Zion pavilion',
        },
        imagePosition: 'left',
      },
    ],
    packageText: 'Crafting the beginning of your forever with curated experiences designed for your unique love story.',
    galleryImages: [
      { src: '/zion-gallery-2/wedding6.JPG', alt: 'A bride and groom walking together after their ceremony' },
      { src: '/zion-gallery-2/wedding8.JPG', alt: 'Newlyweds sharing a romantic moment beneath string lights' },
      { src: '/zion-gallery/wedding1.jpg', alt: 'A newly married couple photographed after their vows' },
      { src: '/zion-gallery/wedding3.jpg', alt: 'A bride entering an outdoor wedding ceremony' },
      { src: '/zion-gallery-2/DSC03258.JPG', alt: 'A couple exchanging vows at the Zion wedding pavilion' },
      { src: '/zion-gallery-2/DSC03592.JPG', alt: 'Newlyweds celebrating beneath a floral ceremony arch' },
      { src: '/zion-gallery-2/DSC03928.JPG', alt: 'Wedding guests welcoming the newly married couple' },
      { src: '/zion-gallery-2/DSC04088.JPG', alt: 'A wedding couple celebrating beneath sparkling evening lights' },
    ],
    packageCardImages: [
      { src: '/zion-gallery-2/DSC04920.JPG', alt: 'A wedding couple enjoying their evening reception' },
      { src: '/zion-gallery-2/DSC05482.JPG', alt: 'A bride celebrating with guests during the reception' },
      { src: '/zion-gallery-2/DSC08346.JPG', alt: 'A bride and groom seated at their outdoor wedding ceremony' },
      { src: '/zion-gallery-2/DSC08381.JPG', alt: 'A wedding couple photographed in the garden at Zion' },
    ],
  },
  birthdays: {
    heroKey: 'birthdays',
    eventCategorySlug: 'birthday',
    heroSlides: [
      heroSlide(
        'Celebrate Another Beautiful Year',
        'Turn your birthday into a joyful gathering that feels unmistakably yours.',
        {
          src: '/zion-gallery/birthday.jpg',
          alt: 'A colorful themed birthday celebration arranged outdoors at Zion',
        },
      ),
      heroSlide(
        'A Theme Brought to Life',
        'Transform the venue around the colors, details, and energy that inspire you.',
        {
          src: '/zion-gallery/birthday1.jpg',
          alt: 'A pink balloon birthday setup at the Zion pavilion',
        },
      ),
      heroSlide(
        'Room for Everyone You Love',
        'Share laughter, food, and meaningful time together in a flexible event space.',
        {
          src: '/zion-media/bday.jpg',
          alt: 'An elegant indoor birthday dinner prepared for guests',
        },
      ),
      heroSlide(
        'Make This Milestone Unforgettable',
        'Celebrate the people and memories that made this year worth remembering.',
        {
          src: '/zion-gallery/zion5.jpg',
          alt: 'A festive pink and gold balloon birthday backdrop',
        },
      ),
    ],
    contentBlocks: [
      {
        text: 'Build a birthday celebration around the person at its center, from a playful themed gathering to an elegant milestone dinner with everyone who matters.',
        image: {
          src: '/zion-gallery/birthday.jpg',
          alt: 'A bright and playful outdoor birthday party',
        },
        secondaryImage: {
          src: '/zion-gallery/birthday1.jpg',
          alt: 'A birthday stage decorated with pink balloons',
        },
        imagePosition: 'right',
      },
      {
        text: "Zion's flexible spaces make room for dining, entertainment, portraits, and unhurried time together, all within one memorable setting.",
        image: {
          src: '/zion-media/bday.jpg',
          alt: 'A refined indoor venue prepared for a birthday dinner',
        },
        secondaryImage: {
          src: '/zion-gallery/zion5.jpg',
          alt: 'A balloon-decorated birthday portrait area',
        },
        imagePosition: 'left',
      },
    ],
    packageText: 'Celebrate another trip around the sun in a space designed for laughter, joy, and unforgettable memories.',
    galleryImages: [
      { src: '/zion-gallery/birthday.jpg', alt: 'A colorful birthday party table arrangement' },
      { src: '/zion-gallery/birthday1.jpg', alt: 'A pink themed birthday pavilion setup' },
      { src: '/zion-media/bday.jpg', alt: 'An elegant birthday banquet setting' },
      { src: '/zion-gallery/zion5.jpg', alt: 'A birthday photo area decorated with balloons' },
    ],
    packageCardImages: [
      { src: '/zion-gallery/birthday.jpg', alt: 'A vibrant outdoor birthday celebration' },
      { src: '/zion-gallery/birthday1.jpg', alt: 'A balloon-themed birthday setup' },
      { src: '/zion-media/bday.jpg', alt: 'A formal birthday dinner setting' },
      { src: '/zion-gallery/zion5.jpg', alt: 'A festive birthday portrait backdrop' },
    ],
  },
  debuts: {
    heroKey: 'debuts',
    eventCategorySlug: 'debut',
    heroSlides: [
      heroSlide(
        'Step Into Your Moment',
        'Mark your eighteenth birthday with a celebration filled with confidence, grace, and personality.',
        {
          src: '/zion-gallery-2/debut1.png',
          alt: 'A debutante in a formal gown at her Zion celebration',
        },
      ),
      heroSlide(
        'An Entrance Worth Remembering',
        'Set the stage for a grand arrival in a venue created for milestone moments.',
        {
          src: '/zion-gallery-2/debut3.jpg',
          alt: 'A debutante posing in a pink gown above the Zion skyline',
        },
      ),
      heroSlide(
        'Elegance in Every Detail',
        'Bring your chosen theme to life through thoughtful styling and a polished event setting.',
        {
          src: '/zion-media/Debut party.jpg',
          alt: 'An elaborate floral stage styled for an eighteenth birthday',
        },
      ),
      heroSlide(
        'Your Story Takes Center Stage',
        'Share a joyful evening with family and friends as you begin an exciting new chapter.',
        {
          src: '/zion-gallery-2/debut9.jpg',
          alt: 'A debutante in a pink gown overlooking the city at Zion',
        },
      ),
    ],
    contentBlocks: [
      {
        text: 'Mark this coming-of-age milestone with a grand entrance in a venue designed to make every debutante feel truly extraordinary.',
        image: {
          src: '/zion-gallery/debut4.jpg',
          alt: 'A debutante making a poised entrance in her purple gown',
        },
        secondaryImage: {
          src: '/zion-gallery-2/debut7.jpg',
          alt: 'A debutante displaying her gown at the scenic overlook',
        },
        imagePosition: 'right',
      },
      {
        text: 'From the traditional 18 roses to lively modern dances, our spaces adapt perfectly to your unique coming-out celebration.',
        image: {
          src: '/zion-gallery-2/debut11.png',
          alt: 'A debutante presented at a formally decorated outdoor celebration',
        },
        secondaryImage: {
          src: '/zion-gallery/debuts.jpg',
          alt: 'A debutante seated before her illuminated eighteenth-birthday backdrop',
        },
        imagePosition: 'left',
      },
    ],
    packageText: 'Step into a new chapter of life with a celebration as radiant and unique as you are.',
    galleryImages: [
      { src: '/zion-gallery/debut.jpg', alt: 'A debutante seated at her floral reception table' },
      { src: '/zion-gallery/debut3.jpg', alt: 'A formal debut reception setup' },
      { src: '/zion-gallery/debut5.jpg', alt: 'A debutante posing beside an elegant table arrangement' },
      { src: '/zion-gallery-2/debut2.png', alt: 'A debutante in a formal gown at her celebration table' },
      { src: '/zion-gallery-2/debut4.jpg', alt: 'A debutante posing against the panoramic skyline' },
      { src: '/zion-gallery-2/debut5.jpg', alt: 'A debut portrait among the garden greenery' },
      { src: '/zion-gallery-2/debut7.jpg', alt: 'A debutante displaying her gown at the scenic overlook' },
      { src: '/zion-gallery-2/debut8.jpg', alt: 'A modern portrait of a debutante in a blue dress' },
    ],
    packageCardImages: [
      { src: '/zion-gallery/debut1.jpg', alt: 'A themed debut entrance at Zion' },
      { src: '/zion-gallery/debut2.jpg', alt: 'The Zion pavilion prepared for a debut celebration' },
      { src: '/zion-gallery-2/debut6.jpg', alt: 'A debutante photographed against the mountain view' },
      { src: '/zion-media/Inside the incredible Swan Lake themed 18th birthday costing $41,000.jpg', alt: 'A debutante entering a Swan Lake themed eighteenth-birthday reception' },
    ],
  },
  christmasParty: {
    heroKey: 'christmasParty',
    eventCategorySlug: 'christmas-party',
    heroSlides: [
      heroSlide(
        'Celebrate the Season Together',
        'Bring family, friends, or colleagues together for an evening filled with holiday warmth.',
        {
          src: '/zion-gallery/christmas party.jpg',
          alt: 'A Christmas party reception with trees and holiday lights',
        },
      ),
      heroSlide(
        'A Setting Filled With Cheer',
        'Create a polished seasonal atmosphere for good food, laughter, and shared traditions.',
        {
          src: '/zion-media/christmas party.jpg',
          alt: 'A Christmas table decorated with poinsettias and warm lights',
        },
      ),
      heroSlide(
        'Toast to the Year Behind You',
        'Recognize milestones and reconnect with the people who made the year meaningful.',
        {
          src: '/zion-media/christmas party (2).jpg',
          alt: 'An elegant Christmas party beneath sparkling holiday decorations',
        },
      ),
      heroSlide(
        'End the Year With a Lasting Memory',
        'Let Zion host a festive finale everyone will carry into the new year.',
        {
          src: '/zion-media/christmas party (3).jpg',
          alt: 'A red Christmas celebration stage with seasonal lighting',
        },
      ),
    ],
    contentBlocks: [
      {
        text: 'Bring your team or family together for a festive celebration that perfectly balances holiday cheer with sophisticated dining.',
        image: {
          src: '/zion-gallery/christmas party.jpg',
          alt: 'A sophisticated dining room decorated for Christmas',
        },
        secondaryImage: {
          src: '/zion-gallery/christmas.jpg',
          alt: 'A Christmas dining table with red and green place settings',
        },
        imagePosition: 'right',
      },
      {
        text: 'Our versatile venues transform into winter wonderlands, offering the ideal backdrop for year-end reflections and joyful toasts.',
        image: {
          src: '/zion-media/christmas party (2).jpg',
          alt: 'A festive Christmas banquet with illuminated seasonal décor',
        },
        secondaryImage: {
          src: '/zion-media/Elegant Christmas Wedding Ideas for a Timeless Holiday Celebration.jpg',
          alt: 'An elegant holiday table prepared in Christmas colors',
        },
        imagePosition: 'left',
      },
    ],
    packageText: 'Celebrate the season of giving with unforgettable gatherings that capture the magic of the holidays.',
    galleryImages: [
      { src: '/zion-gallery/christmas party.jpg', alt: 'A Christmas reception with festive trees' },
      { src: '/zion-gallery/christmas.jpg', alt: 'A holiday table set in red and green' },
      { src: '/zion-media/christmas party.jpg', alt: 'A candlelit Christmas dining arrangement' },
      { src: '/zion-media/christmas party (2).jpg', alt: 'A sparkling Christmas party venue' },
      { src: '/zion-media/christmas party (3).jpg', alt: 'An illuminated red Christmas event stage' },
      { src: '/zion-media/Elegant Christmas Wedding Ideas for a Timeless Holiday Celebration.jpg', alt: 'A refined Christmas table arrangement' },
    ],
    packageCardImages: [
      { src: '/zion-gallery/christmas party.jpg', alt: 'A venue transformed for a Christmas party' },
      { src: '/zion-media/christmas party.jpg', alt: 'An intimate holiday dinner setup' },
      { src: '/zion-media/christmas party (2).jpg', alt: 'A festive year-end celebration setting' },
      { src: '/zion-media/christmas party (3).jpg', alt: 'A Christmas party stage illuminated in red' },
    ],
  },
  christening: {
    heroKey: 'christening',
    eventCategorySlug: 'christening',
    heroSlides: [
      heroSlide(
        'Welcome a Precious Blessing',
        "Celebrate your family's newest chapter in a warm and graceful setting.",
        {
          src: '/zion-gallery/christening.jpg',
          alt: 'Parents celebrating their baby at a christening reception',
        },
      ),
      heroSlide(
        'A Gathering Filled With Love',
        'Bring generations together for a meaningful day centered on faith, family, and joy.',
        {
          src: '/zion-gallery/christening1.jpg',
          alt: 'A family portrait during a child christening celebration',
        },
      ),
      heroSlide(
        'Gentle, Thoughtful Styling',
        'Create a welcoming atmosphere with details chosen for your little one.',
        {
          src: '/zion-media/christening (3).jpg',
          alt: 'A softly styled christening dessert table',
        },
      ),
      heroSlide(
        'First Milestones, Lasting Memories',
        'Preserve a beautiful family occasion in a venue made for moments that matter.',
        {
          src: '/zion-gallery/christening3.jpg',
          alt: 'Parents and their child posing at a christening backdrop',
        },
      ),
    ],
    contentBlocks: [
      {
        text: 'Welcome your newest family member in a space that feels both sacred and inviting, perfect for meaningful dedications.',
        image: {
          src: '/zion-gallery/christening4.jpg',
          alt: 'Parents sharing a tender moment with their baby at a christening',
        },
        secondaryImage: {
          src: '/zion-gallery/christeing2.jpg',
          alt: 'Parents caring for their child during a family milestone',
        },
        imagePosition: 'right',
      },
      {
        text: 'Gather your closest loved ones for a serene celebration filled with light, joy, and the warmth of family connections.',
        image: {
          src: '/zion-media/christening (2).jpg',
          alt: 'A blue and white christening backdrop',
        },
        secondaryImage: {
          src: '/zion-media/christening (4).jpg',
          alt: 'A christening venue decorated with soft blue balloons',
        },
        imagePosition: 'left',
      },
    ],
    packageText: 'A beautiful beginning for your little one, celebrated with elegance and heartfelt moments.',
    galleryImages: [
      { src: '/zion-gallery/christening.jpg', alt: 'A family celebrating their child at Zion' },
      { src: '/zion-gallery/christening1.jpg', alt: 'A christening family portrait on the lawn' },
      { src: '/zion-gallery/christening3.jpg', alt: 'A family portrait at a christening backdrop' },
      { src: '/zion-gallery/christening4.jpg', alt: 'Parents kissing their baby during the celebration' },
      { src: '/zion-gallery/christening5.jpg', alt: 'Family and godparents gathered for a christening' },
      { src: '/zion-media/christening.jpg', alt: 'A delicate christening table centerpiece' },
      { src: '/zion-media/christening (3).jpg', alt: 'A blue christening dessert arrangement' },
      { src: '/zion-media/christening (4).jpg', alt: 'A blue balloon christening venue setup' },
    ],
    packageCardImages: [
      { src: '/zion-gallery/christening1.jpg', alt: 'A joyful christening family portrait' },
      { src: '/zion-gallery/christening3.jpg', alt: 'A child celebrated at a christening reception' },
      { src: '/zion-media/christening (2).jpg', alt: 'A modern christening backdrop' },
      { src: '/zion-media/christening.jpg', alt: 'An elegant christening centerpiece' },
    ],
  },
  genderReveal: {
    heroKey: 'genderReveal',
    eventCategorySlug: 'gender-reveal',
    heroSlides: [
      heroSlide(
        'A Beautiful Secret to Share',
        'Gather your favorite people for a reveal filled with anticipation and wonder.',
        {
          src: '/zion-gallery/gender reveal.jpg',
          alt: 'A pink and blue balloon gender reveal backdrop',
        },
      ),
      heroSlide(
        'The Moment Everyone Is Waiting For',
        'Create a joyful reveal moment framed by an elegant and welcoming celebration.',
        {
          src: '/zion-media/gender-reveal (2).jpg',
          alt: 'Expecting parents celebrating with pink reveal smoke',
        },
      ),
      heroSlide(
        'Celebrate Your Growing Family',
        'Share the excitement of a new chapter with thoughtful details and plenty of room for love.',
        {
          src: '/zion-gallery/gnder.jpg',
          alt: 'A pink and blue Oh Baby gender reveal dessert table',
        },
      ),
      heroSlide(
        'A Memory Before Hello',
        'Make the story of your little one special from the very first celebration.',
        {
          src: '/zion-media/gender-reveal.jpg',
          alt: 'A neutral Boy or Girl gender reveal display',
        },
      ),
    ],
    contentBlocks: [
      {
        text: "Share life's most exciting surprise with family and friends in a joyful, intimate setting perfectly scaled for your reveal.",
        image: {
          src: '/zion-gallery/gender reveal.jpg',
          alt: 'A blue and pink balloon wall for a gender reveal',
        },
        secondaryImage: {
          src: '/zion-gallery/gnder.jpg',
          alt: 'A gender reveal table styled in pink and blue',
        },
        imagePosition: 'right',
      },
      {
        text: "Whether you're planning an elaborate display or a quiet family moment, our venues provide the ideal canvas for your big news.",
        image: {
          src: '/zion-media/gender-reveal (2).jpg',
          alt: 'Parents revealing their baby announcement with pink smoke',
        },
        secondaryImage: {
          src: '/zion-media/gender-reveal (3).jpg',
          alt: 'A Boy or Girl balloon backdrop for a gender reveal',
        },
        imagePosition: 'left',
      },
    ],
    packageText: 'Welcome your newest adventure with a beautiful celebration that everyone will remember.',
    galleryImages: [
      { src: '/zion-gallery/gender reveal.jpg', alt: 'A pink and blue gender reveal balloon setup' },
      { src: '/zion-gallery/gnder.jpg', alt: 'An Oh Baby gender reveal table' },
      { src: '/zion-media/gender-reveal.jpg', alt: 'A neutral Boy or Girl reveal display' },
      { src: '/zion-media/gender-reveal (2).jpg', alt: 'Expecting parents sharing their gender reveal' },
      { src: '/zion-media/gender-reveal (3).jpg', alt: 'A modern pink and blue gender reveal backdrop' },
    ],
    packageCardImages: [
      { src: '/zion-gallery/gender reveal.jpg', alt: 'A colorful gender reveal setup' },
      { src: '/zion-gallery/gnder.jpg', alt: 'A pink and blue gender reveal dessert table' },
      { src: '/zion-media/gender-reveal (2).jpg', alt: 'A joyful gender reveal moment' },
      { src: '/zion-media/gender-reveal (3).jpg', alt: 'A modern Boy or Girl party backdrop' },
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

  const fallbackImage =
    page.packageCardImages[cardIndex % page.packageCardImages.length];

  return {
    ...fallbackImage,
    src: optimizedPublicMediaPath(fallbackImage.src),
  };
}
