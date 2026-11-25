'use client';

import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { homeHeroSlides } from '@/config/home';
import { useReducedMotion } from '@/components/shared/useReducedMotion';
import styles from './HeroSection.module.css';

/** Figma home hero: a full-width photo carousel with a centered headline and an outlined CTA. */
const SLIDE_INTERVAL_MS = 7000;
const SWIPE_THRESHOLD_PX = 40;

export default function HeroSection() {
  const slides = homeHeroSlides;
  const reducedMotion = useReducedMotion();
  const [active, setActive] = useState(0);
  const [userPaused, setUserPaused] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const [announce, setAnnounce] = useState(false);
  const pointerStart = useRef<number | null>(null);
  const autoplay = !reducedMotion && !userPaused && !interacting;

  const goTo = useCallback(
    (index: number, fromUser = true) => {
      setActive((index + slides.length) % slides.length);
      if (fromUser) setAnnounce(true);
    },
    [slides.length],
  );

  useEffect(() => {
    if (!autoplay) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') goTo(active + 1, false);
    }, SLIDE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [active, autoplay, goTo]);

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    pointerStart.current = event.clientX;
  };
  const onPointerUp = (event: PointerEvent<HTMLElement>) => {
    if (pointerStart.current === null) return;
    const distance = event.clientX - pointerStart.current;
    pointerStart.current = null;
    if (Math.abs(distance) >= SWIPE_THRESHOLD_PX) goTo(active + (distance < 0 ? 1 : -1));
  };

  return (
    <section
      className={styles.hero}
      aria-roledescription="carousel"
      aria-label="Zion Events Place highlights"
      onMouseEnter={() => setInteracting(true)}
      onMouseLeave={() => setInteracting(false)}
      onFocus={() => setInteracting(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setInteracting(false);
      }}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      <h1 className="sr-only">Zion Events Place, an events venue in San Pedro, Laguna</h1>
      <div className={styles.track} aria-live={announce && !autoplay ? 'polite' : 'off'}>
        {slides.map((slide, index) => {
          const isActive = index === active;
          return (
            <div
              key={slide.imageSrc}
              className={styles.slide}
              data-active={isActive ? 'true' : 'false'}
              role="group"
              aria-roledescription="slide"
              aria-label={`${index + 1} of ${slides.length}`}
              aria-hidden={!isActive}
              inert={!isActive}
            >
              <Image
                src={slide.imageSrc}
                alt={slide.imageAlt}
                fill
                sizes="100vw"
                preload={index === 0}
                className={styles.photo}
              />
              <div className={styles.scrim} aria-hidden="true" />
              <div className={styles.content}>
                <p className={styles.title}>{slide.title}</p>
                <p className={styles.subtitle}>{slide.subtitle}</p>
                {/* Book Now stays in the header on every page, so the hero offers the next steps. */}
                <div className={styles.actions}>
                  <Link href="#event-packages" className={styles.primary}>
                    See packages
                  </Link>
                  <Link href="#available-dates" className={styles.secondary}>
                    Check a date
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        className={`${styles.arrow} ${styles.previous}`}
        onClick={() => goTo(active - 1)}
        aria-label="Previous slide"
      >
        <ChevronLeft aria-hidden="true" />
      </button>
      <button
        type="button"
        className={`${styles.arrow} ${styles.next}`}
        onClick={() => goTo(active + 1)}
        aria-label="Next slide"
      >
        <ChevronRight aria-hidden="true" />
      </button>

      <div className={styles.controls}>
        <div className={styles.dots}>
          {slides.map((slide, index) => (
            <button
              key={slide.imageSrc}
              type="button"
              className={styles.dot}
              onClick={() => goTo(index)}
              aria-label={`Show slide ${index + 1}: ${slide.title}`}
              aria-current={index === active ? 'true' : undefined}
            >
              <span aria-hidden="true" />
            </button>
          ))}
        </div>
        {reducedMotion ? null : (
          <button
            type="button"
            className={styles.pause}
            onClick={() => setUserPaused((paused) => !paused)}
            aria-label={userPaused ? 'Play slideshow' : 'Pause slideshow'}
            aria-pressed={userPaused}
          >
            {userPaused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
          </button>
        )}
      </div>
    </section>
  );
}
