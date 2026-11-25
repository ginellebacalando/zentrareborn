import Link from 'next/link';
import { BRAND } from '@/config/brand';
import SectionHeading from './SectionHeading';
import styles from './HomeSections.module.css';

/** "Contact" from Figma: where to find Zion, visiting hours and how to reach the team. */
export default function ContactSection() {
  return (
    <section className={`${styles.section} ${styles.subtle}`} aria-labelledby="home-contact-title">
      <div className={styles.container}>
        <SectionHeading
          id="home-contact-title"
          title="Contact"
          subtitle="Visit by appointment, or send us a message anytime"
        />
        <div className={`${styles.contactGrid} ${styles.stagger}`}>
          <div>
            <h3 className={styles.contactLabel}>Visit us</h3>
            <address className={styles.contactText}>
              {BRAND.address.lines.map((line) => (
                <span key={line}>{line}</span>
              ))}
              <a href={BRAND.maps.directionsUrl} target="_blank" rel="noreferrer">
                Get directions (opens Google Maps)
              </a>
            </address>
          </div>
          <div>
            <h3 className={styles.contactLabel}>Visiting hours</h3>
            <div className={styles.contactText}>
              {BRAND.visits.hours.map((slot) => (
                <span key={slot.days}>
                  {slot.days}: {slot.time}
                </span>
              ))}
              <span className={styles.muted}>{BRAND.visits.notice}</span>
            </div>
          </div>
          <div>
            <h3 className={styles.contactLabel}>Reach us</h3>
            <div className={styles.contactText}>
              <a href={BRAND.contact.phoneHref}>{BRAND.contact.phone}</a>
              <a href={BRAND.contact.emailHref}>{BRAND.contact.email}</a>
            </div>
            <div className={styles.actions}>
              <Link href="/contact" className={styles.buttonOutline}>
                Send an inquiry
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
