'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useReducedMotion } from '@/components/shared/useReducedMotion';
import { BRAND } from '@/config/brand';
import Navbar from './Navbar';

const HOME_LOGO_SCROLL_DISTANCE = 360;
const HERO_TEXT_START_SCROLL = 70;
const HERO_TEXT_END_SCROLL = 320;

export default function GlobalHeader() {
  const pathname = usePathname();
  const reducedMotion = useReducedMotion();
  const isCinematicHeroRoute =
    pathname === '/' ||
    pathname === '/about' ||
    pathname === '/facilities' ||
    (pathname?.startsWith('/events/') ?? false);
  const animateHomeLogo = isCinematicHeroRoute && !reducedMotion;

  useEffect(() => {
    const root = document.documentElement;
    if (!animateHomeLogo) {
      delete root.dataset.homeLogoScroll;
      delete root.dataset.homeHeroTextReady;
      root.style.setProperty('--hero-logo-progress', '1');
      root.style.setProperty('--hero-text-reveal', '1');
      return;
    }

    root.dataset.homeLogoScroll = 'true';
    let frame = 0;

    const updateProgress = () => {
      frame = 0;
      const y = window.scrollY;
      const vh = window.innerHeight || 800;
      const logoRaw = Math.min(Math.max(y / HOME_LOGO_SCROLL_DISTANCE, 0), 1);
      const logoEased = 1 - (1 - logoRaw) ** 3;

      const textInRaw = Math.min(
        Math.max((y - HERO_TEXT_START_SCROLL) / (HERO_TEXT_END_SCROLL - HERO_TEXT_START_SCROLL), 0),
        1,
      );
      const textInEased = 1 - (1 - textInRaw) ** 3;

      const fadeOutStart = vh * 0.65;
      const fadeOutEnd = vh * 1.15;
      const textOutRaw = Math.min(
        Math.max((y - fadeOutStart) / Math.max(fadeOutEnd - fadeOutStart, 1), 0),
        1,
      );
      const textOutEased = textOutRaw * textOutRaw * (3 - 2 * textOutRaw);
      const textVisibility = textInEased * (1 - textOutEased);

      root.style.setProperty('--hero-logo-progress', logoEased.toFixed(4));
      root.style.setProperty('--hero-text-reveal', textVisibility.toFixed(4));
      root.style.setProperty('--hero-text-exit', textOutEased.toFixed(4));
      root.dataset.homeHeroTextReady = textVisibility > 0.15 ? 'true' : 'false';
    };

    const scheduleUpdate = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(updateProgress);
    };

    updateProgress();
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate, { passive: true });

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
      delete root.dataset.homeLogoScroll;
      delete root.dataset.homeHeroTextReady;
      root.style.setProperty('--hero-logo-progress', '1');
      root.style.setProperty('--hero-text-reveal', '1');
    };
  }, [animateHomeLogo]);

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-[100]">
      <div className="relative mx-auto flex h-20 w-full items-center justify-end px-[var(--layout-gutter)]">
        <button
          type="button"
          onClick={() => window.location.reload()}
          aria-label={`Refresh ${BRAND.name} page`}
          className="global-centered-brand-logo pointer-events-auto cursor-pointer rounded-md border-0 bg-transparent p-0"
        >
          <Image
            src={BRAND.logo.src}
            alt=""
            width={1254}
            height={1254}
            loading="eager"
            unoptimized
            sizes="(max-width: 640px) 16rem, 25rem"
            className="h-auto w-full"
          />
        </button>
        <Navbar />
      </div>
    </header>
  );
}
