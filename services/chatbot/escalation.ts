import 'server-only';
import { InquiryPriority, NotificationPriority, NotificationType, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { ConversationError } from '@/lib/chatbot/session-security';
import type { ReceptionistConversation } from '@/lib/chatbot/conversation';
import type { PublicSystemSettings } from '@/lib/system-settings-types';

/** A committed inquiry is staff intake, never a booking or a delivered email. */
export async function submitReceptionistEscalation(
  state: ReceptionistConversation,
  requestId: string,
  settings: PublicSystemSettings,
) {
  if (settings.client.maintenanceMode || !settings.client.inquirySubmissionsEnabled)
    throw new ConversationError(
      'The staff inquiry inbox is temporarily paused. Please contact the Zion team directly.',
    );
  if (!state.client.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.client.email))
    throw new ConversationError(
      'Please provide a name and valid email before sending an inquiry.',
      422,
    );
  const id = `zeni-${requestId}`;
  const existing = await prisma.inquiry.findUnique({
    where: { id },
    select: { inquiryReference: true },
  });
  if (existing) return existing.inquiryReference;
  const reference = `ZENI-${requestId.toUpperCase()}`;
  const summary = [
    `Receptionist inquiry: ${state.flags.reason.replaceAll('_', ' ') || 'visitor request'}.`,
    `Conversation: ${state.id}.`,
    state.needs.goal,
    state.lastKnowledgeQuestion && `Last information question: ${state.lastKnowledgeQuestion}`,
    state.booking.eventType && `Event: ${state.booking.eventType}.`,
    state.booking.packageName && `Package discussed: ${state.booking.packageName}.`,
    state.booking.dates.length && `Preferred dates: ${state.booking.dates.join(', ')}.`,
    state.booking.venue && `Preferred venue: ${state.booking.venue}.`,
    state.booking.timePreference && `Preferred time: ${state.booking.timePreference}.`,
    (state.booking.reference || state.booking.bookingReference) &&
      `Booking reference for staff verification: ${state.booking.reference || state.booking.bookingReference}.`,
    state.booking.requestId &&
      `Operational request correlation: ${state.booking.requestId}; last saved status: ${state.booking.status}.`,
    state.booking.guests && `Planned guests: ${state.booking.guests}.`,
    state.objections.length && `Concerns raised: ${state.objections.join(', ')}.`,
    ...state.statementsShared
      .slice(-3)
      .map(
        (item) => `Published information already shared [${item.kbReference}]: ${item.statement}`,
      ),
    'Requested follow-up: staff should review the facts and contact the visitor through the supplied contact details; no response deadline has been promised.',
    'Visitor explicitly consented to sending this summary. No reservation or payment is confirmed by this inquiry.',
  ]
    .filter(Boolean)
    .join('\n')
    .slice(0, 3000);
  try {
    await prisma.$transaction(async (tx) => {
      await tx.inquiry.create({
        data: {
          id,
          inquiryReference: reference,
          fullName: state.client.name,
          email: state.client.email,
          phoneNumber: state.client.phone || null,
          message: summary,
          eventInterest: state.booking.eventType || null,
          packageInterest: state.booking.packageName || null,
          sourcePage: 'zeni_receptionist',
          priority: state.flags.complaint ? InquiryPriority.HIGH : InquiryPriority.NORMAL,
        },
      });
      await tx.inquiryActivity.create({
        data: {
          id: `zeni-activity-${requestId}`,
          inquiryId: id,
          action: 'submitted',
          description: `Inquiry ${reference} submitted through Zeni with visitor consent.`,
          performedBy: state.client.name,
        },
      });
      await tx.notification.create({
        data: {
          id: `zeni-notice-${requestId}`,
          title: 'New Zeni inquiry',
          message: 'A visitor asked the Zion team for assistance.',
          type: NotificationType.INQUIRY,
          priority: NotificationPriority.MEDIUM,
          relatedModule: 'inquiries',
          relatedRecordId: id,
          source: 'zeni_receptionist',
        },
      });
    });
    return reference;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const saved = await prisma.inquiry.findUnique({
        where: { id },
        select: { inquiryReference: true },
      });
      if (saved) return saved.inquiryReference;
    }
    throw error;
  }
}
