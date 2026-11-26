import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { publicFaqs } from '@/config/public-faqs';
import SectionHeading from './SectionHeading';
import styles from './HomeSections.module.css';

const HOME_FAQ_COUNT = 4;

/**
 * The most asked questions as native disclosure widgets, with a link to the full FAQ page. A
 * down arrow that turns over when open marks each one as a dropdown, as on the FAQ page; a plus
 * sign read as "add" (QA, 26 November 2026).
 */
export default function FaqSection() {
  return (
    <section className={styles.section} aria-labelledby="home-faq-title">
      <div className={styles.container}>
        <SectionHeading id="home-faq-title" title="FAQ" subtitle="Quick answers before you book" />
        <div className={`${styles.faqList} ${styles.stagger}`}>
          {publicFaqs.slice(0, HOME_FAQ_COUNT).map((faq) => (
            <details key={faq.id} className={styles.faqItem}>
              <summary className={styles.faqQuestion}>
                <span>{faq.question}</span>
                <ChevronDown className={styles.faqChevron} aria-hidden="true" />
              </summary>
              <p className={styles.faqAnswer}>{faq.answer}</p>
            </details>
          ))}
        </div>
        <div className={styles.centered}>
          <Link href="/faq" className={styles.textLink}>
            See all questions
          </Link>
        </div>
      </div>
    </section>
  );
}
