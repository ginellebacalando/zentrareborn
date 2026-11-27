import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  appointmentLabel,
  appointmentNoun,
  appointmentPlace,
  appointmentPurpose,
  withArticle,
} from './appointments';

/** Calendar appointments (docs/visits.md, "Appointments"): what each one is called. */

test('each appointment is named for what it is for', () => {
  assert.equal(appointmentLabel({ purpose: 'OCULAR', title: '' }), 'Ocular visit');
  assert.equal(appointmentLabel({ purpose: 'CONTRACT', title: 'ignored' }), 'Contract signing');
  assert.equal(appointmentLabel({ purpose: 'MEETING', title: ' Food tasting ' }), 'Food tasting');
  assert.equal(appointmentLabel({ purpose: 'MEETING', title: '' }), 'Meeting');
  assert.equal(appointmentNoun({ purpose: 'PLANNING', title: '' }), 'planning meeting');
  assert.equal(appointmentNoun({ purpose: 'MEETING', title: 'Food tasting' }), 'Food tasting');
});

test('anything unknown is an ocular visit, at the venue unless a place is given', () => {
  assert.equal(appointmentPurpose('SOMETHING'), 'OCULAR');
  assert.equal(appointmentPurpose(null), 'OCULAR');
  assert.equal(appointmentPlace({ place: '  ' }, 'Zion Events Place'), 'Zion Events Place');
  assert.equal(appointmentPlace({ place: 'Online' }, 'Zion Events Place'), 'Online');
  assert.equal(withArticle('ocular visit'), 'an ocular visit');
  assert.equal(withArticle('planning meeting'), 'a planning meeting');
});
