import 'server-only';
import { createHash } from 'node:crypto';
import { InquiryPriority, NotificationPriority, NotificationType, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { enqueueInquiryReceived, inquiryNotificationSelect } from '@/lib/automation/inquiries';
import { scheduleAutomationDelivery } from '@/lib/automation/trigger';
import { ConversationError } from '@/lib/chatbot/session-security';
import type { ReceptionistConversation } from '@/lib/chatbot/conversation';
import type { PublicSystemSettings } from '@/lib/system-settings-types';

/** Inquiries Zeni creates carry this source so staff and the Zeni admin page can count them. */
export const ZENI_INQUIRY_SOURCE = 'zeni_receptionist';

/** Stable, server-derived UUIDv5 shape: a browser turn ID cannot choose another conversation. */
export function escalationRequestId(conversationId: string, turnId: string) {
  const bytes = createHash('sha1')
    .update(Buffer.from(conversationId.replaceAll('-', ''), 'hex'))
    .update(turnId)
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** A committed inquiry is staff intake, never a booking, a reschedule or a delivered email. */
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
    `Zeni inquiry: ${state.flags.reason.replaceAll('_', ' ') || 'visitor request'}.`,
    `Conversation: ${state.id}.`,
    state.needs.goal,
    state.lastKnowledgeQuestion && `Last information question: ${state.lastKnowledgeQuestion}`,
    state.booking.eventType && `Event: ${state.booking.eventType}.`,
    state.booking.packageName && `Package discussed: ${state.booking.packageName}.`,
    state.booking.dates.length && `Preferred dates: ${state.booking.dates.join(', ')}.`,
    state.booking.venue && `Preferred venue: ${state.booking.venue}.`,
    state.booking.timePreference && `Preferred time: ${state.booking.timePreference}.`,
    state.booking.reference &&
      `Booking reference given by the visitor, for staff verification: ${state.booking.reference}.`,
    ['available', 'unavailable'].includes(state.booking.status) &&
      state.booking.resultObservedAt &&
      `Last calendar check (${state.booking.resultObservedAt}): ${state.booking.status === 'available' ? 'no confirmed event' : 'a confirmed event exists'}. This is not a hold.`,
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
    const notificationIds = await prisma.$transaction(async (tx) => {
      const created = await tx.inquiry.create({
        select: inquiryNotificationSelect,
        data: {
          id,
          inquiryReference: reference,
          fullName: state.client.name,
          email: state.client.email,
          phoneNumber: state.client.phone || null,
          message: summary,
          eventInterest: state.booking.eventType || null,
          packageInterest: state.booking.packageName || null,
          sourcePage: ZENI_INQUIRY_SOURCE,
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
          source: ZENI_INQUIRY_SOURCE,
        },
      });
      // The staff alert and the visitor's acknowledgement commit with the inquiry (outbox).
      return enqueueInquiryReceived(tx, created);
    });
    scheduleAutomationDelivery(notificationIds);
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
