import test from 'node:test';
import assert from 'node:assert/strict';
import { detectLanguage, languageName, templateLanguage } from './language';
import { zeniCopyFor } from '@/config/chatbot-receptionist';

test('detects English, Filipino and Taglish with a simple word heuristic', () => {
  for (const [text, expected] of [
    ['How much is the wedding package?', 'en'],
    ['Where are you located?', 'en'],
    ['Is Selah Hall available on 2099-12-24?', 'en'],
    ['Magkano po ang kasal?', 'fil'],
    ['Salamat po!', 'fil'],
    ['Saan po kayo?', 'fil'],
    ['Magkano po ang wedding package?', 'taglish'],
    ['Hi! May available pa ba kayo sa Oct 9? Mga 150 guests, wedding sana.', 'taglish'],
    ['Saan kayo located?', 'taglish'],
    ['Pwede po ba mag-book for 100 guests?', 'taglish'],
  ] as const)
    assert.equal(detectLanguage(text), expected, text);
});

test('messages without language markers keep the conversation language', () => {
  assert.equal(detectLanguage('2099-12-24', 'taglish'), 'taglish');
  assert.equal(detectLanguage('Hello', 'fil'), 'fil');
  assert.equal(detectLanguage('100', 'en'), 'en');
  assert.equal(detectLanguage('OK'), 'en');
});

test('Filipino and Taglish share the Taglish templates; English keeps its own', () => {
  assert.equal(templateLanguage('en'), 'en');
  assert.equal(templateLanguage('fil'), 'taglish');
  assert.equal(templateLanguage('taglish'), 'taglish');
  assert.equal(languageName('fil'), 'Filipino');
  const english = zeniCopyFor('en');
  const taglish = zeniCopyFor('fil');
  for (const key of [
    'greeting',
    'askDate',
    'handoffName',
    'handoffConsent',
    'knowledgeGap',
  ] as const) {
    assert.ok(english[key].length > 10, key);
    assert.notEqual(english[key], taglish[key], key);
  }
  assert.match(taglish.unavailable('Thursday, December 24, 2099'), /po/);
  assert.notEqual(english.errors.timeout, taglish.errors.timeout);
  assert.notEqual(english.errors.unavailable, taglish.errors.unavailable);
});
