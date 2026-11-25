'use client';

import Image from 'next/image';
import { ChevronRight, Loader2, Maximize2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import styles from './PackageFlipbook.module.css';

import { BRAND } from '@/config/brand';
import type { EventPackageMediaKey } from '@/config/event-package-pages';

const FLIPBOOK_URL = 'https://heyzine.com/flip-book/eeabcd2f18.html';

const PACKAGE_LABELS = {
  weddings: 'Wedding',
  birthdays: 'Birthday',
  debuts: 'Debut',
  christmasParty: 'Christmas Party',
  christening: 'Christening',
  genderReveal: 'Gender Reveal',
} as const satisfies Record<EventPackageMediaKey, string>;

interface PackageFlipbookProps {
  eventType: EventPackageMediaKey;
}

export default function PackageFlipbook({ eventType }: PackageFlipbookProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasLoadedBooklet, setHasLoadedBooklet] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isInlineLoading, setIsInlineLoading] = useState(true);
  const [isModalLoading, setIsModalLoading] = useState(true);

  const coverButtonRef = useRef<HTMLButtonElement>(null);
  const insideCoverButtonRef = useRef<HTMLButtonElement>(null);
  const expandButtonRef = useRef<HTMLButtonElement>(null);
  const closeModalButtonRef = useRef<HTMLButtonElement>(null);
  const hasInteractedRef = useRef(false);
  const hasOpenedModalRef = useRef(false);

  const label = PACKAGE_LABELS[eventType];

  useEffect(() => {
    if (!hasInteractedRef.current) {
      return;
    }

    const focusFrame = window.requestAnimationFrame(() => {
      if (isOpen) {
        insideCoverButtonRef.current?.focus({ preventScroll: true });
      } else {
        coverButtonRef.current?.focus({ preventScroll: true });
      }
    });

    return () => {
      window.cancelAnimationFrame(focusFrame);
    };
  }, [isOpen]);

  useEffect(() => {
    const focusFrame = window.requestAnimationFrame(() => {
      if (isFullscreen) {
        closeModalButtonRef.current?.focus({ preventScroll: true });
      } else if (hasOpenedModalRef.current) {
        expandButtonRef.current?.focus({ preventScroll: true });
      }
    });

    return () => {
      window.cancelAnimationFrame(focusFrame);
    };
  }, [isFullscreen]);

  useEffect(() => {
    if (!isFullscreen) {
      return;
    }

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsFullscreen(false);
      }
    };

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreen]);

  const handleOpenCover = () => {
    hasInteractedRef.current = true;
    if (!hasLoadedBooklet) {
      setHasLoadedBooklet(true);
      setIsInlineLoading(true);
    }
    setIsOpen(true);
  };

  const handleCloseCover = () => {
    hasInteractedRef.current = true;
    setIsFullscreen(false);
    setIsOpen(false);
  };

  const openFullscreen = () => {
    hasOpenedModalRef.current = true;
    setIsModalLoading(true);
    setIsFullscreen(true);
  };

  const closeFullscreen = () => {
    setIsFullscreen(false);
  };

  const fullscreenModal =
    isFullscreen && typeof document !== 'undefined'
      ? createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${label} package booklet full-screen view`}
            className={`${styles.modalBackdrop} fixed inset-0 z-[200] flex items-center justify-center bg-ink/75 p-2.5 sm:p-5`}
          >
            <button
              type="button"
              tabIndex={-1}
              aria-label="Close full-screen package booklet"
              onClick={closeFullscreen}
              className="absolute inset-0 cursor-default bg-transparent"
            />
            <div
              className={`${styles.modalPanel} relative z-10 flex h-[calc(100vh-1.25rem)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-[var(--palette-booklet-cover)]/60 bg-[var(--palette-paper)] shadow-2xl sm:h-[calc(100vh-2.5rem)] sm:rounded-[1.75rem]`}
            >
              <button
                ref={closeModalButtonRef}
                type="button"
                onClick={closeFullscreen}
                className="absolute top-3 right-3 z-20 inline-flex min-h-10 min-w-10 items-center justify-center rounded-full border border-[var(--palette-gold)]/35 bg-[var(--palette-paper)]/95 text-ink shadow-md transition-colors hover:bg-[var(--palette-booklet-cover)] hover:text-[var(--text-on-action)]"
                aria-label="Close full-screen package booklet"
                title="Close"
              >
                <X className="h-4 w-4" strokeWidth={2} />
              </button>

              <div className="relative min-h-0 flex-1 overflow-hidden bg-[var(--palette-paper)]">
                {isModalLoading ? (
                  <div
                    className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[var(--palette-paper)]/95 px-6 text-center"
                    aria-live="polite"
                  >
                    <span className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--palette-gold)]/30 bg-[var(--palette-cream)] text-[var(--palette-accent-ink)]">
                      <Loader2 className="h-5 w-5 animate-spin" strokeWidth={1.8} />
                    </span>
                    <p className="font-serif text-lg text-ink">Opening {label} Package Booklet…</p>
                  </div>
                ) : null}

                <iframe
                  src={FLIPBOOK_URL}
                  className="block h-full w-full border-0 bg-transparent"
                  allowFullScreen
                  title={`${label} event package booklet full screen`}
                  onLoad={() => setIsModalLoading(false)}
                />
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div className="flex w-full flex-col items-center">
        <div className={`${styles.bookFolio} ${isOpen ? styles.bookFolioOpen : ''}`}>
          {/* Flat 2D right-hand booklet surface — zero 3D transform ancestors so iframe clicks & drags work natively */}
          <div
            className={`${styles.pageSurface} ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
            aria-hidden={!isOpen}
          >
            <span className={styles.innerSpineShadow} aria-hidden="true" />
            <div className="relative h-full w-full overflow-hidden rounded-[0.25rem_0.9rem_0.9rem_0.25rem] bg-[var(--palette-paper)]">
              {hasLoadedBooklet ? (
                <>
                  {isInlineLoading ? (
                    <div
                      className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[var(--palette-paper)]/95 px-6 text-center"
                      aria-live="polite"
                    >
                      <span className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--palette-gold)]/30 bg-[var(--palette-cream)] text-[var(--palette-accent-ink)]">
                        <Loader2 className="h-5 w-5 animate-spin" strokeWidth={1.8} />
                      </span>
                      <p className="font-serif text-lg text-ink">
                        Opening {label} Package Booklet…
                      </p>
                    </div>
                  ) : null}

                  <iframe
                    src={FLIPBOOK_URL}
                    loading="eager"
                    className="block h-full w-full border-0 bg-transparent"
                    allowFullScreen
                    title={`${label} event package booklet`}
                    onLoad={() => setIsInlineLoading(false)}
                  />
                </>
              ) : (
                <div className={styles.underlayInner}>
                  <span className="font-sans text-xs uppercase tracking-[0.26em] text-[var(--palette-gold-ink)]">
                    Zion Events Place
                  </span>
                  <span className="font-serif text-2xl text-ink">{label} Collection</span>
                </div>
              )}
            </div>
          </div>

          {/* Isolated 3D cover layer (pointer-events-none over the right page once open) */}
          <div className={styles.coverStage}>
            <div className={styles.coverLeaf}>
              {/* Front face of the hardcover menu */}
              <button
                ref={coverButtonRef}
                type="button"
                onClick={handleOpenCover}
                tabIndex={isOpen ? -1 : 0}
                aria-hidden={isOpen}
                aria-label={`Flip open the ${label} package booklet cover`}
                className={styles.coverFront}
              >
                <span className={styles.spineCrease} aria-hidden="true" />
                <span className={styles.innerFrame}>
                  <span className="font-sans text-xs font-medium uppercase tracking-[0.28em] text-[var(--palette-zentra-pearl)]">
                    Event Packages
                  </span>

                  <span className="relative flex w-full max-w-[15.5rem] items-center justify-center px-3 py-4">
                    <Image
                      src={BRAND.logo.src}
                      alt=""
                      width={520}
                      height={300}
                      priority
                      className="h-auto w-full object-contain brightness-0 invert"
                    />
                  </span>

                  <span className="flex flex-col items-center gap-3">
                    <span className="h-px w-12 bg-[var(--palette-zentra-pearl)]/50" />
                    <span className="font-serif text-lg tracking-wide text-[var(--palette-white)] sm:text-xl">
                      {label} Edition
                    </span>
                    <span className={styles.flipHint}>
                      <span>Flip Cover to Open</span>
                      <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.2} />
                    </span>
                  </span>
                </span>
              </button>

              {/* Inside front cover endpaper — stays visible on the left after opening */}
              <button
                ref={insideCoverButtonRef}
                type="button"
                onClick={handleCloseCover}
                tabIndex={isOpen ? 0 : -1}
                aria-hidden={!isOpen}
                aria-label={`Close the ${label} package booklet cover`}
                className={styles.coverBack}
              >
                <span className={styles.coverBackInner}>
                  <span className="font-sans text-xs uppercase tracking-[0.24em] text-[var(--palette-gold-ink)]/80">
                    Zion Events Place
                  </span>
                  <span className="relative flex w-full max-w-[10.5rem] items-center justify-center opacity-30">
                    <Image
                      src={BRAND.logo.src}
                      alt=""
                      width={320}
                      height={180}
                      className="h-auto w-full object-contain"
                    />
                  </span>
                  <span className="flex flex-col items-center gap-2">
                    <span className="h-px w-10 bg-[var(--palette-gold)]/45" />
                    <span className="font-serif text-base italic text-ink/75">
                      {label} Collection
                    </span>
                    <span className="font-sans text-xs uppercase tracking-[0.16em] text-ink/55">
                      Click cover to close
                    </span>
                  </span>
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Reserved control bar height prevents the adjacent text column from shifting when opening/closing */}
        <div
          className={`mt-4 flex min-h-10 w-full max-w-[26rem] items-center justify-between px-1 transition-opacity duration-300 lg:justify-center ${
            isOpen ? 'opacity-100' : 'pointer-events-none invisible opacity-0'
          }`}
          aria-hidden={!isOpen}
        >
          <button
            ref={expandButtonRef}
            type="button"
            tabIndex={isOpen ? 0 : -1}
            onClick={openFullscreen}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-[var(--palette-gold)]/35 bg-[var(--palette-paper)]/90 px-4 py-2 font-sans text-xs font-semibold text-ink shadow-xs transition-colors hover:bg-[var(--palette-booklet-cover)]/45"
            aria-label={`Expand ${label} package booklet to full screen`}
          >
            <Maximize2 className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />
            <span>Expand View</span>
          </button>

          <button
            type="button"
            tabIndex={isOpen ? 0 : -1}
            onClick={handleCloseCover}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-[var(--palette-gold)]/35 bg-[var(--palette-paper)]/90 px-4 py-2 font-sans text-xs font-semibold text-ink shadow-xs transition-colors hover:bg-[var(--palette-booklet-cover)]/45 lg:hidden"
            aria-label={`Close ${label} package booklet cover`}
          >
            <X className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
            <span>Close Cover</span>
          </button>
        </div>
      </div>

      {fullscreenModal}
    </>
  );
}
