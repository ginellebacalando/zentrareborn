'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import type { EventPackageHeroSlide } from '@/config/event-package-pages';
import { useReducedMotion } from '@/components/shared/useReducedMotion';
import { MediaPlaybackControl } from '@/components/client/MediaPlaybackControl';

const SLIDE_INTERVAL_MS = 5_500;

interface PackageHeroSectionProps {
  title: string;
  subtitle: string;
  slides: readonly EventPackageHeroSlide[];
  videoSrc?: string;
  videoPosition?: string;
}

export default function PackageHeroSection({
  title,
  subtitle,
  slides,
  videoSrc,
  videoPosition = 'object-center',
}: PackageHeroSectionProps) {
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

  const primaryPoster = slides[0]?.imageSrc;

  return (
    <section
      className="hero-scroll-stage relative isolate w-full bg-zion-dark"
      data-home-hero="true"
    >
      <div className="sticky top-0 flex min-h-[40rem] w-full items-center justify-center overflow-hidden px-[var(--layout-gutter)] pb-12 pt-36 text-center sm:min-h-svh">
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
                  return (
                    <Image
                      key={slide.imageSrc}
                      src={slide.imageSrc}
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
          className="pointer-events-none absolute inset-0 -z-10 bg-black/60"
        />

        <div className="hero-scroll-follow mx-auto flex max-w-5xl flex-col items-center text-white">
          <h1 className="page-title">{title}</h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/95 sm:text-lg">
            {subtitle}
          </p>
          <a
            href="#packages-booklet"
            className="group relative mt-8 inline-flex min-h-12 items-center justify-center overflow-hidden rounded-full border-2 border-[var(--palette-client-button)] bg-transparent px-9 py-3 font-sans text-sm font-bold uppercase tracking-[0.18em] text-white transition-all duration-500 hover:shadow-[0_18px_36px_-14px_color-mix(in_srgb,var(--palette-client-button)_55%,transparent)]"
          >
            <span
              aria-hidden="true"
              className="absolute inset-0 translate-y-full bg-[var(--palette-client-button)] transition-transform duration-500 ease-in-out group-hover:translate-y-0"
            />
            <span className="relative z-10 transition-colors duration-500 group-hover:text-ink">
              Explore packages
            </span>
          </a>
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
