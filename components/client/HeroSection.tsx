import Image from 'next/image';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import CinematicHeroBackground from './CinematicHeroBackground';

export default function HeroSection() {
  return (
    <section
      className="relative h-[200svh] min-h-[52rem] w-full bg-neutral-950"
      data-home-hero="true"
      data-motion="decorative"
    >
      <div className="sticky top-0 h-[100svh] w-full overflow-hidden">
        <div className="relative isolate flex h-full w-full items-end overflow-hidden">
          <div
            className="home-hero-bg absolute inset-0 h-[150svh] w-full"
            style={{
              opacity: 1,
              transform: 'translate3d(0, var(--home-hero-background-y, 0svh), 0)',
              transformOrigin: 'center top',
              willChange: 'transform',
            }}
          >
            <Image
              src="/zion-media/%E2%9C%A8%20Elegant%20Lakefront%20Wedding%20Ceremony%20with%20White%20Floral%20Arch%20%26%20Luxury%20Aisle%20Inspiration.webp"
              alt=""
              fill
              preload
              sizes="100vw"
              className="object-cover object-center sm:object-[center_48%]"
            />

            <div
              className="home-hero-video-layer absolute inset-0"
              style={{
                opacity: 1,
              }}
            >
              <CinematicHeroBackground />
            </div>
            <div
              className="home-hero-exit-shade absolute inset-0 bg-black/[0.15]"
              style={{
                opacity: 'var(--home-hero-exit-shade-opacity, 0)',
                willChange: 'opacity',
              }}
            />
            <div className="absolute inset-0 bg-black/35" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_43%,transparent_12%,rgba(0,0,0,0.42)_100%)]" />
            <div className="absolute inset-x-0 top-0 h-[34%] bg-gradient-to-b from-black/42 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-black/52 to-transparent" />
          </div>

          <div className="absolute inset-x-0 top-[65%] z-10 mx-auto flex w-full justify-center px-[var(--layout-gutter)] text-center">
            <div
              className="home-hero-copy relative z-0 flex w-full max-w-6xl flex-col items-center"
              style={{
                '--scroll-color': 'hsl(0 0% var(--home-hero-copy-lightness, 58%))',
                opacity: 'var(--home-hero-copy-opacity, 0)',
                transform: 'translate3d(0, calc(-50% + var(--home-hero-copy-translate-y, 20rem)), 0)',
                filter: 'drop-shadow(0 0.65rem 1.25rem rgba(0, 0, 0, 0.52))',
                willChange: 'opacity, transform, color',
              } as CSSProperties}
            >
              <h1 className="max-w-6xl font-script text-[clamp(3rem,6.4vw,5.75rem)] font-normal leading-[0.9] drop-shadow-[0_4px_16px_rgba(0,0,0,0.8)]">
                Experience Timeless Elegance
              </h1>
              <p className="mt-6 max-w-5xl font-serif text-[clamp(1.05rem,2.05vw,2rem)] font-semibold italic leading-[1.45] drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)] sm:mt-8">
                <span className="block">
                  Where cherished milestones meet unparalleled luxury,
                </span>
                <span className="block">framed by breathtaking views of San Pedro City.</span>
              </p>
              <Link
                href="/about"
                className="mt-8 inline-flex min-h-[3.5rem] min-w-[13.25rem] items-center justify-center rounded-[0.4rem] border bg-transparent px-8 py-3 font-serif text-sm font-semibold uppercase tracking-[0.19em] drop-shadow-md transition-[background-color,border-color,color,transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:border-[#DFD48A] hover:bg-[#DFD48A] hover:text-[#171B16] hover:shadow-[0_10px_30px_rgba(0,0,0,0.24)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DFD48A] focus-visible:ring-offset-2 focus-visible:ring-offset-black sm:mt-10"
              >
                Our Story
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
