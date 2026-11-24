import test from 'node:test';
import assert from 'node:assert/strict';
import { redactPersonalData } from './redaction';

test('removes email addresses, Philippine phone numbers and long numbers', () => {
  const text = redactPersonalData(
    'Email me at maria.santos@example.test or call 0917 123 4567, +63 918-765-4321, (02) 8123 4567. Card 4111 1111 1111 1111.',
  );
  assert.doesNotMatch(text, /maria|example|0917|4567|918|8123|4111/);
  assert.match(text, /\[email\]/);
  assert.equal(text.match(/\[phone\]/g)?.length, 3);
  assert.match(text, /\[number\]/);
});

test('removes booking references, labelled references and street addresses', () => {
  const text = redactPersonalData(
    'My booking ref: AB12CD34 and inquiry ZENI-1C2F33AA. I live at Blk 5 Lot 12, 123 Rizal Street, Brgy. San Antonio, Purok 3, Green Meadows Village.',
  );
  assert.doesNotMatch(text, /AB12CD34|1C2F33AA|Rizal|San Antonio|Purok 3|Green Meadows|Blk 5/);
  assert.match(text, /\[reference\]/);
  assert.match(text, /\[address\]/);
});

test('removes names the guest introduces, in English and Filipino, and known names', () => {
  assert.equal(
    redactPersonalData('Hi, my name is Maria Santos and I want a wedding'),
    'Hi, my name is [name] and I want a wedding',
  );
  assert.match(redactPersonalData("I'm Juan dela Cruz, planning a debut"), /I'm \[name\]/);
  assert.doesNotMatch(redactPersonalData('Ako po si Liza Reyes'), /Liza|Reyes/);
  assert.doesNotMatch(redactPersonalData('Pangalan ko ay Carlo'), /Carlo/);
  const known = redactPersonalData('Can Ana and maria santos visit on Friday?', {
    names: ['Maria Santos'],
  });
  assert.doesNotMatch(known, /maria|santos/i);
  assert.match(known, /Ana/);
});

test('keeps venue names, dates, guest counts and times needed to answer', () => {
  const question =
    'Is Selah Hall or the Pavilion Garden free on 2099-12-24 from 2 PM to 7 PM for 150 guests? This is Zion right?';
  assert.equal(redactPersonalData(question), question);
  assert.equal(
    redactPersonalData("I'm Interested in the Zion Classic package"),
    "I'm Interested in the Zion Classic package",
  );
  assert.equal(redactPersonalData('reservation is 2099-12-24'), 'reservation is 2099-12-24');
});

test('redaction is idempotent and bounded', () => {
  const once = redactPersonalData('my email is a@b.co, phone 09171234567');
  assert.equal(redactPersonalData(once), once);
  assert.equal(redactPersonalData('x'.repeat(900)).length, 600);
  assert.equal(redactPersonalData('x'.repeat(900), { maxLength: 300 }).length, 300);
});
