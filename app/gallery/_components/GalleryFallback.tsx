'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { motion, useMotionValue, useTransform, AnimatePresence, type PanInfo } from 'framer-motion';
import PublicSubpageShell from '@/components/client/PublicSubpageShell';
import FadeIn from '@/components/shared/FadeIn';
import { X, Heart, RotateCcw, Image as ImageIcon } from 'lucide-react';

type Category =
  'All' | 'Weddings' | 'Birthdays' | 'Debuts' | 'Gender Reveal' | 'Christmas Party' | 'Christening';
const categories: Category[] = [
  'All',
  'Weddings',
  'Birthdays',
  'Debuts',
  'Gender Reveal',
  'Christmas Party',
  'Christening',
];

const galleryData = [
  {
    id: 1,
    category: 'Weddings',
    src: 'https://images.unsplash.com/photo-1519225421980-715cb0215aed?q=80&w=2070&auto=format&fit=crop',
    alt: 'Wedding Ceremony Setup',
  },
  {
    id: 2,
    category: 'Weddings',
    src: '/images/events/christenings/christening-3.webp',
    alt: 'Wedding Reception Decor',
  },
  {
    id: 3,
    category: 'Weddings',
    src: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?q=80&w=2070&auto=format&fit=crop',
    alt: 'Wedding Details',
  },
  {
    id: 4,
    category: 'Weddings',
    src: 'https://images.unsplash.com/photo-1511895426328-dc8714191300?q=80&w=2070&auto=format&fit=crop',
    alt: 'Wedding Couple',
  },
  {
    id: 5,
    category: 'Birthdays',
    src: 'https://images.unsplash.com/photo-1530103862676-de8892f12703?q=80&w=2070&auto=format&fit=crop',
    alt: 'Birthday Celebration',
  },
  {
    id: 6,
    category: 'Birthdays',
    src: 'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?q=80&w=2069&auto=format&fit=crop',
    alt: 'Birthday Cake and Decor',
  },
  {
    id: 7,
    category: 'Birthdays',
    src: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?q=80&w=2070&auto=format&fit=crop',
    alt: 'Birthday Party Setup',
  },
  {
    id: 8,
    category: 'Debuts',
    src: 'https://images.unsplash.com/photo-1542614471-001ccf2bb8cb?q=80&w=2070&auto=format&fit=crop',
    alt: 'Debutant Gown',
  },
  {
    id: 9,
    category: 'Debuts',
    src: 'https://images.unsplash.com/photo-1505236858219-8359eb29e329?q=80&w=2162&auto=format&fit=crop',
    alt: 'Debut Celebration Lights',
  },
  {
    id: 10,
    category: 'Debuts',
    src: 'https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=2070&auto=format&fit=crop',
    alt: 'Debut Venue Setup',
  },
  {
    id: 11,
    category: 'Gender Reveal',
    src: 'https://images.unsplash.com/photo-1596770289871-38290378b2d1?q=80&w=2070&auto=format&fit=crop',
    alt: 'Gender Reveal Balloons',
  },
  {
    id: 12,
    category: 'Gender Reveal',
    src: 'https://images.unsplash.com/photo-1543419997-7690a2a53716?q=80&w=2070&auto=format&fit=crop',
    alt: 'Gender Reveal Party Box',
  },
  {
    id: 13,
    category: 'Christmas Party',
    src: 'https://images.unsplash.com/photo-1512474932049-78ac69ede12c?q=80&w=2070&auto=format&fit=crop',
    alt: 'Christmas Party Table',
  },
  {
    id: 14,
    category: 'Christmas Party',
    src: 'https://images.unsplash.com/photo-1543589077-47d81606c1bf?q=80&w=2070&auto=format&fit=crop',
    alt: 'Christmas Celebration',
  },
  {
    id: 15,
    category: 'Christening',
    src: 'https://images.unsplash.com/photo-1555529733-0e67056058bb?q=80&w=2070&auto=format&fit=crop',
    alt: 'Christening Decor',
  },
  {
    id: 16,
    category: 'Christening',
    src: 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?q=80&w=2075&auto=format&fit=crop',
    alt: 'Baby Toys and Decor',
  },
];

const SwipeCard = ({
  img,
  isTop,
  onSwipe,
  zIndex,
}: {
  img: (typeof galleryData)[0];
  isTop: boolean;
  onSwipe: (dir: 'left' | 'right') => void;
  zIndex: number;
}) => {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-8, 8]);
  // Like/Pass badge opacities mapped to drag distance
  const likeOpacity = useTransform(x, [20, 100], [0, 1]);
  const nopeOpacity = useTransform(x, [-20, -100], [0, 1]);

  const handleDragEnd = (_event: PointerEvent, info: PanInfo) => {
    if (info.offset.x > 100) {
      onSwipe('right');
    } else if (info.offset.x < -100) {
      onSwipe('left');
    }
  };

  return (
    <motion.div
      className={`absolute inset-0 w-full h-full rounded-[2.5rem] shadow-[0_20px_50px_color-mix(in_srgb,var(--palette-night)_15%,transparent)] overflow-hidden bg-neutral-100 ${isTop ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none'}`}
      style={{
        x: isTop ? x : 0,
        rotate: isTop ? rotate : 0,
        zIndex,
      }}
      drag={isTop ? 'x' : false}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={0.9}
      onDragEnd={handleDragEnd}
      initial={{ scale: 0.95, opacity: 0, y: 20 }}
      animate={{ scale: isTop ? 1 : 0.95, opacity: 1, y: isTop ? 0 : 20 }}
      exit={{ x: x.get() > 0 ? 500 : -500, opacity: 0, transition: { duration: 0.3 } }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
    >
      <Image
        src={img.src}
        alt={img.alt}
        fill
        sizes="(max-width: 768px) 90vw, 48rem"
        className="object-cover select-none pointer-events-none"
        draggable={false}
      />

      {/* Overlay Gradient */}
      <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />

      {/* Swipe Badges */}
      {isTop && (
        <>
          <motion.div
            style={{ opacity: likeOpacity }}
            className="absolute top-10 left-10 px-6 py-2 border-4 border-[var(--palette-night-border)] text-[var(--palette-night-border)] font-black text-3xl tracking-widest rounded-xl uppercase rotate-[-15deg] pointer-events-none z-10 bg-surface/10 backdrop-blur-sm"
          >
            LIKE
          </motion.div>
          <motion.div
            style={{ opacity: nopeOpacity }}
            className="absolute top-10 right-10 px-6 py-2 border-4 border-[var(--palette-danger)] text-[var(--palette-danger)] font-black text-3xl tracking-widest rounded-xl uppercase rotate-[15deg] pointer-events-none z-10 bg-surface/10 backdrop-blur-sm"
          >
            NOPE
          </motion.div>
        </>
      )}

      {/* Content */}
      <div className="absolute bottom-8 left-8 right-8 text-white pointer-events-none">
        <div className="inline-block px-4 py-1.5 bg-zion-accent/90 backdrop-blur-md rounded-full text-xs font-bold tracking-[0.2em] uppercase mb-4 shadow-lg text-black">
          {img.category}
        </div>
        <h2 className="text-3xl md:text-4xl font-bold leading-tight mb-2 text-shadow-sm font-sahitya">
          {img.alt}
        </h2>
        <div className="flex items-center gap-2 text-white/80 text-sm mt-3">
          <ImageIcon className="w-4 h-4" />
          <span>Swipe to explore gallery</span>
        </div>
      </div>
    </motion.div>
  );
};

export default function GalleryFallback() {
  const [activeFilter, setActiveFilter] = useState<Category>('All');
  const [currentIndex, setCurrentIndex] = useState(0);

  // Filter categories to render rows for
  const images =
    activeFilter === 'All'
      ? galleryData
      : galleryData.filter((img) => img.category === activeFilter);

  const handleSwipe = () => {
    setCurrentIndex((prev) => prev + 1);
  };

  const restartGallery = () => {
    setCurrentIndex(0);
  };

  const isFinished = currentIndex >= images.length;
  const currentImages = images.slice(currentIndex, currentIndex + 2); // Show top 2 cards for performance

  return (
    <PublicSubpageShell heroKey="gallery">
      <section className="max-w-7xl mx-auto px-4 md:px-12 py-10 md:py-16 w-full min-h-[90vh] flex flex-col items-center">
        {/* Filter Bar */}
        <FadeIn direction="up" className="flex flex-col items-center mb-8 md:mb-12 w-full">
          <div className="flex flex-wrap justify-center gap-4 md:gap-8 pb-4 border-b border-zion-accent/20 w-full max-w-4xl">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => {
                  setActiveFilter(category);
                  setCurrentIndex(0);
                }}
                className={`relative px-4 py-2 rounded-full font-sans text-xs md:text-sm uppercase tracking-[0.1em] transition-all duration-300 ${
                  activeFilter === category
                    ? 'bg-zion-accent text-white font-bold shadow-md'
                    : 'bg-transparent text-muted hover:bg-neutral-100 hover:text-ink'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </FadeIn>

        {/* Bumble Card Stack Container */}
        <div className="relative w-full max-w-[420px] aspect-[3/4] sm:aspect-[4/5] md:aspect-[3/4] flex-shrink-0 mt-4 perspective-[1000px]">
          <AnimatePresence mode="popLayout">
            {!isFinished &&
              currentImages.map((img, i) => (
                <SwipeCard
                  key={img.id}
                  img={img}
                  isTop={i === 0}
                  onSwipe={handleSwipe}
                  zIndex={currentImages.length - i}
                />
              ))}
          </AnimatePresence>

          {/* End of Stack UI */}
          <AnimatePresence>
            {isFinished && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-50 rounded-[2.5rem] shadow-inner border-2 border-neutral-200/50 p-8 text-center"
              >
                <div className="w-20 h-20 bg-[var(--palette-gold-soft)] rounded-full flex items-center justify-center mb-6">
                  <Heart className="w-10 h-10 text-accent-ink fill-[var(--palette-gold-hover)]" />
                </div>
                <h3 className="text-2xl font-bold font-sahitya text-ink mb-2">
                  You&apos;re all caught up!
                </h3>
                <p className="text-muted mb-8 text-sm max-w-[250px]">
                  You&apos;ve viewed all the breathtaking moments in this category.
                </p>
                <button
                  onClick={restartGallery}
                  className="flex items-center gap-2 px-8 py-3.5 bg-zion-accent text-white rounded-full font-bold uppercase tracking-widest text-sm hover:bg-[var(--palette-gold-border)] hover:shadow-lg transition-all active:scale-95"
                >
                  <RotateCcw className="w-4 h-4" />
                  Restart Gallery
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Bumble Action Buttons */}
        <div className="flex items-center justify-center gap-6 mt-10 pointer-events-none">
          {/* We use pointer-events-auto on the buttons so the container doesn't block clicks */}
          <button
            disabled={isFinished}
            onClick={handleSwipe}
            className={`pointer-events-auto w-16 h-16 rounded-full bg-surface flex items-center justify-center shadow-[0_10px_20px_color-mix(in_srgb,var(--palette-night)_5%,transparent)] border border-neutral-100 text-[var(--palette-danger)] transition-all duration-300 hover:scale-110 hover:shadow-[0_10px_25px_color-mix(in_srgb,var(--palette-gold)_20%,transparent)] active:scale-95 ${isFinished ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
          >
            <X className="w-8 h-8" strokeWidth={3} />
          </button>

          <button
            onClick={restartGallery}
            className="pointer-events-auto w-12 h-12 rounded-full bg-surface flex items-center justify-center shadow-md border border-neutral-100 text-neutral-400 transition-all duration-300 hover:scale-110 hover:text-ink active:scale-95"
          >
            <RotateCcw className="w-5 h-5" strokeWidth={2.5} />
          </button>

          <button
            disabled={isFinished}
            onClick={handleSwipe}
            className={`pointer-events-auto w-16 h-16 rounded-full bg-surface flex items-center justify-center shadow-[0_10px_20px_color-mix(in_srgb,var(--palette-night)_5%,transparent)] border border-neutral-100 text-[var(--palette-night-border)] transition-all duration-300 hover:scale-110 hover:shadow-[0_10px_25px_color-mix(in_srgb,var(--palette-night)_20%,transparent)] active:scale-95 ${isFinished ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
          >
            <Heart className="w-8 h-8 fill-[var(--palette-night-border)]" strokeWidth={2} />
          </button>
        </div>
      </section>
    </PublicSubpageShell>
  );
}
