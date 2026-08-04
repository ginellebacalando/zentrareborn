"use client";

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, type MouseEvent } from 'react';
import { BRAND } from '@/config/brand';
import Navbar from './Navbar';

const COPY_REVEAL_START_PROGRESS = 0.16;
const COPY_CENTER_PROGRESS = 0.1;
const COPY_INTERACTIVE_START_PROGRESS = 0.1;
const COPY_INTERACTIVE_END_PROGRESS = 0.72;
const BACKGROUND_FADE_START_PROGRESS = 0.74;
const BACKGROUND_TRAVEL_SVH = 48;

export default function GlobalHeader() {
  const pathname = usePathname();
  const isHomePage = pathname === '/';
  const logoRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const root = document.documentElement;

    if (!isHomePage) {
      root.style.setProperty('--home-hero-progress', '1');
      root.style.setProperty('--home-hero-copy-progress', '1');
      root.style.removeProperty('--home-hero-copy-opacity');
      root.style.removeProperty('--home-hero-copy-lightness');
      root.style.removeProperty('--home-hero-copy-translate-y');
      root.style.setProperty('--home-hero-inverse-progress', '0');
      root.style.setProperty('--home-hero-background-y', '0svh');
      root.style.setProperty('--home-hero-exit-shade-opacity', '0');
      root.style.removeProperty('--home-logo-scale');
      root.style.removeProperty('--home-logo-translate-y');
      root.style.removeProperty('--home-logo-opacity');

      return () => {
        root.style.removeProperty('--home-hero-progress');
        root.style.removeProperty('--home-hero-copy-progress');
        root.style.removeProperty('--home-hero-copy-opacity');
        root.style.removeProperty('--home-hero-copy-lightness');
        root.style.removeProperty('--home-hero-copy-translate-y');
        root.style.removeProperty('--home-hero-inverse-progress');
        root.style.removeProperty('--home-hero-background-y');
        root.style.removeProperty('--home-hero-exit-shade-opacity');
        root.style.removeProperty('--home-logo-scale');
        root.style.removeProperty('--home-logo-translate-y');
        root.style.removeProperty('--home-logo-opacity');
      };
    }

    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let animationFrame = 0;

    const updateScrollProgress = () => {
      animationFrame = 0;

      const phaseDistance = Math.min(480, Math.max(280, window.innerHeight * 0.45));
      const logoCopyGap = Math.min(40, Math.max(24, window.innerHeight * 0.04));
      const totalAnimationDistance = (phaseDistance * 2) + logoCopyGap;
      const scrollOffset = Math.max(0, window.scrollY);
      const reducedMotionActive = reducedMotionQuery.matches && scrollOffset > 0;
      const logoProgress = reducedMotionActive
        ? 1
        : Math.min(1, scrollOffset / phaseDistance);
      const overallProgress = Math.min(1, scrollOffset / totalAnimationDistance);
      const rawCopyProgress = reducedMotionActive
        ? 0.5
        : overallProgress;
      const copyProgress = Math.min(
        1,
        Math.max(
          0,
          (rawCopyProgress - COPY_REVEAL_START_PROGRESS)
            / (1 - COPY_REVEAL_START_PROGRESS),
        ),
      );
      const copyFadeInOpacity = Math.min(1, copyProgress / COPY_CENTER_PROGRESS);
      const copyFadeOutOpacity = Math.min(1, (1 - copyProgress) / 0.28);
      const copyOpacity = Math.min(copyFadeInOpacity, copyFadeOutOpacity);
      const copyColorPeak = 1 - Math.abs((copyProgress * 2) - 1);
      const copyLightness = 58 + (42 * copyColorPeak);
      const copyEntranceProgress = Math.min(1, copyProgress / COPY_CENTER_PROGRESS);
      const copyExitProgress = Math.max(
        0,
        (copyProgress - COPY_CENTER_PROGRESS) / (1 - COPY_CENTER_PROGRESS),
      );
      const copyTranslateY = (20 * (1 - copyEntranceProgress))
        - (30 * Math.pow(copyExitProgress, 1.5));
      const roundedProgress = overallProgress.toFixed(4);
      const roundedCopyProgress = copyProgress.toFixed(4);
      const logoInverseProgress = Math.pow(1 - logoProgress, 1.65).toFixed(4);
      const backgroundProgress = reducedMotionQuery.matches ? 0 : overallProgress;
      const backgroundExitProgress = Math.min(
        1,
        Math.max(
          0,
          (backgroundProgress - BACKGROUND_FADE_START_PROGRESS)
            / (1 - BACKGROUND_FADE_START_PROGRESS),
        ),
      );
      const backgroundY = (-BACKGROUND_TRAVEL_SVH * backgroundProgress).toFixed(3);
      const backgroundShadeOpacity = backgroundExitProgress.toFixed(4);
      const logoElement = logoRef.current;
      const finalLogoHeight = logoElement?.offsetHeight ?? 180;
      const finalLogoTop = logoElement
        ? Number.parseFloat(window.getComputedStyle(logoElement).top) || 0
        : 0;
      const initialLogoScaleMultiplier = window.innerWidth < 640
        ? 2.2
        : window.innerWidth < 1024
          ? 2.35
          : 2.55;
      const previousSettledLogoHeight = Math.min(
        180,
        Math.max(136, window.innerWidth * 0.14),
      );
      const initialLogoScale = (previousSettledLogoHeight * initialLogoScaleMultiplier)
        / finalLogoHeight;
      const logoScale = initialLogoScale - ((initialLogoScale - 1) * logoProgress);
      const initialLogoTranslateY = Math.max(
        0,
        (window.innerHeight / 2)
          - finalLogoTop
          - ((finalLogoHeight * initialLogoScale) / 2),
      );
      const logoTranslateY = initialLogoTranslateY * (1 - logoProgress);

      root.style.setProperty('--home-hero-progress', roundedProgress);
      root.style.setProperty('--home-hero-copy-progress', roundedCopyProgress);
      root.style.setProperty('--home-hero-copy-opacity', copyOpacity.toFixed(4));
      root.style.setProperty('--home-hero-copy-lightness', `${copyLightness.toFixed(2)}%`);
      root.style.setProperty('--home-hero-copy-translate-y', `${copyTranslateY.toFixed(3)}rem`);
      root.style.setProperty('--home-hero-inverse-progress', logoInverseProgress);
      root.style.setProperty('--home-hero-background-y', `${backgroundY}svh`);
      root.style.setProperty('--home-hero-exit-shade-opacity', backgroundShadeOpacity);
      root.style.setProperty('--home-logo-scale', logoScale.toFixed(4));
      root.style.setProperty('--home-logo-translate-y', `${logoTranslateY.toFixed(2)}px`);
      root.style.setProperty('--home-logo-opacity', '1');

      const isCopyInteractive = copyProgress >= COPY_INTERACTIVE_START_PROGRESS
        && copyProgress <= COPY_INTERACTIVE_END_PROGRESS;

      if (isCopyInteractive) {
        root.dataset.homeHeroCopyVisible = 'true';
      } else {
        delete root.dataset.homeHeroCopyVisible;
      }

    };

    const requestProgressUpdate = () => {
      if (animationFrame === 0) {
        animationFrame = window.requestAnimationFrame(updateScrollProgress);
      }
    };

    updateScrollProgress();
    window.addEventListener('scroll', requestProgressUpdate, { passive: true });
    window.addEventListener('resize', requestProgressUpdate);
    reducedMotionQuery.addEventListener('change', requestProgressUpdate);

    return () => {
      if (animationFrame !== 0) {
        window.cancelAnimationFrame(animationFrame);
      }

      window.removeEventListener('scroll', requestProgressUpdate);
      window.removeEventListener('resize', requestProgressUpdate);
      reducedMotionQuery.removeEventListener('change', requestProgressUpdate);
      root.style.removeProperty('--home-hero-progress');
      root.style.removeProperty('--home-hero-copy-progress');
      root.style.removeProperty('--home-hero-copy-opacity');
      root.style.removeProperty('--home-hero-copy-lightness');
      root.style.removeProperty('--home-hero-copy-translate-y');
      root.style.removeProperty('--home-hero-inverse-progress');
      root.style.removeProperty('--home-hero-background-y');
      root.style.removeProperty('--home-hero-exit-shade-opacity');
      root.style.removeProperty('--home-logo-scale');
      root.style.removeProperty('--home-logo-translate-y');
      root.style.removeProperty('--home-logo-opacity');
      delete root.dataset.homeHeroCopyVisible;
    };
  }, [isHomePage]);

  const handleHomeClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (isHomePage && window.scrollY > 0) {
      event.preventDefault();
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    }
  };

  return (
    <header
      className="pointer-events-none fixed inset-x-0 top-0 z-[100]"
      data-motion="decorative"
    >
      <div className="relative mx-auto flex h-[4.5rem] w-full items-center justify-end px-[var(--layout-gutter)] sm:h-20">
        <Link
          ref={logoRef}
          href="/"
          aria-label={`${BRAND.name} home`}
          className="global-centered-brand-logo pointer-events-auto rounded-md outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[#DFD48A] focus-visible:ring-offset-4 focus-visible:ring-offset-transparent"
          data-home={isHomePage ? 'true' : undefined}
          style={isHomePage
            ? {
              width: 'clamp(8.25rem, 13vw, 11.25rem)',
              opacity: 'var(--home-logo-opacity, 0)',
              transform: 'translate3d(-50%, var(--home-logo-translate-y, 0), 0) scale(var(--home-logo-scale, 1))',
              transformOrigin: 'center top',
              willChange: 'transform',
            }
            : undefined}
          onClick={handleHomeClick}
        >
          <Image
            src={BRAND.logo.src}
            alt=""
            width={1254}
            height={1254}
            loading="eager"
            unoptimized
            sizes="(max-width: 640px) 8.25rem, (max-width: 1280px) 13vw, 11.25rem"
            className="h-auto w-full"
          />
        </Link>

        <div className="relative z-20">
          <Navbar />
        </div>
      </div>
    </header>
  );
}
