import Link from 'next/link';
import { BRAND } from '@/config/brand';
import ZentraWordmark from '@/components/shared/ZentraWordmark';
import Navbar from './Navbar';
import styles from './GlobalHeader.module.css';

/**
 * Figma header: a white bar with the centered ZENTRA wordmark over a hairline. The navigation
 * itself is the team's existing menu (button + side panel), kept exactly as it was.
 */
export default function GlobalHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <span aria-hidden="true" />
        <Link href="/" className={styles.brand} aria-label={`${BRAND.wordmark} home`}>
          <ZentraWordmark size="md" />
        </Link>
        <div className={styles.actions}>
          <Navbar />
        </div>
      </div>
    </header>
  );
}
