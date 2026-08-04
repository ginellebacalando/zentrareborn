"use client";

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { motion, useMotionValue, useTransform, AnimatePresence } from 'framer-motion';
import type { PanInfo } from 'framer-motion';
import { Heart, X, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { optimizedPublicMediaPath } from '@/lib/public-media';

const categories = ["All", "Weddings", "Debuts & Birthdays", "Christenings & Reveals", "Corporate & Events"] as const;

type GalleryImage = {
  src: string;
  category: Exclude<(typeof categories)[number], "All">;
  alt?: string;
};

const galleryImageSrc = (src: string) =>
  optimizedPublicMediaPath(
    src.startsWith('/') ? src : `/zion-media/${encodeURIComponent(src)}`,
  );

const galleryData: GalleryImage[] = [
  // Weddings
  { src: 'wedding.jpg', category: 'Weddings' },
  { src: 'wedding_.jpg', category: 'Weddings' },
  { src: '✨ Elegant Lakefront Wedding Ceremony with White Floral Arch & Luxury Aisle Inspiration.jpg', category: 'Weddings' },
  { src: 'Elegant Christmas Wedding Ideas for a Timeless Holiday Celebration.jpg', category: 'Weddings' },
  { src: 'Gorgeous Wedding Decor.jpg', category: 'Weddings' },
  { src: 'Spring Garden Wedding of EJ & Jaira - Khim Cruz _ Wedding and Event Designer + Florist + Stylist.jpg', category: 'Weddings' },
  { src: 'Spring Garden-inspired wedding of Carlo & Isabel - Khim Cruz _ Wedding and Event Designer + Florist + Stylist.jpg', category: 'Weddings' },
  { src: '/zion-gallery-2/DSC03258.JPG', category: 'Weddings', alt: 'Bride and groom exchanging vows beneath a floral ceremony arch' },
  { src: '/zion-gallery-2/DSC03592.JPG', category: 'Weddings', alt: 'Newlyweds entering their reception at Zion Events Place' },
  { src: '/zion-gallery-2/wedding1.JPG', category: 'Weddings', alt: 'Bride and groom posing together during their evening reception' },
  { src: '/zion-gallery-2/DSC03928.JPG', category: 'Weddings', alt: 'Newlyweds walking through their wedding reception entrance' },
  { src: '/zion-gallery-2/wedding2.JPG', category: 'Weddings', alt: 'Bride and groom sharing a kiss in the illuminated wedding aisle' },
  { src: '/zion-gallery-2/DSC04088.JPG', category: 'Weddings', alt: 'Wedding celebration beneath sparklers during the evening reception' },
  { src: '/zion-gallery-2/wedding3.JPG', category: 'Weddings', alt: 'Bride and groom posing inside their decorated wedding reception' },
  { src: '/zion-gallery-2/DSC04890.JPG', category: 'Weddings', alt: 'Newlyweds seated at their elegant wedding reception table' },
  { src: '/zion-gallery-2/DSC04920.JPG', category: 'Weddings', alt: 'Bride and groom in an evening portrait beside their reception venue' },
  { src: '/zion-gallery-2/wedding4.JPG', category: 'Weddings', alt: 'Newlyweds sharing a romantic nighttime wedding portrait' },
  { src: '/zion-gallery-2/wedding5.JPG', category: 'Weddings', alt: 'Bride and groom standing beneath glowing string lights' },
  { src: '/zion-gallery-2/DSC05482.JPG', category: 'Weddings', alt: 'Bride carrying her bouquet along the decorated wedding aisle' },
  { src: '/zion-gallery-2/DSC08346.JPG', category: 'Weddings', alt: 'Bride and groom posing together on their wedding aisle' },
  { src: '/zion-gallery-2/wedding6.JPG', category: 'Weddings', alt: 'Newlyweds posing in their floral banquet reception' },
  { src: '/zion-gallery-2/DSC08381.JPG', category: 'Weddings', alt: 'Bride and groom in a formal wedding portrait' },
  { src: '/zion-gallery-2/wedding7.JPG', category: 'Weddings', alt: 'Bride and groom posing against a scenic outdoor backdrop' },
  { src: '/zion-gallery-2/wedding8.JPG', category: 'Weddings', alt: 'Newlyweds seated beneath a floral happily ever after arch' },
  
  // Debuts & Birthdays
  { src: 'Debut party.jpg', category: 'Debuts & Birthdays' },
  { src: 'Inside the incredible Swan Lake themed 18th birthday costing $41,000.jpg', category: 'Debuts & Birthdays' },
  { src: 'bday.jpg', category: 'Debuts & Birthdays' },
  { src: 'party decor.jpg', category: 'Debuts & Birthdays' },
  { src: '/zion-gallery-2/debut1.png', category: 'Debuts & Birthdays', alt: 'Debutante in an elaborate red and blue ball gown beside a decorated banquet table' },
  { src: '/zion-gallery-2/debut2.png', category: 'Debuts & Birthdays', alt: 'Debutante posing in an elaborate ball gown along the illuminated event aisle' },
  { src: '/zion-gallery-2/debut3.jpg', category: 'Debuts & Birthdays', alt: 'Debutante in a formal red and blue gown at her celebration' },
  { src: '/zion-gallery-2/debut4.jpg', category: 'Debuts & Birthdays', alt: 'Debutante posing outdoors in a pink ball gown' },
  { src: '/zion-gallery-2/debut5.jpg', category: 'Debuts & Birthdays', alt: 'Debutante in a pink ball gown overlooking the city' },
  { src: '/zion-gallery-2/debut6.jpg', category: 'Debuts & Birthdays', alt: 'Debutante posing in her pink gown beside a scenic viewpoint' },
  { src: '/zion-gallery-2/debut7.jpg', category: 'Debuts & Birthdays', alt: 'Portrait of a debutante in a sparkling pink ball gown' },
  { src: '/zion-gallery-2/debut8.jpg', category: 'Debuts & Birthdays', alt: 'Debutante in a pink ball gown against a panoramic outdoor view' },
  { src: '/zion-gallery-2/debut9.jpg', category: 'Debuts & Birthdays', alt: 'Debutante posing in a pink gown at a scenic overlook' },
  { src: '/zion-gallery-2/debut10.jpg', category: 'Debuts & Birthdays', alt: 'Debutante posing near the pool in a blue formal gown' },
  { src: '/zion-gallery-2/debut11.png', category: 'Debuts & Birthdays', alt: 'Debutante walking beside the venue in a blue formal gown' },

  // Christenings & Reveals
  { src: 'christening (2).jpg', category: 'Christenings & Reveals' },
  { src: 'christening (3).jpg', category: 'Christenings & Reveals' },
  { src: 'christening (4).jpg', category: 'Christenings & Reveals' },
  { src: 'christening.jpg', category: 'Christenings & Reveals' },
  { src: 'gender-reveal (2).jpg', category: 'Christenings & Reveals' },
  { src: 'gender-reveal (3).jpg', category: 'Christenings & Reveals' },
  { src: 'gender-reveal.jpg', category: 'Christenings & Reveals' },

  // Corporate & Events
  { src: 'christmas party (2).jpg', category: 'Corporate & Events' },
  { src: 'christmas party (3).jpg', category: 'Corporate & Events' },
  { src: 'christmas party.jpg', category: 'Corporate & Events' },
  { src: 'corporate meeting.jpg', category: 'Corporate & Events' },
  { src: 'Meetings and Events at The Ballantyne, Charlotte, North Carolina.jpg', category: 'Corporate & Events' },
];

const SwipeCard = ({
  img,
  isTop,
  onSwipe,
  zIndex,
  isLiked,
  onToggleLike,
  onSetLike
}: {
  img: GalleryImage;
  isTop: boolean;
  onSwipe: (dir: 'left' | 'right') => void;
  zIndex: number;
  isLiked: boolean;
  onToggleLike: (e: React.MouseEvent, src: string) => void;
  onSetLike: (e: React.MouseEvent, src: string) => void;
}) => {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-8, 8]);

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.x > 100) {
      onSwipe('right');
    } else if (info.offset.x < -100) {
      onSwipe('left');
    }
  };

  return (
    <motion.div
      className={`absolute inset-0 w-full h-full rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.2)] overflow-hidden bg-neutral-900 ${isTop ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none'}`}
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
      <div 
        className="w-full h-full relative" 
        onDoubleClick={(e) => onSetLike(e, img.src)}
      >
        <Image
          src={galleryImageSrc(img.src)}
          alt={img.alt ?? `${img.category} celebration at Zion Events Place`}
          fill
          sizes="(max-width: 767px) calc(100vw - 2rem), 420px"
          className="object-cover select-none pointer-events-none"
          draggable={false}
        />
      </div>
      
      {/* Overlay Gradient */}
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />

      {/* Content */}
      <div className="absolute bottom-8 left-8 right-8 text-white flex justify-between items-end pointer-events-none">
        <div>
          <div className="inline-block px-4 py-1.5 bg-[#D4AF37]/90 backdrop-blur-md rounded-full text-[11px] font-bold tracking-[0.2em] uppercase mb-2 shadow-lg text-black">
            {img.category}
          </div>
          <div className="text-white/80 text-sm mt-1">
            <span>Swipe left or right to explore</span>
          </div>
        </div>
        
        {/* Heart Button */}
        <button 
          onClick={(e) => onToggleLike(e, img.src)}
          className={`focus:outline-none transition-transform hover:scale-110 active:scale-95 ${isTop ? 'pointer-events-auto' : 'pointer-events-none'}`}
        >
          <Heart 
            className={`h-8 w-8 transition-colors duration-300 ${isLiked ? 'fill-red-500 text-red-500' : 'text-white/80 hover:text-white'}`} 
          />
        </button>
      </div>
    </motion.div>
  );
};

export default function CategorizedGallery() {
  const [activeCategory, setActiveCategory] = useState("All");
  
  // --- Mobile Swipe State ---
  const [currentIndex, setCurrentIndex] = useState(0);

  // --- Desktop Lightbox State ---
  const [likedImages, setLikedImages] = useState<Record<string, boolean>>({});
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // --- Shuffled Images State ---
  const [shuffledImages, setShuffledImages] = useState<GalleryImage[]>([]);

  // Filter and shuffle images when category changes
  useEffect(() => {
    const filtered = galleryData.filter(img => activeCategory === "All" || img.category === activeCategory);
    
    // Fisher-Yates shuffle
    const shuffled = [...filtered];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    const animationFrame = window.requestAnimationFrame(() => {
      setShuffledImages(shuffled);
      setCurrentIndex(0);
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [activeCategory]);

  // Mobile Swipe Handlers
  const handleSwipe = () => {
    setCurrentIndex((prev) => prev + 1);
  };

  const restartGallery = () => {
    setCurrentIndex(0);
  };

  const isFinished = currentIndex >= shuffledImages.length;
  const currentImages = shuffledImages.slice(currentIndex, currentIndex + 2);

  // Desktop Grid Handlers
  const toggleLike = (e: React.MouseEvent, src: string) => {
    e.stopPropagation();
    setLikedImages(prev => ({ ...prev, [src]: !prev[src] }));
  };

  const setLike = (e: React.MouseEvent, src: string) => {
    e.stopPropagation();
    setLikedImages(prev => ({ ...prev, [src]: true }));
  };

  const openLightbox = (index: number) => setLightboxIndex(index);
  const closeLightbox = () => setLightboxIndex(null);
  const nextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (lightboxIndex !== null) {
      setLightboxIndex((lightboxIndex + 1) % shuffledImages.length);
    }
  };
  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (lightboxIndex !== null) {
      setLightboxIndex((lightboxIndex - 1 + shuffledImages.length) % shuffledImages.length);
    }
  };

  useEffect(() => {
    if (lightboxIndex !== null) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight' && lightboxIndex !== null) setLightboxIndex((lightboxIndex + 1) % shuffledImages.length);
      if (e.key === 'ArrowLeft' && lightboxIndex !== null) setLightboxIndex((lightboxIndex - 1 + shuffledImages.length) % shuffledImages.length);
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [lightboxIndex, shuffledImages.length]);

  const aspectRatios = [
    'aspect-[3/4]', 
    'aspect-[16/9]', 
    'aspect-[4/5]', 
    'aspect-square', 
    'aspect-[2/3]', 
    'aspect-[4/3]',
    'aspect-[3/5]',
    'aspect-[5/4]'
  ];
  
  const randomSequence = [0, 5, 2, 7, 3, 1, 6, 4, 5, 0, 3, 6, 2, 7, 1, 4];

  const clickTimeout = useRef<NodeJS.Timeout | null>(null);

  const handleImageClick = (e: React.MouseEvent, idx: number, src: string) => {
    e.stopPropagation();
    
    if (clickTimeout.current !== null) {
      clearTimeout(clickTimeout.current);
      clickTimeout.current = null;
      setLikedImages(prev => ({ ...prev, [src]: true }));
    } else {
      clickTimeout.current = setTimeout(() => {
        openLightbox(idx);
        clickTimeout.current = null;
      }, 250);
    }
  };

  return (
    <div className="w-full flex flex-col items-center mt-6">
      {/* Category Tabs */}
      <div className="flex flex-wrap justify-center gap-3 md:gap-4 mb-10 px-4">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-6 py-2 rounded-full font-serif text-sm tracking-wide transition-all duration-300 border focus:outline-none ${
              activeCategory === cat 
                ? "bg-[#D4AF37] text-white border-[#D4AF37] shadow-[0_4px_20px_rgba(212,175,55,0.3)] scale-105" 
                : "bg-transparent text-neutral-400 border-neutral-700 hover:border-[#D4AF37] hover:text-[#D4AF37]"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* MOBILE VIEW: Bumble Card Stack Container */}
      <div className="md:hidden relative w-full max-w-[420px] aspect-[3/4] sm:aspect-[4/5] flex-shrink-0 mt-4 perspective-[1000px] mb-20 px-4">
        <AnimatePresence mode="popLayout">
          {!isFinished && currentImages.map((img, i) => (
            <SwipeCard
              key={`${img.src}-${currentIndex + i}`}
              img={img}
              isTop={i === 0}
              onSwipe={handleSwipe}
              zIndex={currentImages.length - i}
              isLiked={!!likedImages[img.src]}
              onToggleLike={toggleLike}
              onSetLike={setLike}
            />
          ))}
        </AnimatePresence>

        {/* End of Stack UI */}
        <AnimatePresence>
          {isFinished && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-white rounded-[2.5rem] shadow-2xl border border-neutral-200/50 p-8 text-center"
            >
              <div className="w-20 h-20 bg-[#FFF2DB] rounded-full flex items-center justify-center mb-6">
                <RotateCcw className="w-10 h-10 text-[#D4AF37]" />
              </div>
              <h3 className="text-2xl font-bold font-serif text-neutral-900 mb-2">You&apos;re all caught up!</h3>
              <p className="text-neutral-500 mb-8 text-sm max-w-[250px]">
                You&apos;ve viewed all the breathtaking moments in this category.
              </p>
              <button
                onClick={restartGallery}
                className="flex items-center gap-2 px-8 py-3.5 bg-[#D4AF37] text-white rounded-full font-bold uppercase tracking-widest text-sm hover:bg-[#c09d2f] hover:shadow-lg transition-all active:scale-95"
              >
                Restart Gallery
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* DESKTOP VIEW: Gallery Collage (Pinterest Style) */}
      <div className="hidden md:block columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-3 px-3 w-full pb-16">
        {shuffledImages.map((img, idx) => {
          const aspectClass = aspectRatios[randomSequence[idx % randomSequence.length]];
          const isLiked = likedImages[img.src];
          
          return (
            <div 
              key={`${img.src}-${idx}`} 
              onClick={(e) => handleImageClick(e, idx, img.src)}
              className={`relative group overflow-hidden rounded-xl break-inside-avoid mb-3 shadow-sm hover:shadow-2xl transition-all duration-500 bg-neutral-900 cursor-pointer ${aspectClass}`}
            >
              <Image
                src={galleryImageSrc(img.src)}
                alt={img.alt ?? `${img.category} celebration at Zion Events Place`}
                fill
                sizes="(max-width: 1023px) 33vw, (max-width: 1279px) 25vw, 20vw"
                className="object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
              />
              
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-500 pointer-events-none" />
              
              <div className="absolute bottom-0 left-0 right-0 p-4 pt-16 transition-all duration-500 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex justify-between items-end">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleLike(e, img.src);
                  }}
                  className="focus:outline-none transition-transform hover:scale-110 active:scale-95"
                >
                  <Heart 
                    className={`h-6 w-6 transition-colors duration-300 ${isLiked ? 'fill-red-500 text-red-500' : 'text-white/80 hover:text-white'}`} 
                  />
                </button>

                <p className="text-white/90 font-serif text-xs md:text-sm tracking-widest opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                  {img.category.toUpperCase()}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop Lightbox Overlay */}
      {lightboxIndex !== null && (
        <div className="hidden md:flex fixed inset-0 z-[100] items-center justify-center bg-black/60 backdrop-blur-sm p-4 md:p-12" onClick={closeLightbox}>
          <button 
            onClick={closeLightbox}
            className="absolute top-4 right-4 md:top-6 md:right-6 text-white/70 hover:text-white p-2 transition-colors z-[110]"
          >
            <X className="w-8 h-8 md:w-10 md:h-10" />
          </button>

          <button 
            onClick={prevImage}
            className="absolute left-2 md:left-6 top-1/2 -translate-y-1/2 text-white/70 hover:text-white p-2 transition-colors z-[110]"
          >
            <ChevronLeft className="w-10 h-10 md:w-14 md:h-14" />
          </button>

          <div className="relative flex items-center justify-center max-w-5xl max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
            <div className="relative h-[80vh] w-[min(90vw,80rem)]">
              <Image
                src={galleryImageSrc(shuffledImages[lightboxIndex].src)}
                alt={shuffledImages[lightboxIndex].alt ?? `${shuffledImages[lightboxIndex].category} celebration at Zion Events Place`}
                fill
                sizes="90vw"
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setLikedImages(prev => ({ ...prev, [shuffledImages[lightboxIndex].src]: true }));
                }}
                className="object-contain rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.5)] cursor-default"
              />
              
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  toggleLike(e, shuffledImages[lightboxIndex].src);
                }}
                className="absolute z-10 bottom-4 left-4 md:bottom-6 md:left-6 focus:outline-none transition-transform hover:scale-110 bg-black/40 p-2 rounded-full backdrop-blur-md"
              >
                <Heart 
                  className={`h-6 w-6 md:h-7 md:w-7 transition-colors duration-300 ${likedImages[shuffledImages[lightboxIndex].src] ? 'fill-red-500 text-red-500' : 'text-white/80 hover:text-white'}`} 
                />
              </button>
            </div>
          </div>

          <button 
            onClick={nextImage}
            className="absolute right-2 md:right-6 top-1/2 -translate-y-1/2 text-white/70 hover:text-white p-2 transition-colors z-[110]"
          >
            <ChevronRight className="w-10 h-10 md:w-14 md:h-14" />
          </button>
        </div>
      )}
    </div>
  );
}
