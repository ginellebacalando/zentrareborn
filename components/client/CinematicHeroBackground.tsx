'use client';

import { useEffect, useRef, useState } from 'react';
import { MediaPlaybackControl } from './MediaPlaybackControl';
import styles from './CinematicHeroBackground.module.css';

const VIDEO_CLIPS = [
  {
    src: '/videos/events/bridal-event.mp4',
    start: 0.15,
    end: 13.95,
    scene: 'bridal',
  },
  {
    src: '/videos/events/wedding-reception.mp4',
    start: 0.2,
    end: 8,
    scene: 'ballroom',
  },
  {
    src: '/videos/events/indoor-hall.mp4',
    start: 0.15,
    end: 8,
    scene: 'beach',
  },
  {
    src: '/videos/events/gender-reveal.mp4',
    start: 0.15,
    end: 8.05,
    scene: 'reception',
  },
] as const;

const CROSSFADE_SECONDS = 1.4;
const CROSSFADE_MS = CROSSFADE_SECONDS * 1000;

type VideoLayer = 0 | 1;

export default function CinematicHeroBackground() {
  const firstVideoRef = useRef<HTMLVideoElement>(null);
  const secondVideoRef = useRef<HTMLVideoElement>(null);
  const activeLayerRef = useRef<VideoLayer>(0);
  const activeClipIndexRef = useRef(0);
  const [activeLayer, setActiveLayer] = useState<VideoLayer>(0);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);

  const togglePlayback = () => {
    const nextPaused = !pausedRef.current;
    pausedRef.current = nextPaused;
    setPaused(nextPaused);
    const videos = [firstVideoRef.current, secondVideoRef.current];
    videos.forEach((video) => video?.pause());
    if (
      !nextPaused &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
      !document.hidden
    ) {
      void videos[activeLayerRef.current]?.play().catch(() => {});
    }
  };

  useEffect(() => {
    const firstVideo = firstVideoRef.current;
    const secondVideo = secondVideoRef.current;

    if (!firstVideo || !secondVideo) {
      return;
    }

    const videos = [firstVideo, secondVideo] as const;
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const recycleTimers = new Set<number>();
    let transitionInProgress = false;
    let disposed = false;

    const prepareVideo = (video: HTMLVideoElement, clipIndex: number) => {
      const clip = VIDEO_CLIPS[clipIndex];
      const expectedSource = new URL(clip.src, window.location.href).href;

      video.dataset.scene = clip.scene;
      video.dataset.clipIndex = String(clipIndex);
      video.preload = 'auto';

      if (video.currentSrc !== expectedSource) {
        video.src = clip.src;
        video.load();
      }
    };

    const playClip = (video: HTMLVideoElement, clipIndex: number) => {
      const clip = VIDEO_CLIPS[clipIndex];

      const beginPlayback = () => {
        if (disposed || video.dataset.clipIndex !== String(clipIndex)) {
          return;
        }

        video.currentTime = clip.start;

        if (!pausedRef.current && !reducedMotionQuery.matches && !document.hidden) {
          void video.play().catch(() => {
            // The static poster remains visible if autoplay is unavailable.
          });
        }
      };

      if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
        beginPlayback();
      } else {
        video.addEventListener('loadedmetadata', beginPlayback, { once: true });
      }
    };

    const transitionToNextClip = () => {
      if (disposed || pausedRef.current || transitionInProgress || reducedMotionQuery.matches) {
        return;
      }

      transitionInProgress = true;

      const previousLayer = activeLayerRef.current;
      const nextLayer: VideoLayer = previousLayer === 0 ? 1 : 0;
      const nextClipIndex = (activeClipIndexRef.current + 1) % VIDEO_CLIPS.length;
      const previousVideo = videos[previousLayer];
      const nextVideo = videos[nextLayer];

      playClip(nextVideo, nextClipIndex);
      activeLayerRef.current = nextLayer;
      activeClipIndexRef.current = nextClipIndex;
      setActiveLayer(nextLayer);

      const recycleTimer = window.setTimeout(() => {
        recycleTimers.delete(recycleTimer);

        if (disposed) {
          return;
        }

        previousVideo.pause();

        const futureClipIndex = (nextClipIndex + 1) % VIDEO_CLIPS.length;
        prepareVideo(previousVideo, futureClipIndex);
        transitionInProgress = false;
      }, CROSSFADE_MS + 120);

      recycleTimers.add(recycleTimer);
    };

    const handleFirstTimeUpdate = () => {
      if (activeLayerRef.current !== 0) {
        return;
      }

      const activeClip = VIDEO_CLIPS[activeClipIndexRef.current];
      if (videos[0].currentTime >= activeClip.end - CROSSFADE_SECONDS) {
        transitionToNextClip();
      }
    };

    const handleSecondTimeUpdate = () => {
      if (activeLayerRef.current !== 1) {
        return;
      }

      const activeClip = VIDEO_CLIPS[activeClipIndexRef.current];
      if (videos[1].currentTime >= activeClip.end - CROSSFADE_SECONDS) {
        transitionToNextClip();
      }
    };

    const handleFirstEnded = () => {
      if (activeLayerRef.current === 0) {
        transitionToNextClip();
      }
    };

    const handleSecondEnded = () => {
      if (activeLayerRef.current === 1) {
        transitionToNextClip();
      }
    };

    const handleVisibilityChange = () => {
      if (pausedRef.current || document.hidden || reducedMotionQuery.matches) {
        videos.forEach((video) => video.pause());
        return;
      }

      const activeVideo = videos[activeLayerRef.current];
      void activeVideo.play().catch(() => {
        // Keep the current poster frame if playback cannot resume.
      });
    };

    const handleMotionPreferenceChange = () => {
      handleVisibilityChange();
    };

    prepareVideo(videos[0], 0);
    prepareVideo(videos[1], 1);
    playClip(videos[0], 0);

    videos[0].addEventListener('timeupdate', handleFirstTimeUpdate);
    videos[1].addEventListener('timeupdate', handleSecondTimeUpdate);
    videos[0].addEventListener('ended', handleFirstEnded);
    videos[1].addEventListener('ended', handleSecondEnded);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    reducedMotionQuery.addEventListener('change', handleMotionPreferenceChange);

    if (reducedMotionQuery.matches) {
      videos.forEach((video) => video.pause());
    }

    return () => {
      disposed = true;
      recycleTimers.forEach((timer) => window.clearTimeout(timer));
      videos.forEach((video) => video.pause());
      videos[0].removeEventListener('timeupdate', handleFirstTimeUpdate);
      videos[1].removeEventListener('timeupdate', handleSecondTimeUpdate);
      videos[0].removeEventListener('ended', handleFirstEnded);
      videos[1].removeEventListener('ended', handleSecondEnded);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      reducedMotionQuery.removeEventListener('change', handleMotionPreferenceChange);
    };
  }, []);

  return (
    <div className={styles.stage}>
      <video
        ref={firstVideoRef}
        aria-hidden="true"
        className={`${styles.video} ${activeLayer === 0 ? styles.active : ''}`}
        muted
        playsInline
        preload="auto"
        poster="/images/events/weddings/elegant-lakefront-wedding-ceremony-with-white-floral-arch-luxury-aisle-inspiration.webp"
        disablePictureInPicture
        tabIndex={-1}
      />

      <video
        ref={secondVideoRef}
        aria-hidden="true"
        className={`${styles.video} ${activeLayer === 1 ? styles.active : ''}`}
        muted
        playsInline
        preload="auto"
        poster="/images/events/weddings/elegant-lakefront-wedding-ceremony-with-white-floral-arch-luxury-aisle-inspiration.webp"
        disablePictureInPicture
        tabIndex={-1}
      />
      <MediaPlaybackControl
        className={styles.playbackControl}
        onClick={togglePlayback}
        label={paused ? 'Play background video' : 'Pause background video'}
      />
    </div>
  );
}
