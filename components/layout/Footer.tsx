import Link from 'next/link';
import { BRAND } from '@/config/brand';
import { FIND_PAYMENT_PAGE_PATH } from '@/config/booking';
import ZentraWordmark from '@/components/shared/ZentraWordmark';
import SocialLinks from './SocialLinks';
import styles from './Footer.module.css';

const FOOTER_LINKS = [
  // Clients who lost the email with their payment link get it again here.
  { label: 'Find my payment page', href: FIND_PAYMENT_PAGE_PATH },
  { label: 'Terms & Conditions', href: '/terms' },
  { label: 'Event Policies', href: '/policies' },
  { label: 'House Rules', href: '/rules' },
  { label: 'Privacy', href: '/privacy' },
] as const;

/**
 * Compact footer: the wordmark and the social links in one band, then the copyright, the payment
 * page finder and the legal links. Nothing here repeats the header: the site links live in the
 * main menu, the address, phone and email in the home Contact section and on the Contact page, and
 * Book Now in the header.
 */
export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand} aria-label={`${BRAND.wordmark} home`}>
          <ZentraWordmark size="sm" subtitle={BRAND.legalName} />
        </Link>

        <SocialLinks variant="footer" className={styles.social} />
      </div>

      <div className={styles.legal}>
        <p>
          &copy; {year} {BRAND.legalName}. All rights reserved.
        </p>
        <ul className={styles.legalLinks} aria-label="More links">
          {FOOTER_LINKS.map((link) => (
            <li key={link.href}>
              <Link href={link.href}>{link.label}</Link>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
