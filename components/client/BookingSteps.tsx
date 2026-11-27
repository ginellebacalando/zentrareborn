import type { ReactNode } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { BRAND } from '@/config/brand';
import styles from './BookingSteps.module.css';

/** The client's way from request to event day, in the order Zion works (docs/booking-automation.md). */
export type BookingStepKey =
  'request' | 'fee' | 'confirmed' | 'visit' | 'contract' | 'balance' | 'event';

/** Settings > Booking automation: days to pay the fee, and days before the event the rest is due. */
export type BookingStepRules = { paymentDeadlineDays: number; balanceDueDays: number };

const days = (count: number) => `${count} day${count === 1 ? '' : 's'}`;

type BookingStep = {
  key: BookingStepKey;
  title: string;
  text: string;
  optional?: boolean;
  action?: { href: string; label: string };
};

function steps(rules: BookingStepRules | null): BookingStep[] {
  return [
    {
      key: 'request',
      title: 'Send your request',
      text: 'Choose your date and package. Most requests are approved right away and your date is held for you; custom proposals and some larger events are reviewed by our team first.',
    },
    {
      key: 'fee',
      title: 'Pay the reservation fee',
      text: `${rules ? `Pay within ${days(rules.paymentDeadlineDays)} of approval` : 'Pay before your hold ends'} to keep your date: cash at ${BRAND.legalName}, or GCash or bank transfer with a screenshot on your payment page.`,
    },
    {
      key: 'confirmed',
      title: 'Get your confirmation',
      text: 'We check your payment against our records and email your confirmation with a calendar invitation.',
    },
    {
      key: 'visit',
      title: 'Visit and plan',
      optional: true,
      text: 'See the venue on an ocular visit and talk through your plans with our team.',
      action: { href: '/visit', label: 'Schedule an ocular visit' },
    },
    {
      key: 'contract',
      title: 'Sign your contract',
      text: `We prepare your contract with your event details, package and payments, and you sign it with us at ${BRAND.legalName}.`,
    },
    {
      key: 'balance',
      title: 'Pay the balance',
      text: `Pay the rest ${rules ? `at least ${days(rules.balanceDueDays)} before your event` : 'by the due date on your payment page'}, on the same payment page. We remind you a week and a day before.`,
    },
    {
      key: 'event',
      title: 'Celebrate',
      text: 'Our coordinators run the day with you.',
    },
  ];
}

/**
 * "Your booking, step by step": every step from the request to the event day, so a client always
 * knows what comes next. Steps already done show a tick and the current one is marked; `notes`
 * replaces a step's text where the page knows more (an amount, a deadline). Without `rules` the
 * days are left out rather than guessed.
 */
export default function BookingSteps({
  title = 'Your booking, step by step',
  headingLevel = 'h2',
  done = [],
  current = null,
  rules = null,
  notes = {},
  showVisitAction = true,
  id = 'booking-steps',
}: {
  title?: string;
  headingLevel?: 'h2' | 'h3';
  done?: BookingStepKey[];
  current?: BookingStepKey | null;
  rules?: BookingStepRules | null;
  notes?: Partial<Record<BookingStepKey, ReactNode>>;
  /** The ocular visit link; left out where the page already offers it next to the guide. */
  showVisitAction?: boolean;
  /** Names the heading; unique on the page. */
  id?: string;
}) {
  const Heading = headingLevel;
  return (
    <section className={styles.guide} aria-labelledby={`${id}-title`}>
      <Heading id={`${id}-title`} className={styles.title}>
        {title}
      </Heading>
      <ol className={styles.steps}>
        {steps(rules).map((step, index) => {
          const state = done.includes(step.key)
            ? 'done'
            : current === step.key
              ? 'current'
              : 'upcoming';
          return (
            <li
              key={step.key}
              className={styles.step}
              data-state={state}
              aria-current={state === 'current' ? 'step' : undefined}
            >
              <span className={styles.marker} aria-hidden="true">
                {state === 'done' ? <Check strokeWidth={3} /> : index + 1}
              </span>
              <div className={styles.body}>
                <p className={styles.stepTitle}>
                  {state === 'done' && <span className={styles.srOnly}>Done: </span>}
                  {state === 'current' && <span className={styles.srOnly}>Now: </span>}
                  {step.title}
                  {step.optional && <span className={styles.optional}>Optional</span>}
                </p>
                <p className={styles.text}>{notes[step.key] ?? step.text}</p>
                {step.action && showVisitAction && state !== 'done' && (
                  <Link href={step.action.href} className={styles.action}>
                    {step.action.label}
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
