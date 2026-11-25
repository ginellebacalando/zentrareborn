import Link from 'next/link';
import { BRAND } from '@/config/brand';
import { FOOTER_LINKS } from '@/config/navigation';
import ZentraWordmark from '@/components/shared/ZentraWordmark';
import SocialLinks from './SocialLinks';
import styles from './Footer.module.css';

const LEGAL_LINKS = [
  { label: 'Terms & Conditions', href: '/terms' },
  { label: 'Event Policies', href: '/policies' },
  { label: 'House Rules', href: '/rules' },
  { label: 'Privacy', href: '/privacy' },
] as const;

/** Figma footer: wordmark and venue line, site links, visit and contact details, social links. */
export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <Link href="/" className={styles.brandLink} aria-label={`${BRAND.wordmark} home`}>
            <ZentraWordmark size="sm" subtitle={BRAND.legalName} />
          </Link>
          <p className={styles.tagline}>{BRAND.tagline}</p>
          <Link href="/booking" className={styles.book}>
            Book now
          </Link>
        </div>

        <nav aria-label="Footer" className={styles.column}>
          <h2 className={styles.label}>Explore</h2>
          <ul className={styles.links}>
            {FOOTER_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href}>{link.label}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className={styles.column}>
          <h2 className={styles.label}>Visit us</h2>
          <address className={styles.text}>
            {BRAND.address.lines.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </address>
          <p className={styles.note}>{BRAND.visits.notice}</p>
        </div>

        <div className={styles.column}>
          <h2 className={styles.label}>Contact us</h2>
          <div className={styles.text}>
            <a href={BRAND.contact.phoneHref}>Tel: {BRAND.contact.phone}</a>
            <a href={BRAND.contact.emailHref}>{BRAND.contact.email}</a>
          </div>
          <h2 className={`${styles.label} ${styles.followLabel}`}>Follow us</h2>
          <SocialLinks variant="footer" />
        </div>
      </div>

      <div className={styles.legal}>
        <p>
          &copy; {year} {BRAND.legalName}. All rights reserved.
        </p>
        <ul className={styles.legalLinks}>
          {LEGAL_LINKS.map((link) => (
            <li key={link.href}>
              <Link href={link.href}>{link.label}</Link>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
