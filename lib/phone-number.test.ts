import assert from 'node:assert/strict';
import test from 'node:test';

import { philippineMobile } from './phone-number';

test('accepts Philippine mobile numbers and saves them without spaces or dashes', () => {
  assert.equal(philippineMobile('09171234567'), '09171234567');
  assert.equal(philippineMobile(' 0917 123 4567 '), '09171234567');
  assert.equal(philippineMobile('0917-123-4567'), '09171234567');
  assert.equal(philippineMobile('+639171234567'), '+639171234567');
  assert.equal(philippineMobile('+63 917 123 4567'), '+639171234567');
});

test('refuses numbers that are not Philippine mobile numbers', () => {
  for (const value of [
    '',
    'not a number',
    // The 13-digit number the booking form used to accept.
    '0917123456789',
    '0917123456',
    '9171234567',
    '639171234567',
    '+6309171234567',
    '08171234567',
    '(02) 8123 4567',
    '+1 415 555 0100',
    '0917.123.4567',
  ])
    assert.equal(philippineMobile(value), null, value);
});
