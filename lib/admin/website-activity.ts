import 'server-only';
import { InquiryStatus, TestimonyStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { WEBSITE_BOOKING_ACTOR } from '@/config/booking';
import {
  WEBSITE_ACTIVITY_LIMIT,
  bookingActivity,
  inquiryActivity,
  mergeWebsiteActivity,
  testimonyActivity,
  zeniQuestionActivities,
  type WebsiteActivityFeed,
} from './website-activity-feed';

type ZeniQuestionRow = { id: string; question: string; question_hash: string; created_utc: Date };

/**
 * Open questions Zeni could not answer, newest first. The log lives in the optional receptionist
 * schema (prisma/receptionist.sql); a database without it simply has no questions to show. Extra
 * rows are read so that repeated wordings, collapsed to one item, do not hide other questions.
 */
async function openZeniQuestions(limit: number) {
  const [log] = await prisma.$queryRaw<{ installed: boolean }[]>`
    SELECT to_regclass('zion_zeni_gaps') IS NOT NULL AS installed`;
  if (!log?.installed) return { available: false, rows: [] };
  // The Prisma pg adapter replaces a timestamptz offset with +00:00 instead of converting it, so a
  // database session outside UTC would shift these times; a UTC timestamp is read correctly.
  // Ordering stays on the indexed created_at column. Resolved questions are handled and leave.
  const rows = await prisma.$queryRaw<ZeniQuestionRow[]>`
    SELECT id::text AS id, question, question_hash, created_at AT TIME ZONE 'UTC' AS created_utc
    FROM zion_zeni_gaps
    WHERE resolved_at IS NULL
    ORDER BY created_at DESC
    LIMIT ${limit * 4}`;
  return { available: true, rows };
}

/**
 * The dashboard's "Website activity" panel: the latest booking requests sent from the public booking
 * page, contact-form and Zeni inquiries, testimonies waiting for moderation and unanswered Zeni
 * questions. Read-only and bounded: every source reads at most a few rows, newest first, and
 * selects only the fields the panel shows (see the privacy contract in ./website-activity-feed).
 */
export async function readWebsiteActivity(now = new Date()): Promise<WebsiteActivityFeed> {
  const take = WEBSITE_ACTIVITY_LIMIT;
  const [bookings, inquiries, testimonies, zeni] = await Promise.all([
    // No index covers createdBy yet: this is a bounded top-N read of the small bookings table. An
    // additive (createdBy, createdAt) index belongs in prisma/admin.sql if the table grows.
    prisma.adminBooking.findMany({
      where: { createdBy: WEBSITE_BOOKING_ACTOR },
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        clientName: true,
        eventType: true,
        startsAt: true,
        approval: true,
        reservation: true,
        createdAt: true,
      },
    }),
    // Staff-marked spam is not visitor activity worth surfacing.
    prisma.inquiry.findMany({
      where: { status: { not: InquiryStatus.SPAM } },
      orderBy: { submittedAt: 'desc' },
      take,
      select: {
        id: true,
        fullName: true,
        eventInterest: true,
        sourcePage: true,
        status: true,
        submittedAt: true,
      },
    }),
    // The same queue as the dashboard's Testimonies hold card.
    prisma.testimony.findMany({
      where: {
        status: { in: [TestimonyStatus.FLAGGED, TestimonyStatus.PENDING_REVIEW] },
        deletedAt: null,
      },
      orderBy: { submittedAt: 'desc' },
      take,
      select: {
        id: true,
        clientName: true,
        nickname: true,
        eventType: true,
        status: true,
        submittedAt: true,
      },
    }),
    openZeniQuestions(take),
  ]);
  return {
    generatedAt: now.toISOString(),
    zeniQuestionsAvailable: zeni.available,
    items: mergeWebsiteActivity(
      [
        ...bookings.map(bookingActivity),
        ...inquiries.map(inquiryActivity),
        ...testimonies.map(testimonyActivity),
        ...zeniQuestionActivities(
          zeni.rows.map((row) => ({
            id: row.id,
            question: row.question,
            questionHash: row.question_hash,
            createdAt: row.created_utc,
          })),
        ),
      ],
      take,
    ),
  };
}
