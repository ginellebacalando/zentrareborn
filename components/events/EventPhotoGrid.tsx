'use client';

import { useCallback, useId, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { IconButton } from '@/components/shared/Button';
import { useModalDialog } from '@/components/shared/useModalDialog';
import { PHOTO_PLACEHOLDERS } from '@/config/photo-placeholders';
import type { EventPhoto } from '@/config/event-photos';
import styles from './EventPhotoGrid.module.css';

const blur = (src: string) =>
  PHOTO_PLACEHOLDERS[src]
    ? { placeholder: 'blur' as const, blurDataURL: PHOTO_PLACEHOLDERS[src] }
    : {};

/**
 * Real photos of this event type at Zion in a grid; choosing one opens it larger in a native
 * modal dialog (Escape closes it, the arrow keys and buttons move between photos).
 */
export default function EventPhotoGrid({
  title,
  photos,
  galleryHref,
}: {
  title: string;
  photos: readonly EventPhoto[];
  galleryHref: string;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState<number | null>(null);
  const shown = open === null ? null : photos[open];

  function show(index: number) {
    setOpen(index);
    if (!dialogRef.current?.open) dialogRef.current?.showModal();
  }

  const step = useCallback(
    (delta: number) =>
      setOpen((current) =>
        current === null ? null : (current + delta + photos.length) % photos.length,
      ),
    [photos.length],
  );
  useModalDialog(
    dialogRef,
    useCallback(
      (event: KeyboardEvent) => {
        if (event.key === 'ArrowRight') step(1);
        else if (event.key === 'ArrowLeft') step(-1);
      },
      [step],
    ),
  );

  return (
    <section className={styles.section} aria-labelledby={titleId}>
      <div className={styles.header}>
        <h2 id={titleId} className={`section-title ${styles.title}`}>
          {title}
        </h2>
        <Link href={galleryHref} className={styles.more}>
          See more in the Gallery
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
      {photos.length ? (
        <ul className={styles.grid}>
          {photos.map((photo, index) => (
            <li key={photo.src}>
              <button
                type="button"
                className={styles.tile}
                aria-haspopup="dialog"
                onClick={() => show(index)}
              >
                <Image
                  src={photo.src}
                  alt={photo.alt}
                  fill
                  sizes="(min-width: 64rem) 20rem, (min-width: 40rem) 33vw, 50vw"
                  className={styles.photo}
                  {...blur(photo.src)}
                />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <dialog
        ref={dialogRef}
        className={styles.lightbox}
        aria-label={shown ? `Photo ${(open ?? 0) + 1} of ${photos.length}` : 'Photo'}
        onClose={() => setOpen(null)}
      >
        {shown ? (
          <figure className={styles.figure}>
            <div className={styles.frame}>
              <Image
                key={shown.src}
                src={shown.src}
                alt={shown.alt}
                fill
                sizes="(min-width: 64rem) 64rem, 100vw"
                className={styles.large}
              />
            </div>
            <figcaption className={styles.caption}>{shown.alt}</figcaption>
          </figure>
        ) : null}
        <div className={styles.controls}>
          {photos.length > 1 ? (
            <>
              <IconButton
                type="button"
                inverse
                label="Previous photo"
                icon={<ChevronLeft aria-hidden="true" />}
                onClick={() => step(-1)}
              />
              <IconButton
                type="button"
                inverse
                label="Next photo"
                icon={<ChevronRight aria-hidden="true" />}
                onClick={() => step(1)}
              />
            </>
          ) : null}
          <IconButton
            type="button"
            inverse
            label="Close photo"
            icon={<X aria-hidden="true" />}
            onClick={() => dialogRef.current?.close()}
          />
        </div>
      </dialog>
    </section>
  );
}
