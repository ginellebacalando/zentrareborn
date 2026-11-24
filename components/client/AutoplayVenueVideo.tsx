'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '@/components/shared/useReducedMotion';
import { MediaPlaybackControl } from './MediaPlaybackControl';

type AutoplayVenueVideoProps = {
  poster: string;
  src: string;
};

export function AutoplayVenueVideo({ poster, src }: AutoplayVenueVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(false);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    const startPlayback = () => {
      if (paused || reducedMotion || document.hidden) {
        video.pause();
        return;
      }
      video.muted = true;
      video.defaultMuted = true;

      if (!video.ended) {
        void video.play().catch(() => {
          // The autoplay attributes remain as the fallback for browsers that
          // temporarily defer programmatic playback.
        });
      }
    };

    const resumeWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        startPlayback();
      } else {
        video.pause();
      }
    };

    startPlayback();
    video.addEventListener('canplay', startPlayback);
    window.addEventListener('pageshow', startPlayback);
    document.addEventListener('visibilitychange', resumeWhenVisible);

    return () => {
      video.pause();
      video.removeEventListener('canplay', startPlayback);
      window.removeEventListener('pageshow', startPlayback);
      document.removeEventListener('visibilitychange', resumeWhenVisible);
    };
  }, [src, paused, reducedMotion]);

  return (
    <>
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
        loop
        muted
        playsInline
        preload="metadata"
        poster={poster}
        aria-hidden="true"
      >
        <source src={src} type="video/mp4" />
      </video>
      {!reducedMotion && (
        <MediaPlaybackControl
          className="absolute bottom-4 right-4 z-30"
          onClick={() => setPaused((value) => !value)}
          label={paused ? 'Play venue video' : 'Pause venue video'}
        />
      )}
    </>
  );
}
