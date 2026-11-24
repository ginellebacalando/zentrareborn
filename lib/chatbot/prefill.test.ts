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
  assert.equal(
    buildVisitLink('2027-01-09'),
    '/contact?topic=visit&date=2027-01-09&source=zeni#message-us',
  );
  assert.equal(buildVisitLink(), '/contact?topic=visit&source=zeni#message-us');
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
  const prefill = parseBookingPrefill(link.slice(link.indexOf('?')), today);
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
    today,
  );
  assert.deepEqual(prefill, { fromZeni: false });
  assert.equal(hasBookingPrefill(prefill), false);
  assert.equal(bookingPrefillNote(prefill), '');
  assert.equal(parseBookingPrefill('?date=2031-01-01', today).eventDate, undefined);
  assert.equal(parseBookingPrefill('?date=2027-02-30', today).eventDate, undefined);
  assert.equal(parseBookingPrefill('?guests=501', today).guestCount, undefined);
  assert.equal(parseBookingPrefill('?guests=12abc', today).guestCount, undefined);
  assert.equal(parseBookingPrefill('?start=14:00', today).startTime, undefined);
  assert.equal(parseBookingPrefill('?event=WEDDING', today).eventType, 'Wedding');
});

test('the contact page turns a visit link into a visit request message', () => {
  const visit = parseVisitPrefill(buildVisitLink('2027-01-09').split('#')[0].split('?')[1], today);
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
