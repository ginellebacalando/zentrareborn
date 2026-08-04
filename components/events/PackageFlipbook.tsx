"use client";

import Image from 'next/image';
import {
  BookOpen,
  ExternalLink,
  Maximize2,
  Minimize2,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import styles from './PackageFlipbook.module.css';

import type { EventPackageMediaKey } from '@/config/event-package-pages';
import { BRAND } from '@/config/brand';

const FLIPBOOK_URL = 'https://heyzine.com/flip-book/eeabcd2f18.html';

const PACKAGE_COVERS = {
  weddings: {
    label: 'Wedding',
    src: '/Wedding Events Package Menu Front Page/5.png',
  },
  birthdays: {
    label: 'Birthday',
    src: '/Wedding Events Package Menu Front Page/2.png',
  },
  debuts: {
    label: 'Debut',
    src: '/Wedding Events Package Menu Front Page/3.png',
  },
  christmasParty: {
    label: 'Christmas Party',
    src: '/Wedding Events Package Menu Front Page/7.png',
  },
  christening: {
    label: 'Christening',
    src: '/Wedding Events Package Menu Front Page/6.png',
  },
  genderReveal: {
    label: 'Gender Reveal',
    src: '/Wedding Events Package Menu Front Page/4.png',
  },
} as const satisfies Record<
  EventPackageMediaKey,
  { readonly label: string; readonly src: string }
>;

interface PackageFlipbookProps {
  eventType: EventPackageMediaKey;
}

export default function PackageFlipbook({ eventType }: PackageFlipbookProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isReaderExpanded, setIsReaderExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const readerRef = useRef<HTMLElement>(null);
  const coverButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const hasOpenedRef = useRef(false);
  const cover = PACKAGE_COVERS[eventType];

  useEffect(() => {
    const focusFrame = window.requestAnimationFrame(() => {
      if (isOpen) {
        closeButtonRef.current?.focus({ preventScroll: true });
      } else if (hasOpenedRef.current) {
        coverButtonRef.current?.focus({ preventScroll: true });
      }
    });

    return () => {
      window.cancelAnimationFrame(focusFrame);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isReaderExpanded) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsReaderExpanded(false);
      }
    };

    document.body.style.overflow = 'hidden';
    document.body.dataset.packageReaderExpanded = 'true';
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      delete document.body.dataset.packageReaderExpanded;
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isReaderExpanded]);

  const openFlipbook = () => {
    hasOpenedRef.current = true;
    setIsOpen(true);
    setIsLoading(true);
  };

  const toggleReaderSize = () => {
    setIsReaderExpanded((isExpanded) => !isExpanded);
  };

  const closeFlipbook = () => {
    setIsReaderExpanded(false);
    setIsOpen(false);
    setIsLoading(true);
  };

  return (
    <div
      className={`${styles.featureViewport} ${
        isReaderExpanded ? styles.featureViewportExpanded : ''
      }`}
    >
      {!isOpen ? (
        <button
          ref={coverButtonRef}
          type="button"
          onClick={openFlipbook}
          className={styles.packageCoverButton}
          aria-label={`Open ${cover.label} package magazine`}
        >
          <span className={styles.closedPageStack} aria-hidden="true" />
          <span className={styles.closedSpine} aria-hidden="true" />
          <Image
            src={cover.src}
            alt={`${cover.label} event package menu cover`}
            fill
            className={styles.packageCoverImage}
            sizes="(max-width: 767px) min(calc(100vw - 2rem), 24rem), 24rem"
          />
          <span className={styles.packageCoverAction}>
            <span className={styles.coverAction}>
              <BookOpen className="h-4 w-4" strokeWidth={1.8} />
              Open Magazine
            </span>
          </span>
        </button>
      ) : (
        <section
          ref={readerRef}
          className={`${styles.readerShell} ${
            isReaderExpanded ? styles.readerShellExpanded : ''
          }`}
          aria-label="Zion package magazine reader"
        >
          <div className={styles.openingCover} aria-hidden="true">
            <span className={styles.openingCoverFront}>
              <Image
                src={cover.src}
                alt=""
                fill
                className={styles.packageCoverImage}
                sizes="(max-width: 767px) calc(100vw - 2rem), 24rem"
              />
            </span>
            <span className={styles.openingCoverBack}>
              <span className={styles.backOrnament}>ZION</span>
              <span>Events Place</span>
            </span>
          </div>
          <div className={styles.turningPage} aria-hidden="true" />

          <header className={styles.readerHeader}>
            <div className={styles.readerToolbar}>
              {/* Spacer to keep grid balanced */}
              <div />

              <div className={styles.readerLogo}>
                <div className={styles.readerLogoWrapper}>
                  <Image
                    src={BRAND.logo.src}
                    alt={BRAND.logo.alt}
                    fill
                    className="object-contain object-center"
                  />
                </div>
              </div>

              <div className={styles.readerActions}>
                <a
                  href={FLIPBOOK_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.iconButton}
                  title="Open in new tab"
                  aria-label="Open package magazine in a new tab"
                >
                  <ExternalLink className="h-4 w-4" strokeWidth={1.8} />
                </a>
                <button
                  type="button"
                  className={styles.iconButton}
                  onClick={toggleReaderSize}
                  title={isReaderExpanded ? 'Restore compact reader' : 'Expand reader'}
                  aria-label={
                    isReaderExpanded
                      ? 'Restore compact package magazine'
                      : 'Expand package magazine'
                  }
                >
                  {isReaderExpanded ? (
                    <Minimize2 className="h-4 w-4" strokeWidth={1.8} />
                  ) : (
                    <Maximize2 className="h-4 w-4" strokeWidth={1.8} />
                  )}
                </button>
                <button
                  ref={closeButtonRef}
                  type="button"
                  className={styles.iconButton}
                  onClick={closeFlipbook}
                  title="Close"
                  aria-label="Close package magazine"
                >
                  <X className="h-4 w-4" strokeWidth={1.8} />
                </button>
              </div>
            </div>

            <div className={styles.readerIssue}>
              <p>Curated celebration guide</p>
              <h3>{cover.label} Event Packages</h3>
            </div>
          </header>

          <div className={styles.iframeFrame}>
            {isLoading ? (
              <div className={styles.loadingOverlay} aria-live="polite">
                <span className={styles.loadingMark} aria-hidden="true">
                  <BookOpen className="h-5 w-5" strokeWidth={1.6} />
                </span>
                <span>Preparing {cover.label} magazine</span>
              </div>
            ) : null}
            <iframe
              src={FLIPBOOK_URL}
              className={styles.flipbookFrame}
              allowFullScreen
              scrolling="no"
              title={`${cover.label} event package magazine`}
              onLoad={() => setIsLoading(false)}
            />
          </div>
        </section>
      )}
    </div>
  );
}
