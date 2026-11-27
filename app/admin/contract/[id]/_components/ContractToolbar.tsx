'use client';

import { ArrowLeft, Printer } from 'lucide-react';
import { Button, ButtonLink } from '@/components/shared/Button';
import styles from './Contract.module.css';

/** Back to the booking, and the browser's print window, where "Save as PDF" downloads a copy. */
export default function ContractToolbar({ backHref }: { backHref: string }) {
  return (
    <header className={styles.toolbar}>
      <ButtonLink
        href={backHref}
        variant="secondary"
        size="sm"
        icon={<ArrowLeft aria-hidden="true" />}
      >
        Back to booking
      </ButtonLink>
      <div className={styles.toolbarActions}>
        <p className={styles.toolbarHint}>To download it, choose Save as PDF.</p>
        <Button
          type="button"
          variant="primary"
          size="sm"
          icon={<Printer aria-hidden="true" />}
          onClick={() => window.print()}
        >
          Print or save as PDF
        </Button>
      </div>
    </header>
  );
}
