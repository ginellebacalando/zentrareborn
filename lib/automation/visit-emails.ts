import 'server-only';

import { BRAND } from '@/config/brand';
import {
  APPOINTMENT_PURPOSE_TEXT,
  appointmentLabel,
  appointmentNoun,
  appointmentPlace,
  appointmentPurpose,
  withArticle,
} from '@/lib/appointments';
import {
  greetingName,
  manilaDate,
  manilaTime,
  renderEmail,
  singleLine,
  VENUE_LOCATION,
  type EmailDetail,
  type RenderedEmail,
} from './templates';

/** The visit fields the emails show (docs/visits.md). */
export type VisitEmailSource = {
  reference: string;
  clientName: string;
  email: string;
  phone: string;
  startsAt: Date;
  endsAt: Date;
  source: string;
  eventType: string;
  eventDate: Date | null;
  guests: number | null;
  message: string;
  /** What it is for (lib/appointments.ts): an ocular visit, or a meeting staff scheduled. */
  purpose: string;
  title: string;
  place: string;
};

/** Who changed the visit: the visitor on the manage page, or staff at the front desk. */
export type VisitActor = 'VISITOR' | 'STAFF';

export type VisitEmailChange = 'SCHEDULED' | 'RESCHEDULED' | 'CANCELLED';

const SOURCE_LABELS: Record<string, string> = {
  WEBSITE: 'the visit page',
  ZENI: 'the visit page, opened from Zeni',
};

function visitTime(visit: Pick<VisitEmailSource, 'startsAt' | 'endsAt'>) {
  return `${manilaTime(visit.startsAt)} to ${manilaTime(visit.endsAt)} (Manila time)`;
}

function eventDay(value: Date | null) {
  return value
    ? new Intl.DateTimeFormat('en-PH', { timeZone: 'UTC', dateStyle: 'full' }).format(value)
    : '';
}

const isOcular = (visit: VisitEmailSource) => appointmentPurpose(visit.purpose) === 'OCULAR';

function visitorDetails(visit: VisitEmailSource): EmailDetail[] {
  if (isOcular(visit))
    return [
      ['Visit', visit.reference],
      ['Date', manilaDate(visit.startsAt)],
      ['Time', visitTime(visit)],
      ['Venue', VENUE_LOCATION],
      ['Directions', BRAND.maps.directionsUrl],
    ];
  const details: EmailDetail[] = [
    ['Meeting', appointmentLabel(visit)],
    ['Reference', visit.reference],
    ['Date', manilaDate(visit.startsAt)],
    ['Time', visitTime(visit)],
    ['Place', appointmentPlace(visit, VENUE_LOCATION)],
  ];
  // Directions help only when the meeting is at the venue.
  if (!visit.place.trim()) details.push(['Directions', BRAND.maps.directionsUrl]);
  return details;
}

function greeting(visit: VisitEmailSource) {
  const name = greetingName(visit.clientName);
  return name ? `Hello ${name},` : 'Hello,';
}

const CLIENT_COPY: Record<
  VisitEmailChange,
  { subject: string; heading: string; preheader: string; paragraphs: string[] }
> = {
  SCHEDULED: {
    subject: 'Ocular visit scheduled',
    heading: 'Your visit is scheduled',
    preheader: 'Your ocular visit at Zion Events Place is scheduled.',
    paragraphs: [
      `Thank you for scheduling an ocular visit at ${BRAND.legalName}. A member of our team will meet you at the venue and show you around.`,
      'A calendar invitation (invite.ics) is attached so you can add the visit to your calendar.',
    ],
  },
  RESCHEDULED: {
    subject: 'Ocular visit moved',
    heading: 'Your visit has a new time',
    preheader: 'Your ocular visit at Zion Events Place has a new time.',
    paragraphs: [
      'Your ocular visit now takes place at the time below.',
      'The attached calendar update (invite.ics) replaces the earlier time in your calendar.',
    ],
  },
  CANCELLED: {
    subject: 'Ocular visit cancelled',
    heading: 'Your visit is cancelled',
    preheader: 'Your ocular visit at Zion Events Place is cancelled.',
    paragraphs: [
      'The calendar update (cancel.ics) removes the visit from your calendar.',
      'You are welcome to schedule another visit at any time.',
    ],
  },
};

/** A meeting's emails: the same shape as a visit's, named for what it is. */
function meetingCopy(
  visit: VisitEmailSource,
  change: VisitEmailChange,
): { subject: string; heading: string; preheader: string; paragraphs: string[] } {
  const label = appointmentLabel(visit);
  const noun = appointmentNoun(visit);
  const purpose = APPOINTMENT_PURPOSE_TEXT[appointmentPurpose(visit.purpose)];
  if (change === 'SCHEDULED')
    return {
      subject: `${label} scheduled`,
      heading: `Your ${noun} is scheduled`,
      preheader: `Your ${noun} with ${BRAND.legalName} is scheduled.`,
      paragraphs: [
        `We scheduled ${withArticle(noun)} with you at ${appointmentPlace(visit, BRAND.legalName)}.`,
        ...(purpose ? [purpose] : []),
        `A calendar invitation (invite.ics) is attached so you can add the ${noun} to your calendar.`,
      ],
    };
  if (change === 'RESCHEDULED')
    return {
      subject: `${label} moved`,
      heading: `Your ${noun} has a new time`,
      preheader: `Your ${noun} with ${BRAND.legalName} has a new time.`,
      paragraphs: [
        `Your ${noun} now takes place at the time below.`,
        'The attached calendar update (invite.ics) replaces the earlier time in your calendar.',
      ],
    };
  return {
    subject: `${label} cancelled`,
    heading: `Your ${noun} is cancelled`,
    preheader: `Your ${noun} with ${BRAND.legalName} is cancelled.`,
    paragraphs: [`The calendar update (cancel.ics) removes the ${noun} from your calendar.`],
  };
}

/** The visitor's confirmation, new time or cancellation; the calendar file rides along. */
export function visitClientNotice(
  visit: VisitEmailSource,
  change: VisitEmailChange,
  by: VisitActor,
  links: { manage: string | null; schedule: string | null },
): RenderedEmail {
  const ocular = isOcular(visit);
  const copy = ocular ? CLIENT_COPY[change] : meetingCopy(visit, change);
  const noun = appointmentNoun(visit);
  const cancelled = change === 'CANCELLED';
  const opening = cancelled
    ? by === 'VISITOR'
      ? `As you asked, we cancelled your ${noun} on ${manilaDate(visit.startsAt)} at ${manilaTime(visit.startsAt)}.`
      : `Your ${noun} on ${manilaDate(visit.startsAt)} at ${manilaTime(visit.startsAt)} was cancelled. If you did not expect this, please contact us.`
    : '';
  // A cancelled meeting is arranged again with staff, so only a visit offers to book a new one.
  const action = cancelled
    ? ocular && links.schedule && { label: 'Schedule a new visit', href: links.schedule }
    : links.manage && { label: 'Reschedule or cancel', href: links.manage };
  return renderEmail({
    subject: `${BRAND.legalName} | ${copy.subject} | ${visit.reference}`,
    preheader: copy.preheader,
    heading: copy.heading,
    sections: [
      {
        paragraphs: [
          greeting(visit),
          ...(opening ? [opening] : []),
          ...copy.paragraphs,
          ...(!cancelled && links.manage
            ? ['Need a different time? Use the button below to reschedule or cancel.']
            : []),
          `Questions: ${BRAND.contact.phone} or ${BRAND.contact.email}.`,
        ],
        details: visitorDetails(visit),
      },
    ],
    action: action || undefined,
  });
}

/** A reminder the day before and on the morning of the visit or meeting. */
export function visitReminder(
  visit: VisitEmailSource,
  lead: 'day' | 'today',
  manageUrl: string | null,
): RenderedEmail {
  const when = lead === 'day' ? 'tomorrow' : 'today';
  const ocular = isOcular(visit);
  const noun = appointmentNoun(visit);
  const where = ocular ? `at ${BRAND.legalName}` : `with ${BRAND.legalName}`;
  return renderEmail({
    subject: `${BRAND.legalName} | ${ocular ? 'Visit' : appointmentLabel(visit)} reminder | ${visit.reference}`,
    preheader: `Your ${noun} ${where} is ${when} at ${manilaTime(visit.startsAt)}.`,
    heading: ocular
      ? lead === 'day'
        ? 'Your visit is tomorrow'
        : 'Your visit is today'
      : `Your ${noun} is ${when}`,
    sections: [
      {
        paragraphs: [
          greeting(visit),
          `This is a reminder of your ${noun} ${where} ${when} at ${manilaTime(visit.startsAt)}.`,
          manageUrl
            ? 'If the time no longer works for you, use the button below to reschedule or cancel.'
            : `If the time no longer works for you, please contact us at ${BRAND.contact.phone} or ${BRAND.contact.email}.`,
        ],
        details: visitorDetails(visit),
      },
    ],
    action: manageUrl ? { label: 'Reschedule or cancel', href: manageUrl } : undefined,
  });
}

const STAFF_COPY: Record<
  VisitEmailChange,
  { subject: string; heading: string; paragraph: string }
> = {
  SCHEDULED: {
    subject: 'Ocular visit',
    heading: 'Ocular visit added to your calendar',
    paragraph: 'The attached invitation (invite.ics) adds the visit to your calendar.',
  },
  RESCHEDULED: {
    subject: 'Visit moved',
    heading: 'Ocular visit moved',
    paragraph: 'The attached update (invite.ics) moves the visit in your calendar to the new time.',
  },
  CANCELLED: {
    subject: 'Visit cancelled',
    heading: 'Ocular visit cancelled',
    paragraph:
      'The calendar update (cancel.ics) removes the visit from calendars that received its invitation.',
  },
};

/** The staff copy of a visit's calendar event, with what the front desk needs to prepare. */
export function visitStaffNotice(
  visit: VisitEmailSource,
  change: VisitEmailChange,
  by: VisitActor,
  frontDeskUrl: string | null,
): RenderedEmail {
  const ocular = isOcular(visit);
  const label = appointmentLabel(visit);
  const noun = appointmentNoun(visit);
  const copy = ocular
    ? STAFF_COPY[change]
    : {
        SCHEDULED: { subject: label, heading: `${label} added to your calendar` },
        RESCHEDULED: { subject: `${label} moved`, heading: `${label} moved` },
        CANCELLED: { subject: `${label} cancelled`, heading: `${label} cancelled` },
      }[change];
  const paragraph = ocular
    ? STAFF_COPY[change].paragraph
    : STAFF_COPY[change].paragraph.replaceAll('visit', noun);
  const name = singleLine(visit.clientName, 80);
  const who =
    change === 'SCHEDULED'
      ? visit.source === 'STAFF'
        ? ocular
          ? `Staff scheduled an ocular visit for ${name} at the front desk.`
          : `Staff scheduled ${withArticle(noun)} with ${name}.`
        : `${name} scheduled an ocular visit on ${SOURCE_LABELS[visit.source] ?? 'the website'}.`
      : change === 'RESCHEDULED'
        ? `${by === 'VISITOR' ? `${name} moved` : 'Staff moved'} this ${noun} to a new time.`
        : `${by === 'VISITOR' ? `${name} cancelled` : 'Staff cancelled'} this ${noun}.`;
  return renderEmail({
    subject: `${copy.subject}: ${name}, ${manilaDate(visit.startsAt)} ${manilaTime(visit.startsAt)}`,
    preheader: `${visit.reference}: ${who}`,
    heading: copy.heading,
    sections: [
      {
        paragraphs: [
          who,
          paragraph,
          ...(visit.email
            ? [`Reply to this email to contact the ${ocular ? 'visitor' : 'client'}.`]
            : []),
        ],
        details: [
          [ocular ? 'Visit' : label, visit.reference],
          [ocular ? 'Visitor' : 'Client', singleLine(visit.clientName)],
          ...(ocular
            ? []
            : ([['Place', appointmentPlace(visit, VENUE_LOCATION)]] as EmailDetail[])),
          ['Email', visit.email],
          ['Phone', visit.phone],
          ['Date', manilaDate(visit.startsAt)],
          ['Time', visitTime(visit)],
          ['Event', singleLine(visit.eventType)],
          ['Event date', eventDay(visit.eventDate)],
          ['Guests', visit.guests ? String(visit.guests) : ''],
          ['Message', visit.message.trim().slice(0, 1000)],
        ],
      },
    ],
    action: frontDeskUrl ? { label: 'Open the front desk', href: frontDeskUrl } : undefined,
  });
}

/** What the visitor's and the staff calendars show: the same event, described for each. */
export function visitCalendarText(
  visit: VisitEmailSource,
  audience: 'client' | 'staff',
  status: string,
  manageUrl: string | null,
) {
  const ocular = isOcular(visit);
  const label = appointmentLabel(visit);
  if (audience === 'client')
    return {
      summary: ocular ? `Ocular visit at ${BRAND.legalName}` : `${label} with ${BRAND.legalName}`,
      description: [
        `${ocular ? 'Visit' : label} ${visit.reference}`,
        status,
        manageUrl ? `Reschedule or cancel: ${manageUrl}` : '',
        `Questions: ${BRAND.contact.phone} or ${BRAND.contact.email}`,
      ]
        .filter(Boolean)
        .join('\n'),
    };
  return {
    summary: `${label}: ${singleLine(visit.clientName, 80)} (${visit.reference})`,
    description: [
      `${ocular ? 'Visit' : label} ${visit.reference}`,
      `${ocular ? 'Visitor' : 'Client'}: ${singleLine(visit.clientName)}`,
      `Contact: ${[visit.email, visit.phone].filter(Boolean).join(', ')}`,
      visit.eventType ? `Event: ${singleLine(visit.eventType)}` : '',
      visit.eventDate ? `Event date: ${eventDay(visit.eventDate)}` : '',
      visit.guests ? `Guests: ${visit.guests}` : '',
      status,
    ]
      .filter(Boolean)
      .join('\n'),
  };
}
