import React from 'react';
import { Camera, Video, Gem } from 'lucide-react';

export const GailysLogo = () => (
  <div className="w-full h-full bg-[var(--palette-cream)] flex flex-col items-center justify-center relative overflow-hidden text-[var(--palette-night-card)]">
    <div className="absolute left-4 top-2 bottom-2 w-px bg-[var(--palette-night-card)]/40" />
    <div className="absolute right-4 top-2 bottom-2 w-px bg-[var(--palette-night-card)]/40" />
    <div className="flex flex-col items-center -mt-1">
      <span
        className="font-serif italic text-3xl md:text-4xl pr-4 -mr-4 tracking-tight"
        style={{ fontFamily: 'var(--font-zion-serif)' }}
      >
        Gaily&apos;s
      </span>
      <span className="text-xs md:text-xs tracking-[0.3em] font-medium mt-1 ml-6 uppercase">
        EST. 2019
      </span>
    </div>
  </div>
);

export const YKLogo = () => (
  <div className="w-full h-full bg-[var(--palette-cream)] flex flex-col items-center justify-center p-2 text-[var(--palette-night-card)]">
    <div className="flex items-center gap-2 md:gap-3 mb-1.5">
      <Camera className="w-6 h-6 md:w-8 md:h-8" strokeWidth={1.5} />
      <span className="font-serif font-bold text-xl md:text-2xl tracking-widest">Y K</span>
    </div>
    <div className="bg-[var(--palette-night-card)] text-white px-3 md:px-4 py-0.5 md:py-1">
      <span className="text-xs md:text-xs tracking-[0.25em] font-bold uppercase">PHOTO BOOTH</span>
    </div>
    <span className="text-xs md:text-xs tracking-[0.2em] font-medium mt-1.5 uppercase opacity-70">
      EST 2024
    </span>
  </div>
);

export const LALogo = () => (
  <div className="w-full h-full bg-surface flex flex-col items-center justify-center p-2 text-[var(--palette-night-card)]">
    <div className="w-10 h-10 md:w-12 md:h-12 rounded-full border-[1.5px] border-[var(--palette-night-card)] flex items-center justify-center relative mb-1.5 md:mb-2">
      <span className="font-serif italic text-xl md:text-2xl font-bold pr-1 -mr-1">
        L<span className="absolute -bottom-1 -right-1 text-lg md:text-xl">A</span>
      </span>
    </div>
    <div className="flex flex-col items-center">
      <span className="text-xs md:text-xs tracking-[0.3em] font-bold uppercase">
        LENNARD ANTONIO
      </span>
      <span className="text-xs md:text-xs tracking-[0.2em] font-medium uppercase opacity-60">
        MAKEUP ARTIST
      </span>
    </div>
  </div>
);

export const RGieLogo = () => (
  <div className="w-full h-full bg-surface flex items-center justify-center p-2 text-[var(--palette-night-card)]">
    <div className="flex flex-col mr-3 md:mr-4">
      <div className="bg-[var(--palette-danger)] text-white p-2 md:p-2.5 flex items-center justify-center rounded-sm">
        <Video className="w-5 h-5 md:w-6 md:h-6" strokeWidth={1.5} />
      </div>
      <div className="bg-[var(--palette-danger)] text-white h-1.5 md:h-2 w-full rounded-b-sm" />
    </div>
    <div className="flex flex-col justify-center border-l border-gray-200 pl-3 md:pl-4 py-1">
      <span className="font-bold text-lg md:text-xl text-[var(--palette-danger)] tracking-wider leading-none mb-1">
        R-GIE
      </span>
      <span className="font-bold text-sm md:text-base tracking-widest leading-none mb-1">
        GARCIA
      </span>
      <span className="text-xs md:text-xs tracking-[0.2em] font-bold text-gray-400 uppercase">
        FILMS
      </span>
    </div>
  </div>
);

export const MTLogo = () => (
  <div className="w-full h-full bg-[var(--palette-night)] flex flex-col items-center justify-center p-2 text-white">
    <div className="flex items-center gap-1 mb-2 md:mb-3 relative">
      <span className="text-2xl md:text-3xl font-light tracking-tighter">M</span>
      <div className="w-px h-6 md:h-8 bg-surface/40 mx-1 md:mx-2" />
      <span className="text-2xl md:text-3xl font-light tracking-tighter">T</span>
      <div className="absolute -top-1 -right-3 md:-right-4 opacity-70">
        <Video className="w-3 h-3 md:w-4 md:h-4" strokeWidth={1.5} />
      </div>
    </div>
    <span className="text-xs md:text-xs tracking-[0.35em] md:tracking-[0.4em] font-medium uppercase text-white/80">
      MARVIN TOMANDAO FILMS
    </span>
  </div>
);

export const YesStudioLogo = () => (
  <div className="w-full h-full bg-[var(--palette-border)] flex flex-col items-center justify-center p-2 text-[var(--palette-subtle)]">
    <div className="relative mb-1.5 md:mb-2">
      <Gem className="w-8 h-8 md:w-10 md:h-10" strokeWidth={1} />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-3 h-3 md:w-4 md:h-4 border-[1.5px] border-[var(--palette-subtle)] rounded-full translate-y-1" />
      </div>
    </div>
    <span className="font-serif text-sm md:text-base tracking-wide mb-0.5">
      It&apos;s a Yes Studio
    </span>
    <span className="text-xs md:text-xs tracking-[0.25em] uppercase opacity-70">
      Capturing Every Moment
    </span>
  </div>
);
