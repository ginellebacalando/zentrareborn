import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { homeEventCards } from '@/config/home';
import SectionHeading from './SectionHeading';
import styles from './HomeSections.module.css';

/** "Events & Packages" from Figma: one portrait card per event type, linking to its package page. */
export default function EventPackagesSection() {
  return (
    <section
      id="event-packages"
      className={`${styles.section} ${styles.subtle}`}
      aria-labelledby="home-packages-title"
    >
      <div className={styles.container}>
        <SectionHeading
          id="home-packages-title"
          title="Events & Packages"
          subtitle="Choose your celebration to see what each package includes"
        />
        <ul className={`${styles.cards} ${styles.stagger}`}>
          {homeEventCards.map((card) => (
            <li key={card.href}>
              <Link href={card.href} className={styles.card}>
                <span className={styles.cardMedia}>
                  <Image
                    src={card.imageSrc}
                    alt={card.imageAlt}
                    fill
                    sizes="(min-width: 64rem) 30vw, (min-width: 40rem) 45vw, 100vw"
                  />
                </span>
                <span className={styles.cardLabel}>{card.label}</span>
                <span className={styles.cardTitle}>{card.title}</span>
                <span className={styles.cardMore}>
                  View packages
                  <ArrowRight aria-hidden="true" className={styles.cardArrow} strokeWidth={1.75} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
