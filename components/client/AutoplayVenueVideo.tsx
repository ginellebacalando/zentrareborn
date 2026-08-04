'use client';

import { useEffect, useRef } from 'react';

type AutoplayVenueVideoProps = {
  poster: string;
  src: string;
};

export function AutoplayVenueVideo({ poster, src }: AutoplayVenueVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    const startPlayback = () => {
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
      }
    };

    startPlayback();
    video.addEventListener('canplay', startPlayback);
    window.addEventListener('pageshow', startPlayback);
    document.addEventListener('visibilitychange', resumeWhenVisible);

    return () => {
      video.removeEventListener('canplay', startPlayback);
      window.removeEventListener('pageshow', startPlayback);
      document.removeEventListener('visibilitychange', resumeWhenVisible);
    };
  }, [src]);

  return (
    <video
      ref={videoRef}
      className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
      autoPlay
      loop
      muted
      playsInline
      preload="auto"
      poster={poster}
      aria-hidden="true"
    >
      <source src={src} type="video/mp4" />
    </video>
  );
}
