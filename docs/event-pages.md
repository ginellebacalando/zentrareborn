# Event package pages

The six event pages (`/events/weddings`, `/events/debuts`, `/events/birthdays`,
`/events/christening`, `/events/gender-reveal`, `/events/christmas-party`) share one layout,
`components/events/PackageLayout.tsx` (redesigned 27 November 2026). Their addresses did not change.

## Layout

1. **Header** (`EventHero.tsx`): a wide real photo of the event at Zion with the page title ("Debut
   Packages") and one line over a soft dark overlay, about 45% of the screen on desktop and less on
   phones. An event without a real photo yet gets a plain header in the brand green.
2. **Packages** (`EventPackages.tsx`): a tab per package ("Zion Essential · From ₱165,000"), the
   rates in one row ("50 guests ₱165,000 · 100 guests ₱189,000 · ₱1,000 per extra guest"), the
   package's facts, and its inclusions in a two-column grid by category (collapsible sections on
   phones). **Compare packages** opens every package side by side (a stacked list on phones), with
   "Show only differences" and the rows that differ marked "Different".
3. **Booking estimate**: a card beside the packages that stays in view on desktop; on phones and
   tablets a slim bar fixed at the bottom with the price and **Check dates**, whose sheet holds the
   guest count and both buttons. Zeni's button moves above the bar (`--layout-bottom-bar-clearance`).
4. **Photos** (`EventPhotoGrid.tsx`): up to eight real photos in a grid with a larger view, and
   "See more in the Gallery" (`/gallery?category=…` opens that category).
5. Testimonies, as before.

The earlier experience blocks and the spaces videos were removed from these pages: they used
web and stock images (the videos' posters too). Their text stays in `config/event-package-pages.ts`
for Zeni and the home page.

## Data

- **Packages come only from the database**: `getPublicPackagesForCategory` (published versions of
  active, visible packages), grouped into packages by `lib/event-packages.ts`. Nothing about a
  package is typed into the page. `scripts/sync-package-catalog.ts` fills the catalog from the
  package booklets, which are only a source of information and never shown as images.
- **The estimate** uses the booking page's own pricing (`packageQuote` and `cheaperTier`,
  `lib/booking-quote.ts`): the tier the booking page would suggest for that many guests. "Check
  dates" opens `/booking?event=…&package=<tier slug>&guests=…`, so the booking page selects the
  same tier and shows the same price (tested for 50, 100 and 120 guests). "Schedule an ocular
  visit" opens `/visit` with the event, the guest count and a note naming the package.
- **Rules to confirm with Zion**, applied today by the pricing engine: between two tiers the
  smaller tier plus extra guests is used when cheaper (70 guests on Zion Essential: ₱165,000 +
  20 × ₱1,000 = ₱185,000, not the 100-guest ₱189,000); a party smaller than the smallest tier
  pays that tier's rate.
- **Packages without an extra-guest fee** (Zion Prestige, the Christening and both Gender Reveal
  packages): the pricing engine treats their extra guests as free, so the booking page's "cheaper
  tier" hint points to the smallest tier (120 christening guests at the 50-guest ₱68,000). The
  event page instead uses the tier that covers the guest count (120 guests: the 120-guest
  ₱113,000) and links that tier, so the booking page shows the same price; above the largest tier
  it shows that tier's rate and says the team quotes larger parties. To confirm with Zion, and the
  booking page's hint to fix with them, since its pricing logic was not changed here.
- **No brochure PDF exists**, so the page has no download link.

## Photos

`config/event-photos.ts` lists only photos from Zion's own folders (camera originals and the
gallery the team received), with descriptive alt text; web, stock and generated images are left
out. **Still needed from Zion**: real photos of **gender reveals** and **Christmas parties** (those
pages show the text header and a link to the Gallery), and more **birthday** photos (three today).
After changing photos run `npm run photos:placeholders` (blur placeholders in
`config/photo-placeholders.ts`).

Images use `next/image` with AVIF or WebP (`next.config.ts`), sizes for each layout, lazy loading
below the header, blur placeholders and fixed aspect ratios, so nothing jumps while loading. The
header photo is preloaded at quality 70.
