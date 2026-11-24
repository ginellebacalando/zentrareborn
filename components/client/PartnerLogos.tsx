import React from 'react';
import { Camera, Gem, Video } from 'lucide-react';

export const GailysLogo = () => (
  <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-[var(--palette-cream)] px-6 py-4 text-[var(--palette-night-card)]">
    <div
      aria-hidden="true"
      className="absolute top-3 bottom-3 left-4 w-px bg-[var(--palette-night-card)]/30"
    />
    <div
      aria-hidden="true"
      className="absolute top-3 right-4 bottom-3 w-px bg-[var(--palette-night-card)]/30"
    />
    <span
      className="font-serif text-3xl italic tracking-tight sm:text-4xl"
      style={{ fontFamily: 'var(--font-zion-serif)' }}
    >
      Gaily&apos;s
    </span>
    <span className="mt-1.5 font-sans text-xs font-medium uppercase tracking-[0.28em] opacity-75">
      EST. 2019
    </span>
  </div>
);

export const YKLogo = () => (
  <div className="flex h-full w-full flex-col items-center justify-center bg-[var(--palette-cream)] px-4 py-3 text-[var(--palette-night-card)]">
    <div className="mb-1.5 flex items-center gap-2">
      <Camera className="h-6 w-6 sm:h-7 sm:w-7" strokeWidth={1.6} aria-hidden="true" />
      <span className="font-serif text-xl font-bold tracking-[0.2em] sm:text-2xl">Y K</span>
    </div>
    <div className="rounded-sm bg-[var(--palette-night-card)] px-3.5 py-1 text-[var(--palette-white)]">
      <span className="font-sans text-xs font-bold uppercase tracking-[0.22em]">PHOTO BOOTH</span>
    </div>
    <span className="mt-1.5 font-sans text-xs font-medium uppercase tracking-[0.2em] opacity-70">
      EST 2024
    </span>
  </div>
);

export const LALogo = () => (
  <div className="flex h-full w-full flex-col items-center justify-center bg-[var(--palette-white)] px-4 py-3 text-[var(--palette-night-card)]">
    <div className="relative mb-2 flex h-11 w-11 items-center justify-center rounded-full border-[1.5px] border-[var(--palette-night-card)]">
      <span className="font-serif text-xl font-bold italic">
        L<span className="ml-0.5 text-base">A</span>
      </span>
    </div>
    <span className="text-center font-sans text-xs font-bold uppercase tracking-[0.24em]">
      LENNARD ANTONIO
    </span>
    <span className="mt-0.5 font-sans text-xs font-medium uppercase tracking-[0.18em] opacity-60">
      MAKEUP ARTIST
    </span>
  </div>
);

export const RGieLogo = () => (
  <div className="flex h-full w-full items-center justify-center gap-3.5 bg-[var(--palette-white)] px-4 py-3 text-[var(--palette-night-card)]">
    <div className="flex flex-col">
      <div className="flex items-center justify-center rounded-sm bg-[var(--palette-danger)] p-2.5 text-[var(--palette-white)]">
        <Video className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={1.6} aria-hidden="true" />
      </div>
      <div className="mt-0.5 h-1.5 w-full rounded-b-sm bg-[var(--palette-danger)]" />
    </div>
    <div className="flex flex-col justify-center border-l border-[var(--palette-gold)]/25 py-0.5 pl-3.5">
      <span className="font-sans text-lg font-bold leading-none tracking-wider text-[var(--palette-danger)] sm:text-xl">
        R-GIE
      </span>
      <span className="mt-1 font-sans text-sm font-bold leading-none tracking-[0.18em] sm:text-base">
        GARCIA
      </span>
      <span className="mt-1 font-sans text-xs font-bold uppercase tracking-[0.2em] text-ink/50">
        FILMS
      </span>
    </div>
  </div>
);

export const MTLogo = () => (
  <div className="flex h-full w-full flex-col items-center justify-center bg-[var(--palette-night)] px-4 py-3 text-[var(--palette-white)]">
    <div className="relative mb-2 flex items-center gap-1.5">
      <span className="font-sans text-2xl font-light tracking-tight sm:text-3xl">M</span>
      <div aria-hidden="true" className="mx-1 h-6 w-px bg-[var(--palette-white)]/40 sm:h-7" />
      <span className="font-sans text-2xl font-light tracking-tight sm:text-3xl">T</span>
      <Video className="ml-1 h-3.5 w-3.5 opacity-75" strokeWidth={1.6} aria-hidden="true" />
    </div>
    <span className="text-center font-sans text-xs font-medium uppercase tracking-[0.22em] text-[var(--palette-white)]/85">
      MARVIN TOMANDAO FILMS
    </span>
  </div>
);

export const YesStudioLogo = () => (
  <div className="flex h-full w-full flex-col items-center justify-center bg-[var(--palette-border)] px-4 py-3 text-[var(--palette-subtle)]">
    <div className="relative mb-1.5 flex items-center justify-center">
      <Gem className="h-8 w-8 sm:h-9 sm:w-9" strokeWidth={1.1} aria-hidden="true" />
      <span
        aria-hidden="true"
        className="absolute h-3 w-3 translate-y-0.5 rounded-full border-[1.5px] border-[var(--palette-subtle)]"
      />
    </div>
    <span className="font-serif text-base font-medium tracking-wide sm:text-lg">
      It&apos;s a Yes Studio
    </span>
    <span className="mt-0.5 text-center font-sans text-xs uppercase tracking-[0.18em] opacity-80">
      Capturing Every Moment
    </span>
  </div>
);
