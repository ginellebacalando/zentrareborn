'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { optimizedPublicMediaPath } from '@/lib/public-media';
import { useReducedMotion } from '@/components/shared/useReducedMotion';
import { MediaPlaybackControl } from './MediaPlaybackControl';

const SLIDE_INTERVAL_MS = 5_500;

export interface CinematicHeroSlide {
  imageSrc: string;
  imageAlt?: string;
}

interface CinematicPageHeroProps {
  title: string;
  subtitle: string;
  slides: readonly CinematicHeroSlide[];
  videoSrc?: string;
  videoPosition?: string;
  ctaLabel?: string;
  ctaHref?: string;
}

export default function CinematicPageHero({
  title,
  subtitle,
  slides,
  videoSrc,
  videoPosition = 'object-center',
  ctaLabel,
  ctaHref,
}: CinematicPageHeroProps) {
  const prefersReducedMotion = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isDocumentVisible, setIsDocumentVisible] = useState(true);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  useEffect(() => {
    const updateVisibility = () => setIsDocumentVisible(document.visibilityState === 'visible');
    updateVisibility();
    document.addEventListener('visibilitychange', updateVisibility);
    return () => document.removeEventListener('visibilitychange', updateVisibility);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoSrc) return;

    if (prefersReducedMotion || isPaused || !isDocumentVisible) {
      video.pause();
      return;
    }

    void video.play().catch(() => {});
  }, [isDocumentVisible, isPaused, prefersReducedMotion, videoSrc]);

  useEffect(() => {
    if (videoSrc || prefersReducedMotion || isPaused || !isDocumentVisible || slides.length < 2) {
      return;
    }

    const timer = window.setInterval(() => {
      setActiveSlideIndex((current) => (current + 1) % slides.length);
    }, SLIDE_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [isDocumentVisible, isPaused, prefersReducedMotion, slides.length, videoSrc]);

  const primaryPoster = slides[0]?.imageSrc
    ? optimizedPublicMediaPath(slides[0].imageSrc)
    : undefined;

  return (
    <section className="relative isolate w-full bg-zion-dark">
      <div className="relative flex min-h-[clamp(24rem,60svh,38rem)] w-full items-center justify-center overflow-hidden px-[var(--layout-gutter)] py-20 text-center">
        <div className="absolute inset-0 -z-20 bg-zion-dark">
          {videoSrc ? (
            <video
              ref={videoRef}
              src={videoSrc}
              aria-hidden="true"
              loop
              muted
              playsInline
              preload="auto"
              disablePictureInPicture
              tabIndex={-1}
              className={`absolute inset-0 h-full w-full object-cover ${videoPosition}`}
            />
          ) : (
            <>
              {primaryPoster && (
                <Image
                  src={primaryPoster}
                  alt=""
                  fill
                  preload
                  sizes="100vw"
                  className="object-cover"
                />
              )}
              <div aria-hidden="true" className="absolute inset-0 motion-reduce:hidden">
                {slides.map((slide, index) => {
                  const isActive = index === activeSlideIndex;
                  const slideSrc = optimizedPublicMediaPath(slide.imageSrc);
                  return (
                    <Image
                      key={slideSrc}
                      src={slideSrc}
                      alt=""
                      fill
                      sizes="100vw"
                      className={`object-cover transition-all duration-[1400ms] ease-in-out ${
                        isActive ? 'scale-100 opacity-100' : 'scale-105 opacity-0'
                      }`}
                    />
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-[color-mix(in_srgb,var(--palette-zentra-night)_58%,transparent)]"
        />

        <div className="mx-auto flex max-w-5xl flex-col items-center text-white">
          <h1 className="page-title">{title}</h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/95 sm:text-lg">
            {subtitle}
          </p>
          {ctaLabel && ctaHref && (
            <a
              href={ctaHref}
              className="mt-8 inline-flex min-h-11 items-center justify-center border border-[var(--palette-white)] bg-transparent px-8 py-3 font-sans text-sm font-semibold uppercase tracking-[0.16em] text-white transition-colors duration-200 hover:bg-[var(--palette-white)] hover:text-zentra-green focus-visible:bg-[var(--palette-white)] focus-visible:text-zentra-green"
            >
              {ctaLabel}
            </a>
          )}
        </div>

        {!prefersReducedMotion && (
          <div className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-10">
            <MediaPlaybackControl
              onClick={() => setIsPaused((value) => !value)}
              label={
                videoSrc
                  ? isPaused
                    ? 'Play background video'
                    : 'Pause background video'
                  : isPaused
                    ? 'Play header slideshow'
                    : 'Pause header slideshow'
              }
            />
          </div>
        )}
      </div>
    </section>
  );
}
