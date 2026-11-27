import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { homeArchivePhotos } from '@/config/home';
import SectionHeading from './SectionHeading';
import styles from './HomeSections.module.css';

/**
 * "The Archive" from Figma: a row of captioned photographs from real celebrations, each opening
 * its category in the gallery. On desktops the row runs almost edge to edge, and the photograph
 * under the pointer or keyboard widens while "View photos" rises into its caption (motion in
 * HomeSections.module.css, none with reduced motion).
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
            <Link key={photo.src} href={photo.href} className={styles.archiveItem}>
              {/* The link's own words name it ("Wedding, View photos"); the photo is a preview. */}
              <Image src={photo.src} alt="" fill sizes="(min-width: 64rem) 40vw, 50vw" />
              <span className={styles.caption}>
                <span>{photo.caption}</span>
                <span className={styles.captionMore}>
                  View photos
                  <ArrowRight aria-hidden="true" strokeWidth={1.75} />
                </span>
              </span>
            </Link>
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
