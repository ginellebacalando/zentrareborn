import assert from 'node:assert/strict';
import test from 'node:test';

import {
  chosenOnlineMethod,
  howToPay,
  offeredBookingPaymentMethods,
  preferredPaymentMethod,
  preferredPaymentNote,
} from './booking-payment-choice';

const CASH = 'Pay cash at Zion Events Place after staff approval.';

test('the payment choice is written to the notes and read back from them', () => {
  assert.equal(preferredPaymentNote('BANK_TRANSFER'), 'Preferred payment: Bank transfer.');
  const notes = `Sent from the website booking page.\n${preferredPaymentNote('GCASH')}\nAsked about: Sound system.`;
  assert.equal(preferredPaymentMethod(notes), 'GCASH');
  assert.equal(preferredPaymentMethod(preferredPaymentNote('CASH')), 'CASH');
  assert.equal(preferredPaymentMethod('Staff rewrote the notes.'), null);
  assert.equal(preferredPaymentMethod('Preferred payment: Cheque.'), null);
  assert.equal(preferredPaymentMethod(null), null);
});

test('GCash and bank transfer are offered only while their account is set up', () => {
  assert.deepEqual(offeredBookingPaymentMethods([]), ['CASH']);
  assert.deepEqual(offeredBookingPaymentMethods(['GCASH']), ['GCASH', 'CASH']);
  assert.deepEqual(offeredBookingPaymentMethods(['GCASH', 'BANK_TRANSFER']), [
    'BANK_TRANSFER',
    'GCASH',
    'CASH',
  ]);
  assert.equal(chosenOnlineMethod('BANK_TRANSFER', ['BANK_TRANSFER']), 'BANK_TRANSFER');
  assert.equal(chosenOnlineMethod('BANK_TRANSFER', ['GCASH']), null);
  assert.equal(chosenOnlineMethod('CASH', ['GCASH', 'BANK_TRANSFER']), null);
});

test('emails tell each client how to pay by the way they chose', () => {
  const transfer = howToPay(CASH, 'BANK_TRANSFER', ['BANK_TRANSFER', 'GCASH']);
  assert.match(transfer, /^Pay by bank transfer .* then attach your receipt there\./);
  assert.doesNotMatch(transfer, /cash/i);
  assert.match(howToPay(CASH, 'GCASH', ['GCASH']), /^Pay by GCash /);
  assert.equal(howToPay(CASH, 'CASH', ['GCASH', 'BANK_TRANSFER']), CASH);
  // No account set up yet: everyone is told how to pay in cash.
  assert.equal(howToPay(CASH, 'BANK_TRANSFER', []), CASH);
  // An unknown choice names the cash instructions and every method Zion offers.
  assert.equal(
    howToPay(CASH, null, ['BANK_TRANSFER', 'GCASH']),
    `${CASH} You can also pay by bank transfer or GCash and attach your receipt on your payment page.`,
  );
});
