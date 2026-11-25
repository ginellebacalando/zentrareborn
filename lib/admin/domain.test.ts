import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bookingInput,
  bookingEmail,
  canAccessAdmin,
  confirmationError,
  overlaps,
  paidTotal,
  paymentStatus,
} from './domain';
import { parseStaffNotificationEmails } from './preferences-types';
import { parseBookingRules, paymentDeadline, websiteReviewReasons } from './booking-rules';
test('RBAC rejects clients and disabled or temporary accounts', () => {
  assert.equal(canAccessAdmin('CLIENT', 'ACTIVE'), false);
  assert.equal(canAccessAdmin('ADMIN', 'DISABLED'), false);
  assert.equal(canAccessAdmin('ADMIN', 'TEMP_ACCESS'), false);
  assert.equal(canAccessAdmin('ADMIN', 'ACTIVE'), true);
  assert.equal(canAccessAdmin('SUPERADMIN', 'ACTIVE'), true);
});
test('approval, reservation, payment, and contact verification are independent', () => {
  const b = {
    approval: 'APPROVED',
    verification: 'VERIFIED',
    reservation: 'REQUESTED',
    paymentRule: 'DEPOSIT_REQUIRED',
    depositCents: 3000000,
    totalCents: 10000000,
  };
  assert.match(confirmationError(b, 0, true)!, /reservation fee/);
  assert.equal(confirmationError(b, 3000000, true), null);
  assert.ok(confirmationError({ ...b, verification: 'FLAGGED' }, 3000000, true));
  assert.ok(confirmationError({ ...b, approval: 'PENDING' }, 3000000, true));
  assert.ok(confirmationError(b, 3000000, false));
  assert.ok(confirmationError({ ...b, paymentRule: 'FULL_PAYMENT_REQUIRED' }, 3000000, true));
  assert.equal(confirmationError({ ...b, paymentRule: 'NO_PAYMENT_REQUIRED' }, 0, true), null);
  // The booking automation: the payment secures the date, so an unreviewed contact may confirm.
  assert.equal(confirmationError({ ...b, verification: 'UNREVIEWED' }, 3000000, true), null);
  assert.match(confirmationError({ ...b, verification: 'FLAGGED' }, 3000000, true)!, /flagged/);
  assert.equal(paymentStatus(10000000, 3000000), 'PARTIAL');
  assert.equal(
    paidTotal([
      { amountCents: 100, voidedAt: null },
      { amountCents: 200, voidedAt: new Date() },
    ]),
    100,
  );
});
test('calendar intervals allow adjacent events but reject overlap', () => {
  const d = (s: string) => new Date(`2030-01-01T${s}:00Z`);
  assert.equal(
    overlaps(
      { startsAt: d('10:00'), endsAt: d('12:00') },
      { startsAt: d('12:00'), endsAt: d('13:00') },
    ),
    false,
  );
  assert.equal(
    overlaps(
      { startsAt: d('10:00'), endsAt: d('12:00') },
      { startsAt: d('11:00'), endsAt: d('13:00') },
    ),
    true,
  );
});
test('notifications consistently distinguish approval from paid or confirmed', () => {
  const email = bookingEmail(
    {
      reference: 'ZION-TEST',
      clientName: 'Client',
      approval: 'APPROVED',
      reservation: 'REQUESTED',
      totalCents: 100000,
      depositCents: 30000,
      paymentRule: 'DEPOSIT_REQUIRED',
    },
    0,
    'Cash at the venue after approval.',
    'REQUEST_APPROVED',
  );
  assert.match(email.body, /Approval: APPROVED/);
  assert.match(email.body, /Reservation: REQUESTED/);
  assert.match(email.body, /Payment: UNPAID/);
  assert.match(email.body, /cash reservation fee/);
  assert.doesNotMatch(email.body, /on hold/, 'no deadline, no hold paragraph');
  const held = bookingEmail(
    {
      reference: 'ZION-TEST',
      clientName: 'Client',
      approval: 'APPROVED',
      reservation: 'REQUESTED',
      totalCents: 100000,
      depositCents: 30000,
      paymentRule: 'DEPOSIT_REQUIRED',
      holdExpiresAt: new Date('2030-03-04T09:30:00Z'),
    },
    0,
    'Cash at the venue after approval.',
    'REQUEST_APPROVED',
  );
  assert.match(held.body, /your date is on hold for you\. Please pay the reservation fee of/);
  assert.match(held.body, /Mar 4, 2030, 5:30\sPM \(Manila time\)/);
  const expired = bookingEmail(
    {
      reference: 'ZION-TEST',
      clientName: 'Client',
      approval: 'APPROVED',
      reservation: 'CANCELLED',
      totalCents: 100000,
      depositCents: 30000,
      paymentRule: 'DEPOSIT_REQUIRED',
    },
    0,
    'Cash at the venue after approval.',
    'HOLD_EXPIRED',
  );
  assert.match(expired.body, /The payment deadline passed/);
});
test('booking automation rules: deadlines, review reasons and the Settings fields', () => {
  const from = new Date('2030-03-01T00:00:00Z');
  assert.equal(
    paymentDeadline(from, new Date('2030-03-20T00:00:00Z'), 3).toISOString(),
    '2030-03-04T00:00:00.000Z',
  );
  // Never after the event starts, and never before the moment of approval.
  assert.equal(
    paymentDeadline(from, new Date('2030-03-02T06:00:00Z'), 3).toISOString(),
    '2030-03-02T06:00:00.000Z',
  );
  assert.equal(
    paymentDeadline(from, new Date('2030-02-01T00:00:00Z'), 3).toISOString(),
    from.toISOString(),
  );
  const ordinary = {
    totalCents: 10000000,
    depositCents: 500000,
    paymentRule: 'DEPOSIT_REQUIRED',
    guests: 150,
    policyReviewed: true,
    reviewGuestLimit: null,
  };
  assert.deepEqual(websiteReviewReasons(ordinary), []);
  assert.match(websiteReviewReasons({ ...ordinary, totalCents: 0 }).join(), /custom proposal/);
  assert.match(websiteReviewReasons({ ...ordinary, depositCents: 0 }).join(), /no reservation fee/);
  assert.match(
    websiteReviewReasons({ ...ordinary, paymentRule: 'NO_PAYMENT_REQUIRED' }).join(),
    /no payment is required/,
  );
  assert.match(websiteReviewReasons({ ...ordinary, reviewGuestLimit: 120 }).join(), /120 guests/);
  assert.match(websiteReviewReasons({ ...ordinary, policyReviewed: false }).join(), /policy/);
  assert.deepEqual(parseBookingRules(' 5 ', ''), {
    rules: { paymentDeadlineDays: 5, reviewGuestLimit: null },
  });
  assert.deepEqual(parseBookingRules('3', '130'), {
    rules: { paymentDeadlineDays: 3, reviewGuestLimit: 130 },
  });
  const zeroDays = parseBookingRules('0', '');
  assert.ok('problem' in zeroDays && zeroDays.field === 'paymentDeadlineDays');
  const partialGuest = parseBookingRules('3', '1.5');
  assert.ok('problem' in partialGuest && partialGuest.field === 'reviewGuestLimit');
  assert.ok('problem' in parseBookingRules('', ''));
  assert.ok('problem' in parseBookingRules('15', ''));
});
test('server booking validation rejects unknown fields, invalid fee, and venue spoofing', () => {
  const future = new Date(Date.now() + 86400000).toISOString(),
    end = new Date(Date.now() + 90000000).toISOString();
  const b = {
    clientName: 'Test Client',
    email: 'test@example.com',
    phone: '09123456789',
    eventType: 'Wedding',
    packageName: 'Classic',
    venue: 'Zion Events Place',
    startsAt: future,
    endsAt: end,
    guests: 50,
    totalCents: 10000000,
    depositCents: 3000000,
    paymentRule: 'DEPOSIT_REQUIRED',
  };
  assert.equal(bookingInput.safeParse(b).success, true);
  assert.equal(bookingInput.safeParse({ ...b, approval: 'APPROVED' }).success, false);
  assert.equal(bookingInput.safeParse({ ...b, depositCents: 0 }).success, false);
  assert.equal(bookingInput.safeParse({ ...b, venue: 'Other spelling' }).success, false);
});
test('the staff notification field splits, normalizes and limits addresses like the server', () => {
  assert.deepEqual(
    parseStaffNotificationEmails(' Owner@Gmail.com, staff@example.test;partner@example.test  '),
    {
      emails: ['owner@gmail.com', 'staff@example.test', 'partner@example.test'],
      problem: null,
    },
  );
  assert.deepEqual(parseStaffNotificationEmails(' , '), { emails: [], problem: null });
  const problem = (text: string) => parseStaffNotificationEmails(text).problem ?? '';
  assert.match(problem('owner@gmail.com, owner'), /"owner" is not a valid email address/);
  assert.match(problem('owner@gmail.com, Owner@gmail.com'), /only once/);
  assert.match(problem('a@x.test b@x.test c@x.test d@x.test e@x.test f@x.test'), /up to 5/);
  assert.match(problem([1, 2, 3, 4, 5].map((n) => `${'x'.repeat(50)}${n}@x.test`).join()), /255/);
});
