import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBookingLink, buildVisitLink, bookingEventSlug, bookingPackageSlug } from './links';
import {
  bookingPrefillNote,
  hasBookingPrefill,
  parseBookingPrefill,
} from '@/app/booking/_components/bookingPrefill';
import { parseVisitPrefill } from '@/app/contact/_components/visitPrefill';

const today = '2026-11-25';
/** Settings > Booking window on that day: 14 days of notice, up to 18 months ahead. */
const bookingDates = { earliest: '2026-12-09', latest: '2028-05-25' };

test('booking links carry only valid details and always mark the source', () => {
  const link = buildBookingLink({
    eventType: 'wedding',
    packageName: 'Zion Classic',
    date: '2027-02-14',
    startTime: '14:00',
    endTime: '19:00',
    guests: 120,
  });
  assert.equal(
    link,
    '/booking?event=wedding&package=classic&date=2027-02-14&start=14%3A00&end=19%3A00&guests=120&source=zeni',
  );
  assert.equal(
    buildBookingLink({ eventType: 'corporate', packageName: 'Premium', date: '14/02/2027' }),
    '/booking?source=zeni',
  );
  assert.equal(
    buildBookingLink({ startTime: '19:00', endTime: '14:00', guests: 900 }),
    '/booking?source=zeni',
  );
  assert.equal(bookingEventSlug('gender reveal'), 'gender-reveal');
  assert.equal(bookingEventSlug('christmas party'), 'christmas-party');
  assert.equal(bookingPackageSlug('Wedding — Zion Ultimate'), undefined);
  assert.equal(buildVisitLink('2027-01-09'), '/visit?date=2027-01-09&source=zeni');
  assert.equal(buildVisitLink('2027-1-9'), '/visit?source=zeni');
  assert.equal(buildVisitLink(), '/visit?source=zeni');
});

test('the booking page parses a Zeni link into journey values', () => {
  const link = buildBookingLink({
    eventType: 'debut',
    packageName: 'Grand',
    date: '2027-02-14',
    startTime: '14:00',
    endTime: '19:00',
    guests: 120,
  });
  const prefill = parseBookingPrefill(link.slice(link.indexOf('?')), bookingDates);
  assert.deepEqual(prefill, {
    fromZeni: true,
    eventType: 'Debut',
    packageTier: 'Zion Grand',
    eventDate: '2027-02-14',
    startTime: '14:00',
    endTime: '19:00',
    guestCount: 120,
  });
  assert.equal(hasBookingPrefill(prefill), true);
  assert.equal(
    bookingPrefillNote(prefill),
    'Preferred time (from Zeni): 14:00–19:00, Manila time.',
  );
});

test('invalid, past, far-future or unknown values are ignored, never guessed', () => {
  const prefill = parseBookingPrefill(
    '?event=funeral&package=platinum&date=2026-11-24&start=25:00&end=19:00&guests=0&source=other',
    bookingDates,
  );
  assert.deepEqual(prefill, { fromZeni: false });
  assert.equal(hasBookingPrefill(prefill), false);
  assert.equal(bookingPrefillNote(prefill), '');
  assert.equal(parseBookingPrefill('?date=2031-01-01', bookingDates).eventDate, undefined);
  assert.equal(parseBookingPrefill('?date=2027-02-30', bookingDates).eventDate, undefined);
  assert.equal(parseBookingPrefill('?guests=501', bookingDates).guestCount, undefined);
  assert.equal(parseBookingPrefill('?guests=12abc', bookingDates).guestCount, undefined);
  assert.equal(parseBookingPrefill('?start=14:00', bookingDates).startTime, undefined);
  assert.equal(parseBookingPrefill('?event=WEDDING', bookingDates).eventType, 'Wedding');
});

test('the contact page still turns an earlier Zeni visit link into a visit request message', () => {
  const visit = parseVisitPrefill('topic=visit&date=2027-01-09&source=zeni', today);
  assert.equal(visit?.subject, 'General Message');
  assert.match(visit?.message ?? '', /ocular visit/);
  assert.match(visit?.message ?? '', /Saturday, January 9, 2027/);
  assert.doesNotMatch(
    parseVisitPrefill('topic=visit&date=2020-01-01', today)?.message ?? '',
    /2020/,
  );
  assert.equal(parseVisitPrefill('topic=general&date=2027-01-09', today), null);
  assert.equal(parseVisitPrefill('', today), null);
});

test('an event page names the exact guest tier; dates outside the booking window are ignored', () => {
  const prefill = parseBookingPrefill(
    '?event=debut&package=zion-essential-100&guests=120',
    bookingDates,
  );
  assert.deepEqual(prefill, {
    fromZeni: false,
    eventType: 'Debut',
    packageSlug: 'zion-essential-100',
    guestCount: 120,
  });
  // A tier word stays a tier word; a name without a guest count is not a catalog slug.
  assert.equal(parseBookingPrefill('?package=classic', bookingDates).packageTier, 'Zion Classic');
  assert.equal(parseBookingPrefill('?package=platinum', bookingDates).packageSlug, undefined);
  assert.equal(parseBookingPrefill('?date=2026-12-08', bookingDates).eventDate, undefined);
  assert.equal(parseBookingPrefill('?date=2026-12-09', bookingDates).eventDate, '2026-12-09');
  assert.equal(parseBookingPrefill('?date=2028-05-26', bookingDates).eventDate, undefined);
});
