'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Star } from 'lucide-react';
import type { PublicTestimony } from '@/lib/testimony-types';
import SectionHeading from './SectionHeading';
import styles from './HomeSections.module.css';

type SettingsPayload = {
  settings?: { client?: { maintenanceMode?: boolean; publicTestimoniesVisible?: boolean } };
};

function Stars({ value }: { value: number }) {
  return (
    <span className={styles.stars} role="img" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          aria-hidden="true"
          className={star <= value ? styles.starFilled : styles.starEmpty}
        />
      ))}
    </span>
  );
}

function eventMonth(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
}

/** Featured guest reviews, shown only while the admin keeps public reviews visible. */
export default function ReviewsSection() {
  const [reviews, setReviews] = useState<PublicTestimony[] | null>(null);

  useEffect(() => {
    let active = true;
    void fetch('/api/client/settings', { cache: 'no-store' })
      .then((response) => response.json() as Promise<SettingsPayload>)
      .then((payload) => {
        const client = payload.settings?.client;
        const visible = !client?.maintenanceMode && client?.publicTestimoniesVisible !== false;
        return visible
          ? fetch('/api/client/testimonies/featured?limit=3', { cache: 'no-store' }).then(
              (response) => response.json() as Promise<{ testimonies?: PublicTestimony[] }>,
            )
          : { testimonies: [] };
      })
      .then((payload) => {
        if (active) setReviews(payload.testimonies ?? []);
      })
      .catch(() => {
        if (active) setReviews([]);
      });
    return () => {
      active = false;
    };
  }, []);

  if (reviews !== null && reviews.length === 0) return null;

  return (
    <section
      className={`${styles.section} ${styles.subtle}`}
      aria-labelledby="home-reviews-title"
      aria-busy={reviews === null}
    >
      <div className={styles.container}>
        <SectionHeading
          id="home-reviews-title"
          title="Reviews"
          subtitle="What our guests say after their celebration"
        />
        {reviews === null ? (
          <p className={styles.muted} role="status">
            Loading reviews…
          </p>
        ) : (
          <div className={`${styles.reviews} ${styles.stagger}`}>
            {reviews.map((review) => (
              <figure key={review.id} className={styles.review}>
                <Stars value={review.overallRating} />
                <blockquote className={styles.quote}>
                  <p>{review.comment}</p>
                </blockquote>
                <figcaption>
                  <p className={styles.reviewer}>{review.clientName}</p>
                  <p className={styles.reviewMeta}>
                    {[review.eventType, eventMonth(review.eventDate)].filter(Boolean).join(' · ')}
                  </p>
                </figcaption>
              </figure>
            ))}
          </div>
        )}
        <div className={styles.centered}>
          <Link href="/testimonies" className={styles.textLink}>
            Read all reviews
          </Link>
        </div>
      </div>
    </section>
  );
}
