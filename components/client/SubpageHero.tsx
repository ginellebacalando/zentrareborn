'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '@/components/shared/useReducedMotion';
import { MediaPlaybackControl } from './MediaPlaybackControl';

export interface SlideData {
  title: string;
  subtitle: string;
  imageSrc?: string;
  imageAlt?: string;
}

interface SubpageHeroProps {
  title?: string;
  subtitle?: string;
  imageSrc?: string;
  videoSrc?: string;
  slides?: readonly SlideData[];
  rotationMs?: number;
  transitionMs?: number;
  pauseOnHover?: boolean;
}

export default function SubpageHero({ videoSrc }: SubpageHeroProps) {
  const prefersReducedMotion = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isDocumentVisible, setIsDocumentVisible] = useState(true);

  useEffect(() => {
    if (!videoSrc) return;
    const updateVisibility = () => setIsDocumentVisible(document.visibilityState === 'visible');
    updateVisibility();
    document.addEventListener('visibilitychange', updateVisibility);
    return () => document.removeEventListener('visibilitychange', updateVisibility);
  }, [videoSrc]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoSrc) return;

    if (prefersReducedMotion || isPaused || !isDocumentVisible) {
      video.pause();
      return;
    }

    void video.play().catch(() => {});
  }, [isDocumentVisible, isPaused, prefersReducedMotion, videoSrc]);

  if (!videoSrc) {
    return (
      <section
        aria-label="Page header"
        className="relative z-0 flex min-h-20 w-full flex-col items-center justify-center overflow-hidden bg-transparent px-[var(--layout-gutter)]"
      />
    );
  }

  return (
    <section
      aria-label="Featured venue header"
      className="relative z-0 flex h-[clamp(22rem,52dvh,34rem)] min-h-[22rem] w-full flex-col items-center justify-center overflow-hidden bg-zion-dark px-[var(--layout-gutter)] text-center"
    >
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
        className="absolute inset-0 -z-10 h-full w-full object-cover"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[color-mix(in_srgb,var(--palette-zentra-night)_25%,transparent)]"
      />

      {!prefersReducedMotion && (
        <div className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] z-10">
          <MediaPlaybackControl
            onClick={() => setIsPaused((value) => !value)}
            label={isPaused ? 'Play header video' : 'Pause header video'}
          />
        </div>
      )}
    </section>
  );
}
