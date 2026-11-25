import Image from 'next/image';
import Link from 'next/link';
import { homeArchivePhotos } from '@/config/home';
import SectionHeading from './SectionHeading';
import styles from './HomeSections.module.css';

/**
 * "The Archive" from Figma: a row of captioned photographs from real celebrations. On desktops
 * the row runs almost edge to edge, outside the text container.
 */
export default function ArchiveSection() {
  return (
    <section className={styles.section} aria-labelledby="home-archive-title">
      <div className={styles.container}>
        <SectionHeading
          id="home-archive-title"
          title="The Archive"
          subtitle="Moments celebrated at Zion Events Place"
        />
      </div>
      <div className={styles.archiveBleed}>
        <div className={`${styles.archive} ${styles.stagger}`}>
          {homeArchivePhotos.map((photo) => (
            <figure key={photo.src} className={styles.archiveItem}>
              <Image src={photo.src} alt={photo.alt} fill sizes="(min-width: 64rem) 25vw, 50vw" />
              <figcaption className={styles.caption}>{photo.caption}</figcaption>
            </figure>
          ))}
        </div>
      </div>
      <div className={styles.container}>
        <div className={styles.centered}>
          <Link href="/gallery" className={styles.textLink}>
            View the gallery
          </Link>
        </div>
      </div>
    </section>
  );
}
