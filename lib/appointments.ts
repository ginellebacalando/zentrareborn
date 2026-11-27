/**
 * What a visit is for (docs/visits.md, "Appointments"). Visitors schedule ocular visits on the
 * website; staff also schedule planning meetings, contract signings and other meetings from the
 * Calendar or the Front desk. They share the visit's times, emails, calendar invitations and
 * reminders; only the wording and the place differ. Browser-safe: the admin and the public pages
 * use the same labels.
 */

export const APPOINTMENT_PURPOSES = ['OCULAR', 'PLANNING', 'CONTRACT', 'MEETING'] as const;
export type AppointmentPurpose = (typeof APPOINTMENT_PURPOSES)[number];

export const APPOINTMENT_LABELS: Record<AppointmentPurpose, string> = {
  OCULAR: 'Ocular visit',
  PLANNING: 'Planning meeting',
  CONTRACT: 'Contract signing',
  MEETING: 'Other meeting',
};

/** What the client is told the appointment is for; nothing for a meeting staff name themselves. */
export const APPOINTMENT_PURPOSE_TEXT: Record<AppointmentPurpose, string> = {
  OCULAR: 'A member of our team will meet you at the venue and show you around.',
  PLANNING: 'We will go through your event plans and the details of your package together.',
  CONTRACT: 'We will go through your contract together, and you sign it with us.',
  MEETING: '',
};

export const APPOINTMENT_FIELD_LIMITS = { title: 120, place: 200 } as const;

export function appointmentPurpose(value: string | null | undefined): AppointmentPurpose {
  return APPOINTMENT_PURPOSES.includes(value as AppointmentPurpose)
    ? (value as AppointmentPurpose)
    : 'OCULAR';
}

type Appointment = { purpose: string; title: string };

/** "Ocular visit", "Contract signing", or the title staff gave another meeting. */
export function appointmentLabel(appointment: Appointment) {
  const purpose = appointmentPurpose(appointment.purpose);
  const title = appointment.title.trim();
  return purpose === 'MEETING' ? title || 'Meeting' : APPOINTMENT_LABELS[purpose];
}

/** The label inside a sentence: "ocular visit", "planning meeting", a meeting's own title. */
export function appointmentNoun(appointment: Appointment) {
  const purpose = appointmentPurpose(appointment.purpose);
  return purpose === 'MEETING'
    ? appointment.title.trim() || 'meeting'
    : APPOINTMENT_LABELS[purpose].toLowerCase();
}

/** "an ocular visit", "a planning meeting". */
export function withArticle(noun: string) {
  return `${/^[aeiou]/i.test(noun) ? 'an' : 'a'} ${noun}`;
}

/** Where it happens: the place staff typed (an address or an online link), else the venue. */
export function appointmentPlace(appointment: { place: string }, venue: string) {
  return appointment.place.trim() || venue;
}
