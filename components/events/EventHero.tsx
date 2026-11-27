import Image from 'next/image';
import { PHOTO_PLACEHOLDERS } from '@/config/photo-placeholders';
import type { EventPhoto } from '@/config/event-photos';
import styles from './EventHero.module.css';

/**
 * An event page's header: a wide real photo of the event at Zion with the page title and one
 * line over a soft dark overlay, kept short so the packages show soon. Without a real photo yet,
 * a plain header in the brand green (never a placeholder or stock photo).
 */
export default function EventHero({
  title,
  line,
  photo,
}: {
  title: string;
  line: string;
  photo: EventPhoto | null;
}) {
  const placeholder = photo ? PHOTO_PLACEHOLDERS[photo.src] : undefined;
  return (
    <header className={styles.hero} data-photo={photo ? true : undefined}>
      {photo ? (
        <Image
          src={photo.src}
          alt={photo.alt}
          fill
          preload
          sizes="100vw"
          quality={70}
          className={styles.image}
          {...(placeholder ? { placeholder: 'blur' as const, blurDataURL: placeholder } : {})}
        />
      ) : null}
      <div className={styles.content}>
        <h1 className={`page-title ${styles.title}`}>{title}</h1>
        <p className={styles.line}>{line}</p>
      </div>
    </header>
  );
}
