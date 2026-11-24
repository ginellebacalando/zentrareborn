'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BRAND } from '@/config/brand';
import { useReducedMotion } from '@/components/shared/useReducedMotion';
import { MediaPlaybackControl } from './MediaPlaybackControl';

const VIDEO_FADE_LEAD_SECONDS = 1.2;
const LOGO_POPUP_HOLD_MS = 2_200;
const LOGO_FADE_OUT_MS = 950;

interface AboutMomentsBannerProps {
  videoSrc?: string;
}

export default function AboutMomentsBanner({
  videoSrc = '/videos/hero/about-hero.mp4',
}: AboutMomentsBannerProps) {
  const prefersReducedMotion = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement>(null);
  const outroHoldTimerRef = useRef<number | null>(null);
  const outroRestartTimerRef = useRef<number | null>(null);
  const outroActiveRef = useRef(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isDocumentVisible, setIsDocumentVisible] = useState(true);
  const [videoVisible, setVideoVisible] = useState(false);
  const [showEndLogo, setShowEndLogo] = useState(false);

  const clearOutroTimers = useCallback(() => {
    if (outroHoldTimerRef.current !== null) {
      window.clearTimeout(outroHoldTimerRef.current);
      outroHoldTimerRef.current = null;
    }
    if (outroRestartTimerRef.current !== null) {
      window.clearTimeout(outroRestartTimerRef.current);
      outroRestartTimerRef.current = null;
    }
  }, []);

  const scheduleOutroCycle = useCallback(() => {
    clearOutroTimers();
    outroActiveRef.current = true;
    setVideoVisible(false);
    setShowEndLogo(true);

    outroHoldTimerRef.current = window.setTimeout(() => {
      outroHoldTimerRef.current = null;
      setShowEndLogo(false);

      outroRestartTimerRef.current = window.setTimeout(() => {
        outroRestartTimerRef.current = null;
        outroActiveRef.current = false;
        const video = videoRef.current;
        if (!video) return;
        video.currentTime = 0;
        void video
          .play()
          .then(() => setVideoVisible(true))
          .catch(() => {});
      }, LOGO_FADE_OUT_MS);
    }, LOGO_POPUP_HOLD_MS);
  }, [clearOutroTimers]);

  useEffect(() => {
    const updateVisibility = () => setIsDocumentVisible(document.visibilityState === 'visible');
    updateVisibility();
    document.addEventListener('visibilitychange', updateVisibility);
    return () => document.removeEventListener('visibilitychange', updateVisibility);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (prefersReducedMotion || isPaused || !isDocumentVisible) {
      video.pause();
      clearOutroTimers();
      return;
    }

    if (outroActiveRef.current) {
      scheduleOutroCycle();
      return;
    }

    if (video.ended) {
      video.currentTime = 0;
    }

    void video
      .play()
      .then(() => setVideoVisible(true))
      .catch(() => {});
  }, [clearOutroTimers, isDocumentVisible, isPaused, prefersReducedMotion, scheduleOutroCycle]);

  useEffect(() => {
    return () => {
      clearOutroTimers();
    };
  }, [clearOutroTimers]);

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (
      !video ||
      prefersReducedMotion ||
      isPaused ||
      !isDocumentVisible ||
      outroActiveRef.current
    ) {
      return;
    }

    if (
      Number.isFinite(video.duration) &&
      video.duration > VIDEO_FADE_LEAD_SECONDS &&
      video.currentTime >= video.duration - VIDEO_FADE_LEAD_SECONDS
    ) {
      setVideoVisible(false);
    }
  };

  const handleEnded = () => {
    if (prefersReducedMotion || isPaused || !isDocumentVisible) {
      outroActiveRef.current = true;
      setVideoVisible(false);
      setShowEndLogo(true);
      return;
    }
    scheduleOutroCycle();
  };

  return (
    <section
      aria-label="Moments made timeless"
      className="relative mt-8 mb-2 h-[44vh] min-h-[340px] w-full overflow-hidden bg-zion-dark md:mb-4"
    >
      <video
        ref={videoRef}
        src={videoSrc}
        aria-hidden="true"
        muted
        playsInline
        preload="auto"
        disablePictureInPicture
        tabIndex={-1}
        onPlaying={() => {
          if (!outroActiveRef.current) {
            setVideoVisible(true);
          }
        }}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[1200ms] ease-in-out ${
          videoVisible ? 'opacity-100' : 'opacity-0'
        }`}
      />

      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 bg-black/45" />

      <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-4">
        <h2
          className={`text-center font-segoe text-4xl text-white drop-shadow-xl transition-all duration-1000 ease-in-out md:text-6xl ${
            showEndLogo && !prefersReducedMotion ? 'scale-95 opacity-0' : 'scale-100 opacity-100'
          }`}
        >
          Moments made timeless
        </h2>
      </div>

      <div
        aria-hidden={!showEndLogo}
        className={`pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-4 transition-all duration-1000 ease-out motion-reduce:hidden ${
          showEndLogo ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
        }`}
      >
        <div className="w-[clamp(9.5rem,18vw,14rem)]">
          <Image
            src={BRAND.logo.src}
            alt={BRAND.logo.alt}
            width={1254}
            height={1254}
            unoptimized
            className="cream-brand-logo-image h-auto w-full drop-shadow-lg"
          />
        </div>
      </div>

      {!prefersReducedMotion && (
        <div className="absolute bottom-4 right-4 z-30">
          <MediaPlaybackControl
            onClick={() => setIsPaused((value) => !value)}
            label={isPaused ? 'Play banner video' : 'Pause banner video'}
          />
        </div>
      )}
    </section>
  );
}
