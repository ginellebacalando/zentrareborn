import type { Metadata } from 'next';
import { connection } from 'next/server';
import { Camera } from 'lucide-react';
import ClientPhotoCapture from '@/components/client-photo/ClientPhotoCapture';
import { ButtonLink } from '@/components/shared/Button';
import { BRAND } from '@/config/brand';
import { CLIENT_PHOTO_LIMITS } from '@/config/client-photos';
import { readPhotoPage } from '@/services/client-photos';
import shared from '../../booking/_components/BookingRequest.module.css';

export const metadata: Metadata = {
  title: `Your arrival photo | ${BRAND.wordmark}`,
  description: 'Add, change or remove your optional arrival photo for Zion Events Place.',
  // A private link: never indexed, and never passed on to other sites as a referrer.
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

const eventDay = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'full' });

/**
 * A client's private photo page (docs/client-photos.md), reached through the expiring link in a
 * photo request or reminder email. Clients without an account add, change or remove their
 * optional arrival photo here.
 */
export default async function PhotoLinkPage({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { token } = await params;
  const view = await readPhotoPage(token);
  return (
    <main id="main-content" tabIndex={-1} className="public-page">
      <div className={shared.page}>
        <section className={shared.done} aria-labelledby="photo-page-title">
          <Camera aria-hidden="true" className={shared.noticeIcon} />
          {view.state === 'ready' ? (
            <>
              <h1 id="photo-page-title" className={shared.doneTitle}>
                {view.firstName ? `${view.firstName}, your arrival photo` : 'Your arrival photo'}
              </h1>
              <p className={shared.reference}>
                {view.kind === 'booking' ? 'Booking' : 'Visit'} reference{' '}
                <strong>{view.reference}</strong>
              </p>
              <p className={shared.muted}>
                For your {view.kind === 'booking' ? 'event' : 'ocular visit'} on{' '}
                {eventDay.format(new Date(view.startsAt))}. The photo is optional: your{' '}
                {view.kind === 'booking' ? 'booking' : 'visit'} is the same without it.
              </p>
              <ClientPhotoCapture
                photo={view.photo}
                skippable
                skippedNote={`No problem. This link keeps working for up to ${CLIENT_PHOTO_LIMITS.linkDays} days if you change your mind.`}
              />
            </>
          ) : (
            <>
              <h1 id="photo-page-title" className={shared.doneTitle}>
                This photo link has expired
              </h1>
              <p className={shared.muted}>
                Photo links work for {CLIENT_PHOTO_LIMITS.linkDays} days. Use the link in your
                latest email from us, or ask our team for a new one. Adding a photo is optional.
              </p>
            </>
          )}
          <p className={shared.hint}>
            Questions? Call <a href={BRAND.contact.phoneHref}>{BRAND.contact.phone}</a> or email{' '}
            <a href={BRAND.contact.emailHref}>{BRAND.contact.email}</a>.
          </p>
          <div className={shared.actions}>
            <ButtonLink href="/" variant="secondary" size="lg">
              Back to home
            </ButtonLink>
          </div>
        </section>
      </div>
    </main>
  );
}
