'use client';

import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { homeHeroSlides } from '@/config/home';
import { useReducedMotion } from '@/components/shared/useReducedMotion';
import { ButtonAnchor } from '@/components/shared/Button';
import styles from './HeroSection.module.css';

/**
 * Figma home hero: a full-width photo carousel with a centered headline and an outlined CTA.
 * The slides advance on their own, pausing while the pointer or keyboard focus is inside and
 * staying still under reduced motion. At the group's request (QA, 26 November 2026) there is no
 * pause button; docs/design-change-log.md records this exception to WCAG 2.2.2.
 */
const SLIDE_INTERVAL_MS = 7000;
const SWIPE_THRESHOLD_PX = 40;

export default function HeroSection() {
  const slides = homeHeroSlides;
  const reducedMotion = useReducedMotion();
  const [active, setActive] = useState(0);
  const [interacting, setInteracting] = useState(false);
  const [announce, setAnnounce] = useState(false);
  const pointerStart = useRef<number | null>(null);
  const autoplay = !reducedMotion && !interacting;

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
                {/* Book Now stays in the header on every page, so the hero offers the next steps.
                    Plain links: the browser scrolls to the section on every click, while Next's
                    Link skipped the scroll once the address already ended in the same #section. */}
                <div className={styles.actions}>
                  <ButtonAnchor href="#event-packages" variant="primary" size="lg" inverse>
                    See packages
                  </ButtonAnchor>
                  <ButtonAnchor href="#available-dates" variant="secondary" size="lg" inverse>
                    Check a date
                  </ButtonAnchor>
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
      </div>
    </section>
  );
}
