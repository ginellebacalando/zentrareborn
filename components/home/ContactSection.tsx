import Link from 'next/link';
import { ArrowRight, Clock, Mail, MapPin } from 'lucide-react';
import { BRAND } from '@/config/brand';
import SectionHeading from './SectionHeading';
import styles from './HomeSections.module.css';

/**
 * "Contact" from Figma: where to find Zion, visiting hours and how to reach the team, as three
 * cards that each end in one next step (redesigned 26 November 2026). The cards arrive in a short
 * cascade when the section scrolls into view, their icons a moment later; hovering a card fills
 * its icon. Visits are by appointment only, so the hours card links straight to the visit page.
 */
export default function ContactSection() {
  return (
    <section className={`${styles.section} ${styles.subtle}`} aria-labelledby="home-contact-title">
      <div className={styles.container}>
        <SectionHeading
          id="home-contact-title"
          title="Contact"
          subtitle="Visit by appointment, or send us a message anytime"
        />
        <div className={`${styles.contactCards} ${styles.stagger}`}>
          <div className={styles.contactCard}>
            <span className={styles.contactIcon} aria-hidden="true">
              <MapPin />
            </span>
            <h3 className={styles.contactLabel}>Visit us</h3>
            <address className={styles.contactText}>
              {BRAND.address.lines.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </address>
            <a
              href={BRAND.maps.directionsUrl}
              target="_blank"
              rel="noreferrer"
              className={styles.contactAction}
            >
              Get directions
              <span className="sr-only"> (opens Google Maps in a new tab)</span>
              <ArrowRight aria-hidden="true" />
            </a>
          </div>

          <div className={styles.contactCard}>
            <span className={styles.contactIcon} aria-hidden="true">
              <Clock />
            </span>
            <h3 className={styles.contactLabel}>Visiting hours</h3>
            <div className={styles.contactText}>
              {BRAND.visits.hours.map((slot) => (
                <span key={slot.days}>
                  {slot.days}: {slot.time}
                </span>
              ))}
              <span className={styles.muted}>{BRAND.visits.notice}</span>
            </div>
            <Link href="/visit" className={styles.contactAction}>
              Schedule a visit
              <ArrowRight aria-hidden="true" />
            </Link>
          </div>

          <div className={styles.contactCard}>
            <span className={styles.contactIcon} aria-hidden="true">
              <Mail />
            </span>
            <h3 className={styles.contactLabel}>Reach us</h3>
            <div className={styles.contactText}>
              <a href={BRAND.contact.phoneHref}>{BRAND.contact.phone}</a>
              <a href={BRAND.contact.emailHref}>{BRAND.contact.email}</a>
            </div>
            <Link href="/contact" className={styles.contactAction}>
              Send an inquiry
              <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
