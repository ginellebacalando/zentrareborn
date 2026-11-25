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

/**
 * Compact footer: the wordmark, the site links and the social links in one band, then the
 * copyright and the legal links. The address, phone and email live in the home Contact section
 * and on the Contact page, and Book Now stays in the header, so neither is repeated here.
 */
export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand} aria-label={`${BRAND.wordmark} home`}>
          <ZentraWordmark size="sm" subtitle={BRAND.legalName} />
        </Link>

        <nav aria-label="Footer" className={styles.nav}>
          <ul className={styles.links}>
            {FOOTER_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href}>{link.label}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <SocialLinks variant="footer" className={styles.social} />
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
