import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AUTOMATION_JOB_LABELS } from './catalog';
import { AUTOMATIONS, automationForEvent } from './automations';

/** The Automation page lists every email the system sends, each under exactly one automation. */
test('every automated email belongs to exactly one automation', () => {
  for (const event of Object.keys(AUTOMATION_JOB_LABELS)) {
    const owners = AUTOMATIONS.filter((automation) => automation.events.includes(event));
    assert.equal(owners.length, 1, `${event} belongs to ${owners.length} automations`);
    assert.equal(automationForEvent(event)?.key, owners[0].key);
  }
  for (const automation of AUTOMATIONS)
    for (const event of automation.events)
      assert.ok(event in AUTOMATION_JOB_LABELS, `${automation.key} lists unknown ${event}`);
  assert.equal(new Set(AUTOMATIONS.map((automation) => automation.key)).size, AUTOMATIONS.length);
});

test('steps of the booking flow cannot be switched off, and each says why', () => {
  for (const key of [
    'booking-decision',
    'payment-outcome',
    'booking-cancelled',
    'hold-expired',
    'visit-change',
    'team-invitation',
  ]) {
    const automation = AUTOMATIONS.find((candidate) => candidate.key === key);
    assert.ok(automation, key);
    assert.equal(automation.canSwitchOff, false, key);
    assert.ok(automation.essential, `${key} explains why it stays on`);
  }
  for (const automation of AUTOMATIONS.filter((candidate) => candidate.canSwitchOff))
    assert.equal(automation.essential, undefined, automation.key);
});
