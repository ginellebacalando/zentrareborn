import 'server-only';

import { randomUUID } from 'node:crypto';
import {
  AuditAction,
  AuditStatus,
  InquiryPriority,
  NotificationPriority,
  NotificationType,
  Prisma,
} from '@prisma/client';

import { createAuditLog, errorMetadata, getRequestContext } from '@/lib/audit';
import { enqueueInquiryReceived } from '@/lib/automation/inquiries';
import { prisma } from '@/lib/prisma';

const URGENT_PATTERN = /\b(asap|urgent|today|immediately|right away)\b/i;

export class InquiryError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = 'InquiryError';
  }
}

function requiredText(value: unknown, label: string, maxLength = 255) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new InquiryError(`${label} is required.`);
  }

  return value.trim().slice(0, maxLength);
}

function optionalText(value: unknown, maxLength = 255) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, maxLength) : null;
}

function inquiryReference() {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  return `INQ-${date}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function publicPriority(message: string) {
  return URGENT_PATTERN.test(message) ? InquiryPriority.HIGH : InquiryPriority.NORMAL;
}

async function recordSubmissionActivity(
  db: Prisma.TransactionClient,
  input: {
    inquiryId: string;
    reference: string;
    sourcePage: string;
    performedBy: string;
  },
) {
  return db.inquiryActivity.create({
    data: {
      inquiryId: input.inquiryId,
      action: 'submitted',
      description: `Inquiry ${input.reference} was submitted from ${input.sourcePage}.`,
      performedBy: input.performedBy,
    },
  });
}

export async function submitInquiry(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const sourcePage = optionalText(body.sourcePage, 80) ?? 'contact_us';
  const fullName = requiredText(body.fullName ?? body.name, 'Full name', 180);
  const phoneNumber = requiredText(body.phoneNumber ?? body.phone, 'Phone number', 40);
  const email = requiredText(body.email, 'Email', 255).toLowerCase();
  const message = requiredText(body.message, 'Message', 3000);
  const eventInterest = optionalText(body.eventInterest ?? body.subject, 180);
  const packageInterest = optionalText(body.packageInterest, 255);
  const preferredContactTime = optionalText(body.preferredContactTime, 100);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new InquiryError('Please enter a valid email address.');
  }

  if (message.length < 10) {
    throw new InquiryError('Please write your message before submitting.');
  }

  const reference = inquiryReference();
  const priority = publicPriority(message);
  const { inquiry, notificationIds } = await prisma.$transaction(
    async (transaction) => {
      const created = await transaction.inquiry.create({
        data: {
          inquiryReference: reference,
          fullName,
          phoneNumber,
          email,
          preferredContactTime,
          message,
          eventInterest,
          packageInterest,
          sourcePage,
          priority,
        },
      });

      await recordSubmissionActivity(transaction, {
        inquiryId: created.id,
        reference,
        sourcePage,
        performedBy: fullName,
      });

      await transaction.notification.create({
        data: {
          title: 'New inquiry submitted',
          message: `New inquiry submitted by ${fullName}.`,
          type: NotificationType.INQUIRY,
          priority: NotificationPriority.MEDIUM,
          relatedModule: 'inquiries',
          relatedRecordId: created.id,
          source: sourcePage,
        },
      });

      // Outbox rows commit atomically with the inquiry: no inquiry without its notifications.
      const notificationIds = await enqueueInquiryReceived(transaction, created);

      return { inquiry: created, notificationIds };
    },
    { maxWait: 10_000, timeout: 15_000 },
  );

  await createAuditLog({
    userId: null,
    userName: fullName,
    userRole: 'PUBLIC',
    action: AuditAction.SUBMISSION,
    module: 'Inquiries',
    description: `${fullName} submitted inquiry ${reference}.`,
    status: AuditStatus.SUCCESS,
    ...getRequestContext(request),
    newValues: {
      inquiryReference: reference,
      email,
      phoneNumber,
      preferredContactTime,
      eventInterest,
      packageInterest,
      priority,
      sourcePage,
    },
  });

  return {
    id: inquiry.id,
    inquiryReference: reference,
    message: 'Your inquiry has been submitted successfully. Our team will contact you soon.',
    notificationIds,
  };
}

export function inquiryErrorResponse(error: unknown, fallback = 'Unable to process inquiry.') {
  if (error instanceof InquiryError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  if (error instanceof SyntaxError) {
    return Response.json({ error: 'The request body is invalid.' }, { status: 400 });
  }

  console.error(fallback, errorMetadata(error));
  return Response.json({ error: fallback }, { status: 500 });
}
