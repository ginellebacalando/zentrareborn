import Image from 'next/image';
import Link from 'next/link';
import CinematicHeroBackground from './CinematicHeroBackground';

export default function HeroSection() {
  return (
    <section
      className="hero-scroll-stage relative isolate w-full bg-zion-dark"
      data-home-hero="true"
    >
      <div className="sticky top-0 flex min-h-[40rem] w-full items-center justify-center overflow-hidden px-[var(--layout-gutter)] pb-12 pt-36 text-center sm:min-h-svh">
        <div className="absolute inset-0 -z-20">
          <Image
            src="/images/events/weddings/elegant-lakefront-wedding-ceremony-with-white-floral-arch-luxury-aisle-inspiration.webp"
            alt=""
            fill
            preload
            sizes="100vw"
            className="object-cover"
          />
          <CinematicHeroBackground />
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-black/60"
        />
        <div className="hero-scroll-follow mx-auto flex max-w-5xl flex-col items-center text-white">
          <h1 className="page-title">Experience Timeless Elegance</h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed sm:text-lg">
            Where cherished milestones meet unparalleled luxury, framed by breathtaking views of San
            Pedro City.
          </p>
          <Link
            href="/about"
            className="group relative mt-8 inline-flex min-h-12 items-center justify-center overflow-hidden rounded-full border-2 border-[var(--palette-client-button)] bg-transparent px-9 py-3 font-sans text-sm font-bold uppercase tracking-[0.18em] text-white transition-all duration-500 hover:shadow-[0_18px_36px_-14px_color-mix(in_srgb,var(--palette-client-button)_55%,transparent)]"
          >
            <span
              aria-hidden="true"
              className="absolute inset-0 translate-y-full bg-[var(--palette-client-button)] transition-transform duration-500 ease-in-out group-hover:translate-y-0"
            />
            <span className="relative z-10 transition-colors duration-500 group-hover:text-ink">
              Our story
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
