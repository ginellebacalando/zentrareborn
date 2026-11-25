import { test } from 'node:test';
import assert from 'node:assert/strict';
import nodemailer from 'nodemailer';
import {
  buildCalendarInvite,
  escapeCalendarText,
  foldCalendarLine,
  formatCalendarDate,
  type CalendarInvite,
} from './ics';
import { toMailOptions } from './transport';

const invite: CalendarInvite = {
  method: 'REQUEST',
  uid: 'booking-abc123@zion-events-place',
  sequence: 4,
  stamp: new Date('2026-11-25T01:02:03.456Z'),
  start: new Date('2026-12-12T07:00:00Z'),
  end: new Date('2026-12-12T12:00:00Z'),
  summary: 'Wedding at Zion Events Place',
  description: 'Reservation ZION-1; Package: Classic, deluxe\nQuestions: call us \\ email us',
  location:
    'Zion Events Place, 82MH+QPG, United Bayanihan Proper Rd, United Bayanihan, San Pedro, 4023 Laguna',
  organizer: { name: 'Zion Events Place', email: 'venue@example.test' },
  attendees: [{ name: 'Maria "Ria" Santos', email: 'Client@Example.test' }],
};

const unfold = (calendar: string) => calendar.replace(/\r\n /g, '');

test('calendar text values escape backslashes, separators and newlines', () => {
  assert.equal(escapeCalendarText('a\\b;c,d\ne\r\nf'), 'a\\\\b\\;c\\,d\\ne\\nf');
});

test('dates are written in UTC basic format', () => {
  assert.equal(formatCalendarDate(new Date('2026-12-12T07:00:00.999Z')), '20261212T070000Z');
  assert.throws(() => formatCalendarDate(new Date('invalid')), /valid/);
});

test('folding keeps every physical line within 75 octets without splitting characters', () => {
  const line = `DESCRIPTION:${'Pagdiriwang ñ ✓ 🎉 '.repeat(20)}`;
  const folded = foldCalendarLine(line);
  const physical = folded.split('\r\n');
  assert.ok(physical.length > 2);
  for (const [index, part] of physical.entries()) {
    assert.ok(Buffer.byteLength(part, 'utf8') <= 75, `line ${index} is too long`);
    if (index > 0) assert.equal(part[0], ' ');
    assert.ok(!part.includes('�'));
  }
  assert.equal(folded.replace(/\r\n /g, ''), line);
  assert.equal(foldCalendarLine('SHORT:value'), 'SHORT:value');
});

test('a booking invitation is a valid iTIP REQUEST with CRLF line endings', () => {
  const calendar = buildCalendarInvite(invite);
  assert.ok(calendar.endsWith('\r\n'));
  assert.ok(!/[^\r]\n/.test(calendar), 'every line break must be CRLF');
  for (const line of calendar.split('\r\n'))
    assert.ok(Buffer.byteLength(line, 'utf8') <= 75, `unfolded line too long: ${line}`);
  const text = unfold(calendar);
  const lines = text.split('\r\n');
  assert.equal(lines[0], 'BEGIN:VCALENDAR');
  assert.ok(lines.includes('VERSION:2.0'));
  assert.ok(lines.some((line) => line.startsWith('PRODID:')));
  assert.ok(lines.includes('METHOD:REQUEST'));
  assert.ok(lines.includes('UID:booking-abc123@zion-events-place'));
  assert.ok(lines.includes('SEQUENCE:4'));
  assert.ok(lines.includes('DTSTAMP:20261125T010203Z'));
  assert.ok(lines.includes('DTSTART:20261212T070000Z'));
  assert.ok(lines.includes('DTEND:20261212T120000Z'));
  assert.ok(lines.includes('STATUS:CONFIRMED'));
  assert.ok(lines.includes('SUMMARY:Wedding at Zion Events Place'));
  assert.ok(
    lines.includes(
      'LOCATION:Zion Events Place\\, 82MH+QPG\\, United Bayanihan Proper Rd\\, United Bayanihan\\, San Pedro\\, 4023 Laguna',
    ),
  );
  assert.ok(
    lines.includes(
      'DESCRIPTION:Reservation ZION-1\\; Package: Classic\\, deluxe\\nQuestions: call us \\\\ email us',
    ),
  );
  assert.ok(lines.includes('ORGANIZER;CN="Zion Events Place":mailto:venue@example.test'));
  assert.ok(
    lines.includes(
      'ATTENDEE;CN="Maria Ria Santos";ROLE=REQ-PARTICIPANT;RSVP=FALSE:mailto:client@example.test',
    ),
  );
  assert.equal(lines.filter((line) => line === 'BEGIN:VEVENT').length, 1);
  assert.equal(lines.at(-2), 'END:VCALENDAR');
});

test('a cancellation reuses the UID with a higher SEQUENCE and METHOD:CANCEL', () => {
  const request = unfold(buildCalendarInvite(invite));
  const cancel = unfold(buildCalendarInvite({ ...invite, method: 'CANCEL', sequence: 5 }));
  const uid = (value: string) => value.match(/\r\nUID:([^\r]+)/)?.[1];
  const sequence = (value: string) => Number(value.match(/\r\nSEQUENCE:(\d+)/)?.[1]);
  assert.equal(uid(cancel), uid(request));
  assert.ok(sequence(cancel) > sequence(request));
  assert.match(cancel, /\r\nMETHOD:CANCEL\r\n/);
  assert.match(cancel, /\r\nSTATUS:CANCELLED\r\n/);
  assert.doesNotMatch(cancel, /TRANSP:OPAQUE/);
});

test('a pending request is TENTATIVE and free time; its confirmation reuses the UID', () => {
  const pending = unfold(buildCalendarInvite({ ...invite, status: 'TENTATIVE', sequence: 1 }));
  assert.match(pending, /\r\nMETHOD:REQUEST\r\n/);
  assert.match(pending, /\r\nSTATUS:TENTATIVE\r\n/);
  assert.match(pending, /\r\nTRANSP:TRANSPARENT\r\n/);
  assert.doesNotMatch(pending, /STATUS:CONFIRMED|TRANSP:OPAQUE/);
  const confirmed = unfold(buildCalendarInvite({ ...invite, status: 'CONFIRMED' }));
  assert.match(confirmed, /\r\nSTATUS:CONFIRMED\r\n/);
  assert.match(confirmed, /\r\nTRANSP:OPAQUE\r\n/);
  const uid = (value: string) => value.match(/\r\nUID:([^\r]+)/)?.[1];
  assert.equal(uid(confirmed), uid(pending));
  // A cancellation is always CANCELLED, whatever status the invitation had.
  const cancel = unfold(buildCalendarInvite({ ...invite, method: 'CANCEL', status: 'TENTATIVE' }));
  assert.match(cancel, /\r\nSTATUS:CANCELLED\r\n/);
  assert.doesNotMatch(cancel, /TRANSP:/);
});

test('invalid invitations are rejected instead of producing a broken calendar', () => {
  assert.throws(() => buildCalendarInvite({ ...invite, uid: ' ' }), /UID/);
  assert.throws(() => buildCalendarInvite({ ...invite, sequence: -1 }), /SEQUENCE/);
  assert.throws(() => buildCalendarInvite({ ...invite, end: invite.start }), /end after/);
  assert.throws(() => buildCalendarInvite({ ...invite, attendees: [] }), /attendee/);
  assert.throws(
    () =>
      buildCalendarInvite({
        ...invite,
        attendees: [{ name: 'X', email: 'not-an-address\r\nBCC:x@example.test' }],
      }),
    /valid email/,
  );
});

test('nodemailer renders text, HTML and a text/calendar part Gmail can add to a calendar', async () => {
  const transport = nodemailer.createTransport({
    streamTransport: true,
    buffer: true,
    newline: 'windows',
  });
  const content = buildCalendarInvite(invite);
  const info = await transport.sendMail(
    toMailOptions({
      messageId: '<automation.job-1@example.test>',
      from: { name: 'Zion Events Place', address: 'venue@example.test' },
      to: 'client@example.test',
      replyTo: null,
      subject: 'Zion Events Place | RESERVATION CONFIRMED | ZION-1',
      text: 'Plain text body',
      html: '<p>HTML body</p>',
      calendar: { method: 'REQUEST', content },
    }),
  );
  const raw = (info.message as Buffer).toString('utf8');
  assert.match(raw, /^Message-ID: <automation\.job-1@example\.test>$/m);
  assert.match(raw, /^Auto-Submitted: auto-generated$/m);
  assert.match(raw, /multipart\/alternative/);
  assert.match(raw, /text\/plain/);
  assert.match(raw, /text\/html/);
  assert.match(raw, /text\/calendar;[^\r\n]*method=REQUEST/i);
  assert.match(raw, /invite\.ics/);
  transport.close();
});
