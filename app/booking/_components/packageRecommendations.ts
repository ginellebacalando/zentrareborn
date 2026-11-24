export interface CuratedPackage {
  readonly id: string;
  readonly name: string;
  readonly style: 'Zion Classic' | 'Zion Signature' | 'Zion Grand' | 'Custom Proposal';
  readonly eventTypes: readonly string[];
  readonly price: number;
  readonly paxIncluded: number;
  readonly excessPaxFee: number;
  readonly downpaymentPercent: number;
  readonly imageSrc: string;
  readonly imageAlt: string;
  readonly tagline: string;
  readonly highlights: readonly string[];
}

export interface RecommendedPackage {
  readonly pkg: CuratedPackage;
  readonly estimatedTotal: number;
  readonly excessGuests: number;
  readonly downpaymentAmount: number;
  readonly remainingBalance: number;
  readonly matchScore: number;
  readonly withinBudget: boolean;
  readonly badge: 'Best Match' | 'Best Value' | null;
  readonly matchReasons: readonly string[];
}

export interface RecommendationInput {
  readonly eventType: string;
  readonly packageTier: string;
  readonly guestCount: number;
  readonly budgetRange: string;
  readonly addOns: readonly string[];
}

const CURATED_PACKAGES: readonly CuratedPackage[] = [
  // Intimate & Milestone packages (Christening / Gender Reveal: ₱80k – ₱180k)
  {
    id: 'zion-intimate-classic',
    name: 'Zion Intimate Classic',
    style: 'Zion Classic',
    eventTypes: ['Christening', 'Gender Reveal'],
    price: 88000,
    paxIncluded: 50,
    excessPaxFee: 1100,
    downpaymentPercent: 30,
    imageSrc: '/images/events/christenings/christening1.webp',
    imageAlt: 'Intimate celebration table setup at Zion Events Place',
    tagline: 'Warm, refined full-day celebration for close family and loved ones.',
    highlights: [
      'Exclusive full-day access to Zion Events Place',
      'Full-course catering for 50 guests with beverage station',
      'Minimalist backdrop, dressed tables & welcome signage',
      'Basic sound system & dedicated event coordinator',
    ],
  },
  {
    id: 'zion-milestone-signature',
    name: 'Zion Milestone Signature',
    style: 'Zion Signature',
    eventTypes: ['Christening', 'Gender Reveal'],
    price: 122000,
    paxIncluded: 70,
    excessPaxFee: 1250,
    downpaymentPercent: 30,
    imageSrc: '/images/events/gender-reveals/gender-reveal.webp',
    imageAlt: 'Curated signature milestone celebration at Zion Events Place',
    tagline: 'Curated thematic styling, enhanced lighting, and elevated dining.',
    highlights: [
      'Exclusive full-day venue use with scenic garden access',
      'Signature catering & grazing corner for 70 guests',
      'Bespoke thematic backdrop, floral accents & mood lights',
      'Professional host, sound system & photo booth perks',
    ],
  },
  {
    id: 'zion-milestone-grand',
    name: 'Zion Milestone Grand',
    style: 'Zion Grand',
    eventTypes: ['Christening', 'Gender Reveal'],
    price: 165000,
    paxIncluded: 100,
    excessPaxFee: 1350,
    downpaymentPercent: 30,
    imageSrc: '/images/events/weddings/minimalist-luxury-ceremony-backdrop.webp',
    imageAlt: 'Grand milestone celebration backdrop at Zion Events Place',
    tagline: 'All-in luxury styling and full production for unforgettable family milestones.',
    highlights: [
      'Exclusive full-day indoor hall & garden terrace access',
      'Premium plated/buffet catering & dessert bar for 100 guests',
      'Full floral styling, LED wall & ambient lighting package',
      'Photo & video coverage with full on-the-day coordination',
    ],
  },
  {
    id: 'zion-milestone-custom',
    name: 'Zion Bespoke Milestone',
    style: 'Custom Proposal',
    eventTypes: ['Christening', 'Gender Reveal'],
    price: 140000,
    paxIncluded: 80,
    excessPaxFee: 1250,
    downpaymentPercent: 30,
    imageSrc: '/images/venue/venue-view.webp',
    imageAlt: 'Scenic venue view for bespoke milestone celebrations at Zion Events Place',
    tagline: 'Flexible inclusions tailored around your exact motif and family priorities.',
    highlights: [
      'Exclusive full-day venue access with customizable layout',
      'Flexible catering & styling allocation for 80 guests',
      'Dedicated Zion planner for custom supplier coordination',
      'Priority add-on credits for styling or entertainment',
    ],
  },

  // Birthday packages (₱100k – ₱220k)
  {
    id: 'zion-birthday-classic',
    name: 'Zion Birthday Classic',
    style: 'Zion Classic',
    eventTypes: ['Birthday'],
    price: 112000,
    paxIncluded: 60,
    excessPaxFee: 1200,
    downpaymentPercent: 30,
    imageSrc: '/images/events/debuts-birthdays/birthday1.webp',
    imageAlt: 'Classic indoor birthday celebration at Zion Events Place',
    tagline: 'Effortless all-in birthday venue, catering, and warm celebration styling.',
    highlights: [
      'Exclusive full-day venue reservation at Zion Events Place',
      'Full-course buffet catering for 60 guests with drinks',
      'Styled focal stage, dressed tables & ambient uplighting',
      'Audio system, wireless mics & on-site coordination',
    ],
  },
  {
    id: 'zion-birthday-signature',
    name: 'Zion Birthday Signature',
    style: 'Zion Signature',
    eventTypes: ['Birthday'],
    price: 152000,
    paxIncluded: 80,
    excessPaxFee: 1350,
    downpaymentPercent: 30,
    imageSrc: '/images/about/about-story-2.webp',
    imageAlt: 'Signature birthday reception hall at Zion Events Place',
    tagline: 'Elevated party styling, grazing spread, and vibrant lighting production.',
    highlights: [
      'Exclusive full-day indoor hall & poolside terrace access',
      'Signature catering & cocktail grazing table for 80 guests',
      'Custom thematic backdrop, centerpiece florals & mood lights',
      'Acoustic/DJ audio setup & dedicated event director',
    ],
  },
  {
    id: 'zion-birthday-grand',
    name: 'Zion Birthday Grand',
    style: 'Zion Grand',
    eventTypes: ['Birthday'],
    price: 205000,
    paxIncluded: 120,
    excessPaxFee: 1450,
    downpaymentPercent: 30,
    imageSrc: '/images/events/weddings/gorgeous-wedding-decor.webp',
    imageAlt: 'Grand milestone birthday styling at Zion Events Place',
    tagline: 'Show-stopping milestone birthday production with LED wall and full coverage.',
    highlights: [
      'Exclusive full-day estate access for up to 120 guests',
      'Premium banquet catering, grazing & poolside cocktail hour',
      'Full designer florals, LED wall & concert-grade lighting',
      'Photo & video coverage with full coordination team',
    ],
  },
  {
    id: 'zion-birthday-custom',
    name: 'Zion Bespoke Birthday',
    style: 'Custom Proposal',
    eventTypes: ['Birthday'],
    price: 175000,
    paxIncluded: 100,
    excessPaxFee: 1350,
    downpaymentPercent: 30,
    imageSrc: '/images/venue/venue-view.webp',
    imageAlt: 'Overlooking venue for bespoke birthday events at Zion Events Place',
    tagline: 'Tailored birthday celebration built around your theme, entertainment, and menu.',
    highlights: [
      'Exclusive full-day venue use with flexible indoor/outdoor flow',
      'Customizable catering & styling budget for 100 guests',
      'Dedicated Zion coordinator for custom thematic concepts',
      'Complimentary poolside cocktail hour setup',
    ],
  },

  // Flagship Celebration packages (Wedding, Debut, Christmas Party: ₱140k – ₱680k)
  {
    id: 'zion-celebration-classic',
    name: 'Zion Classic Celebration',
    style: 'Zion Classic',
    eventTypes: ['Wedding', 'Debut', 'Christmas Party'],
    price: 145000,
    paxIncluded: 80,
    excessPaxFee: 1400,
    downpaymentPercent: 30,
    imageSrc: '/images/about/about-story-2.webp',
    imageAlt: 'Classic indoor reception at Zion Events Place',
    tagline: 'Essential full-service celebration with elegant hall styling and catering.',
    highlights: [
      'Exclusive full-day venue reservation at Zion Events Place',
      'Complete banquet catering for 80 guests with service staff',
      'Classic stage backdrop, table centerpieces & warm lighting',
      'Professional sound system & dedicated event coordinator',
    ],
  },
  {
    id: 'zion-celebration-signature',
    name: 'Zion Signature Experience',
    style: 'Zion Signature',
    eventTypes: ['Wedding', 'Debut', 'Christmas Party'],
    price: 235000,
    paxIncluded: 100,
    excessPaxFee: 1550,
    downpaymentPercent: 30,
    imageSrc: '/images/events/weddings/minimalist-luxury-ceremony-backdrop.webp',
    imageAlt: 'Signature ceremony and reception styling at Zion Events Place',
    tagline: 'Our most-loved balanced package with curated florals, lighting, and cocktails.',
    highlights: [
      'Exclusive full-day access to indoor hall & scenic garden',
      'Signature full-course catering & grazing bar for 100 guests',
      'Elevated floral styling, ceiling accents & ambient lighting',
      'Poolside cocktail hour, sound system & full coordination',
    ],
  },
  {
    id: 'zion-celebration-grand',
    name: 'Zion Grand All-In',
    style: 'Zion Grand',
    eventTypes: ['Wedding', 'Debut', 'Christmas Party'],
    price: 365000,
    paxIncluded: 150,
    excessPaxFee: 1650,
    downpaymentPercent: 30,
    imageSrc: '/images/events/weddings/gorgeous-wedding-decor.webp',
    imageAlt: 'Grand luxury floral and chandelier reception at Zion Events Place',
    tagline: 'Comprehensive luxury production with LED wall, lush florals, and photo-video.',
    highlights: [
      'Exclusive full-day estate access for 150 guests',
      'Luxury banquet catering, carving station & poolside cocktails',
      'Statement floral styling, LED wall & theatrical lighting',
      'Full photo & video coverage plus executive event direction',
    ],
  },
  {
    id: 'zion-celebration-prestige',
    name: 'Zion Prestige Estate',
    style: 'Zion Grand',
    eventTypes: ['Wedding', 'Debut', 'Christmas Party'],
    price: 540000,
    paxIncluded: 200,
    excessPaxFee: 1750,
    downpaymentPercent: 30,
    imageSrc: '/images/events/weddings/wedding1.webp',
    imageAlt: 'Prestige flagship estate wedding and celebration at Zion Events Place',
    tagline: 'Flagship all-out luxury experience designed for grand milestone receptions.',
    highlights: [
      'Exclusive full-day estate & bridal/VIP lounge access for 200 pax',
      'Chef-curated multi-course dining, grazing & open cocktail bar',
      'Bespoke luxury ceiling & aisle florals, LED wall & live band audio',
      'Complete photo, cinema film, host & full planning team',
    ],
  },
  {
    id: 'zion-celebration-custom',
    name: 'Zion Custom Proposal',
    style: 'Custom Proposal',
    eventTypes: ['Wedding', 'Debut', 'Christmas Party'],
    price: 290000,
    paxIncluded: 120,
    excessPaxFee: 1500,
    downpaymentPercent: 30,
    imageSrc: '/images/venue/venue-view.webp',
    imageAlt: 'Custom event setup overlooking the skyline at Zion Events Place',
    tagline: 'Tailored celebration blueprint crafted 1-on-1 with our senior event planners.',
    highlights: [
      'Exclusive full-day venue use with custom indoor/garden layout',
      'Flexible catering & styling allocation for 120 guests',
      'Customizable add-on credits for LED wall, photo-video, or music',
      'Dedicated senior Zion coordinator from planning to event day',
    ],
  },
];

function parseBudgetBounds(budgetRange: string): { min: number; max: number; flexible: boolean } {
  const normalized = budgetRange.toLowerCase();
  if (!budgetRange || normalized.includes('flexible')) {
    return { min: 0, max: Number.POSITIVE_INFINITY, flexible: true };
  }

  const numbers = Array.from(budgetRange.matchAll(/₱?([\d,]+)/g)).map((m) =>
    Number.parseInt(m[1].replace(/,/g, ''), 10),
  );

  if (normalized.includes('under') && numbers.length >= 1) {
    return { min: 0, max: numbers[0], flexible: false };
  }
  if (budgetRange.includes('+') && numbers.length >= 1) {
    return { min: numbers[0], max: Number.POSITIVE_INFINITY, flexible: false };
  }
  if (numbers.length >= 2) {
    return { min: numbers[0], max: numbers[1], flexible: false };
  }
  return { min: 0, max: Number.POSITIVE_INFINITY, flexible: true };
}

export function formatPhp(amount: number): string {
  return `₱${Math.round(amount).toLocaleString('en-PH')}`;
}

export function getRecommendedPackages(input: RecommendationInput): RecommendedPackage[] {
  const bounds = parseBudgetBounds(input.budgetRange);
  const eventMatched = CURATED_PACKAGES.filter((pkg) => pkg.eventTypes.includes(input.eventType));
  const pool = eventMatched.length > 0 ? eventMatched : CURATED_PACKAGES.slice(0, 4);

  const scored = pool.map((pkg) => {
    const excessGuests = Math.max(0, input.guestCount - pkg.paxIncluded);
    const estimatedTotal = pkg.price + excessGuests * pkg.excessPaxFee;
    const downpaymentAmount = Math.round((estimatedTotal * pkg.downpaymentPercent) / 100);
    const remainingBalance = estimatedTotal - downpaymentAmount;

    const withinBudget =
      bounds.flexible || (estimatedTotal >= bounds.min * 0.85 && estimatedTotal <= bounds.max);
    const strictlyWithinBudget =
      bounds.flexible || (estimatedTotal >= bounds.min && estimatedTotal <= bounds.max);

    let score = 40;
    const reasons: string[] = [];

    // 1. Budget relevancy (strongest weight)
    if (bounds.flexible) {
      score += 24;
      reasons.push('Flexible budget fit');
    } else if (strictlyWithinBudget) {
      score += 36;
      reasons.push('Within your budget range');
    } else if (estimatedTotal <= bounds.max * 1.12 && estimatedTotal >= bounds.min * 0.78) {
      score += 18;
      reasons.push('Close to target budget');
    } else {
      const distance =
        estimatedTotal > bounds.max
          ? (estimatedTotal - bounds.max) / Math.max(1, bounds.max)
          : (bounds.min - estimatedTotal) / Math.max(1, bounds.min);
      score -= Math.min(28, Math.round(distance * 45));
    }

    // 2. Package Style preference match
    if (pkg.style === input.packageTier) {
      score += 22;
      reasons.push(`Matches ${pkg.style}`);
    } else if (
      (input.packageTier === 'Zion Signature' &&
        (pkg.style === 'Zion Classic' || pkg.style === 'Zion Grand')) ||
      (input.packageTier === 'Custom Proposal' && pkg.style === 'Zion Signature')
    ) {
      score += 8;
    }

    // 3. Guest count fit
    const paxDiff = Math.abs(pkg.paxIncluded - input.guestCount);
    if (paxDiff <= 20) {
      score += 16;
      reasons.push(`Ideal for ${input.guestCount} guests`);
    } else if (paxDiff <= 45) {
      score += 9;
    } else {
      score += 2;
    }

    // 4. Add-on synergy
    if (
      input.addOns.length >= 3 &&
      (pkg.style === 'Zion Grand' || pkg.style === 'Zion Signature')
    ) {
      score += 6;
      reasons.push('Includes key add-on perks');
    }

    const matchScore = Math.max(62, Math.min(99, Math.round(score)));

    return {
      pkg,
      estimatedTotal,
      excessGuests,
      downpaymentAmount,
      remainingBalance,
      matchScore,
      withinBudget,
      badge: null as 'Best Match' | 'Best Value' | null,
      matchReasons: reasons.slice(0, 3),
    };
  });

  // Sort strictly by relevancy (within-budget first when scores are close, then highest score)
  scored.sort((a, b) => {
    if (a.withinBudget !== b.withinBudget) {
      return a.withinBudget ? -1 : 1;
    }
    if (b.matchScore !== a.matchScore) {
      return b.matchScore - a.matchScore;
    }
    return a.estimatedTotal - b.estimatedTotal;
  });

  // Assign "Best Match" to #1 and "Best Value" to the best value-per-guest remaining option
  if (scored.length > 0) {
    scored[0].badge = 'Best Match';
  }
  if (scored.length > 1) {
    let bestValueIndex = 1;
    let bestCostPerPax = Number.POSITIVE_INFINITY;
    for (let i = 1; i < scored.length; i += 1) {
      const candidate = scored[i];
      const effectivePax = Math.max(candidate.pkg.paxIncluded, input.guestCount);
      const costPerPax = candidate.estimatedTotal / Math.max(1, effectivePax);
      const preferenceBonus = candidate.withinBudget ? 0.85 : 1.15;
      const weightedCost = costPerPax * preferenceBonus;
      if (weightedCost < bestCostPerPax) {
        bestCostPerPax = weightedCost;
        bestValueIndex = i;
      }
    }
    scored[bestValueIndex].badge = 'Best Value';
  }

  return scored;
}
