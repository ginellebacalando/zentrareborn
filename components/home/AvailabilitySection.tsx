import type { CSSProperties } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import OpenChatbotButton from '@/components/chatbot/OpenChatbotButton';
import SectionHeading from './SectionHeading';
import styles from './HomeSections.module.css';

const BOOKING_STEPS = [
  {
    title: 'Check your date',
    text: 'Ask Zeni or pick a date on the booking page. Only confirmed events block a date.',
  },
  {
    title: 'Send your request',
    text: 'Choose your event, package and guest count. You review every detail before sending.',
  },
  {
    title: 'Approval and payment',
    text: 'Our team reviews the request and shares the payment details for your reservation.',
  },
  {
    title: 'Confirmed',
    text: 'Your date is reserved once payment is verified, and you receive a calendar invite.',
  },
] as const;

/**
 * "Available dates" from Figma, with the plan's "How booking works" steps (redesigned 26 November
 * 2026): the invitation and its two main actions on the left, the ocular visit as a quieter link,
 * and the four steps as a connected timeline. When the section scrolls into view the markers
 * appear one after another and the line between them draws downward (see HomeSections.module.css);
 * under reduced motion everything is simply shown.
 */
export default function AvailabilitySection() {
  return (
    <section id="available-dates" className={styles.section} aria-labelledby="home-dates-title">
      <div className={styles.container}>
        <SectionHeading
          id="home-dates-title"
          title="Available Dates"
          subtitle="Find your date first, then book in a few steps"
        />
        <div className={styles.datesLayout}>
          <div className={`${styles.datesIntro} ${styles.stagger}`}>
            <p className={styles.datesLead}>
              Popular weekends fill up months ahead. Ask Zeni, our virtual concierge, whether a date
              is open, or start a booking and choose from the dates the calendar allows.
            </p>
            <div className={styles.actions}>
              <OpenChatbotButton
                prompt="Is my preferred date available?"
                className={styles.buttonPrimary}
              >
                Ask Zeni about a date
              </OpenChatbotButton>
              <Link href="/booking" className={styles.buttonOutline}>
                Start a booking
              </Link>
            </div>
            {/* The public visit page (docs/visits.md): a time to see the venue before booking. */}
            <p className={styles.visitPrompt}>
              Prefer to see the venue first?{' '}
              <Link href="/visit" className={styles.visitLink}>
                Schedule an ocular visit
                <ArrowRight className={styles.visitArrow} aria-hidden="true" />
              </Link>
            </p>
          </div>

          <ol className={styles.timeline} aria-label="How booking works">
            {BOOKING_STEPS.map((step, index) => (
              <li
                key={step.title}
                className={styles.timelineStep}
                style={{ '--step': index } as CSSProperties}
              >
                <span className={styles.timelineMarker} aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div className={styles.timelineBody}>
                  <h3 className={styles.timelineTitle}>{step.title}</h3>
                  <p className={styles.timelineText}>{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
