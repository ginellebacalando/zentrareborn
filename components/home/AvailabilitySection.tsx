import Link from 'next/link';
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

/** "Available dates" from Figma, with the plan's "How booking works" steps. */
export default function AvailabilitySection() {
  return (
    <section id="available-dates" className={styles.section} aria-labelledby="home-dates-title">
      <div className={styles.container}>
        <SectionHeading
          id="home-dates-title"
          title="Available Dates"
          subtitle="Find your date first, then book in a few steps"
        />
        <div className={styles.split}>
          <div>
            <p className={styles.lead}>
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
          </div>
          <ol className={`${styles.steps} ${styles.stagger}`} aria-label="How booking works">
            {BOOKING_STEPS.map((step) => (
              <li key={step.title} className={styles.step}>
                <div>
                  <p className={styles.stepTitle}>{step.title}</p>
                  <p className={styles.stepText}>{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
