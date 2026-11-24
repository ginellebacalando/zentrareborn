'use client';

import React, { useState } from 'react';
import Image from 'next/image';

const IMAGES = [
  '/images/events/gender-reveals/gender-reveal-3.webp',
  '/images/events/debuts-birthdays/birthday-2.webp',
  '/images/events/weddings/wedding-2.webp',
];

export default function ImageSlideshow() {
  const [currentIndex, setCurrentIndex] = useState(0);

  return (
    <div
      className="absolute inset-0 z-0 overflow-hidden"
      role="group"
      aria-label="Celebration photographs"
    >
      {IMAGES.map((src, idx) => (
        <div
          key={src}
          aria-hidden={idx !== currentIndex}
          className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${idx === currentIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
        >
          <Image
            src={src}
            alt={
              [
                'A gender reveal celebration at Zion',
                'A birthday celebration at Zion',
                'A wedding celebration at Zion',
              ][idx]
            }
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover object-center"
          />
        </div>
      ))}

      {/* Navigation Dots */}
      <div className="absolute bottom-6 left-0 right-0 z-20 flex justify-center items-center gap-3">
        {IMAGES.map((_, idx) => (
          <button
            key={idx}
            type="button"
            aria-current={idx === currentIndex ? 'true' : undefined}
            onClick={() => setCurrentIndex(idx)}
            className="touch-target flex items-center justify-center rounded-full bg-black/60"
            aria-label={`Go to slide ${idx + 1}`}
          >
            <span
              aria-hidden="true"
              className={`h-1.5 rounded-full ${idx === currentIndex ? 'w-8 bg-zion-accent' : 'w-3 bg-surface'}`}
            />
          </button>
        ))}
      </div>
      <span className="sr-only" aria-live="polite">
        Photograph {currentIndex + 1} of {IMAGES.length}
      </span>
    </div>
  );
}
