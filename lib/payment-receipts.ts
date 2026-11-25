import 'server-only';

import type { Prisma } from '@prisma/client';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { BRAND } from '@/config/brand';
import { PAYMENT_METHOD_LABELS } from '@/lib/admin/payment-accounts';
import { EMAIL_THEME } from '@/lib/automation/email-theme';
import { prisma } from '@/lib/prisma';

/**
 * Acknowledgment receipts (booking automation phase 3, docs/booking-automation.md): every recorded
 * payment, cash or a verified GCash or bank transfer, gets a number from a database counter and a
 * PDF that staff and the client can download. It acknowledges money received; it is not an
 * official receipt, which stays Zion's own tax document.
 */

const MANILA_OFFSET_MS = 8 * 60 * 60_000;

/** Issues the next number inside the transaction that records the payment: ACK-2026-000042. */
export async function nextAcknowledgmentNumber(db: Prisma.TransactionClient, receivedAt: Date) {
  const [row] = await db.$queryRaw<
    { value: bigint }[]
  >`SELECT nextval('zion_acknowledgment_number_seq') AS value`;
  const year = new Date(receivedAt.getTime() + MANILA_OFFSET_MS).getUTCFullYear();
  return `ACK-${year}-${String(row.value).padStart(6, '0')}`;
}

type ReceiptPayment = {
  id: string;
  amountCents: number;
  receivedAt: Date;
  createdAt: Date;
  voidedAt: Date | null;
};

/**
 * What the payment paid for, from the payments recorded before it: the reservation fee until the
 * fee is covered, then the balance. A booking without a fee rule pays toward the contract price.
 */
export function paymentPurpose(
  booking: { paymentRule: string; depositCents: number },
  payment: ReceiptPayment,
  payments: ReceiptPayment[],
) {
  const earlier = payments
    .filter((other) => other.id !== payment.id && !other.voidedAt)
    .filter(
      (other) =>
        other.receivedAt < payment.receivedAt ||
        (other.receivedAt.getTime() === payment.receivedAt.getTime() &&
          other.createdAt < payment.createdAt),
    )
    .reduce((sum, other) => sum + other.amountCents, 0);
  if (booking.paymentRule !== 'DEPOSIT_REQUIRED' || booking.depositCents < 1)
    return { label: 'Payment toward the contract price', paidBefore: earlier };
  if (earlier >= booking.depositCents) return { label: 'Balance', paidBefore: earlier };
  if (earlier + payment.amountCents <= booking.depositCents)
    return { label: 'Reservation fee', paidBefore: earlier };
  return { label: 'Reservation fee and balance', paidBefore: earlier };
}

const peso = new Intl.NumberFormat('en-PH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const manilaDateTime = new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila',
  dateStyle: 'medium',
  timeStyle: 'short',
});
const manilaDate = new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila',
  dateStyle: 'long',
});

/** "PHP 5,000.00": the standard PDF fonts have no peso sign. */
function money(cents: number) {
  return `PHP ${peso.format(cents / 100)}`;
}

function color(hex: string) {
  return rgb(
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
  );
}

/** Text the standard font can draw: one line, unsupported characters shown as "?". */
function printable(font: PDFFont, text: string) {
  const supported = new Set(font.getCharacterSet());
  return [...text.normalize('NFC').replace(/\s+/g, ' ').trim()]
    .map((character) => (supported.has(character.codePointAt(0) ?? 0) ? character : '?'))
    .join('');
}

/** Splits text into lines no wider than `width`, breaking between words. */
function wrap(font: PDFFont, text: string, size: number, width: number) {
  const lines: string[] = [];
  let line = '';
  for (const word of printable(font, text).split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(next, size) > width) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

export type ReceiptDocument = {
  acknowledgmentNumber: string;
  clientName: string;
  bookingReference: string;
  event: string;
  eventDate: Date;
  purpose: string;
  method: string;
  referenceNumber: string;
  amountCents: number;
  receivedAt: Date;
  recordedBy: string;
  contractCents: number;
  /** Everything received up to and including this payment. */
  receivedSoFarCents: number;
  voided: { at: Date; reason: string } | null;
  issuedAt: Date;
};

/** Draws the one-page receipt (A4) with the ZENTRA palette from lib/automation/email-theme.ts. */
export async function acknowledgmentReceiptPdf(receipt: ReceiptDocument) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Acknowledgment receipt ${receipt.acknowledgmentNumber}`);
  pdf.setAuthor(BRAND.legalName);
  pdf.setSubject(`Payment for booking ${receipt.bookingReference}`);
  pdf.setCreator(EMAIL_THEME.wordmark);
  pdf.setCreationDate(receipt.issuedAt);
  const page: PDFPage = pdf.addPage([595.28, 841.89]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = color(EMAIL_THEME.text);
  const muted = color(EMAIL_THEME.muted);
  const brand = color(EMAIL_THEME.brand);
  const line = color(EMAIL_THEME.line);
  const margin = 56;
  const right = page.getWidth() - margin;
  const width = right - margin;
  let y = page.getHeight() - margin;

  const text = (
    value: string,
    x: number,
    at: number,
    options: { size?: number; font?: PDFFont; tint?: typeof ink; align?: 'left' | 'right' } = {},
  ) => {
    const font = options.font ?? regular;
    const size = options.size ?? 10;
    const shown = printable(font, value);
    const left = options.align === 'right' ? x - font.widthOfTextAtSize(shown, size) : x;
    page.drawText(shown, { x: left, y: at, size, font, color: options.tint ?? ink });
  };
  const rule = (at: number, tint = line) =>
    page.drawLine({
      start: { x: margin, y: at },
      end: { x: right, y: at },
      thickness: 0.75,
      color: tint,
    });

  // Header: the venue on the left, the document and its number on the right.
  text(BRAND.nameUpper, margin, y - 4, { size: 16, font: bold, tint: brand });
  text('ACKNOWLEDGMENT RECEIPT', right, y - 2, { size: 10, font: bold, align: 'right' });
  text(`No. ${receipt.acknowledgmentNumber}`, right, y - 18, {
    size: 12,
    font: bold,
    tint: brand,
    align: 'right',
  });
  y -= 22;
  for (const addressLine of BRAND.address.lines) {
    text(addressLine, margin, y, { size: 9, tint: muted });
    y -= 12;
  }
  text(`${BRAND.contact.phone}  ·  ${BRAND.contact.email}`, margin, y, { size: 9, tint: muted });
  text(`Issued ${manilaDate.format(receipt.issuedAt)}`, right, y, {
    size: 9,
    tint: muted,
    align: 'right',
  });
  y -= 18;
  rule(y, brand);
  y -= 30;

  // Who paid and how much, the two facts a client looks for first.
  text('RECEIVED FROM', margin, y, { size: 8, font: bold, tint: muted });
  y -= 18;
  text(receipt.clientName, margin, y, { size: 15, font: bold });
  y -= 22;
  const panelHeight = 58;
  page.drawRectangle({
    x: margin,
    y: y - panelHeight,
    width,
    height: panelHeight,
    color: color(EMAIL_THEME.brandSoft),
  });
  text('AMOUNT RECEIVED', margin + 16, y - 20, { size: 8, font: bold, tint: muted });
  text(money(receipt.amountCents), margin + 16, y - 44, { size: 22, font: bold, tint: brand });
  text(receipt.purpose, right - 16, y - 40, { size: 11, font: bold, align: 'right' });
  y -= panelHeight + 30;

  // The details, label above value in two columns.
  const details: [string, string][] = [
    ['Booking reference', receipt.bookingReference],
    ['Event', receipt.event],
    ['Event date', manilaDate.format(receipt.eventDate)],
    ['Payment method', receipt.method],
    ['Reference or receipt number', receipt.referenceNumber],
    ['Received on', `${manilaDateTime.format(receipt.receivedAt)} (Manila time)`],
    [
      receipt.method === PAYMENT_METHOD_LABELS.CASH ? 'Received by' : 'Verified by',
      receipt.recordedBy,
    ],
  ];
  const column = width / 2;
  for (let index = 0; index < details.length; index += 2) {
    let rowHeight = 0;
    for (const [offset, detail] of details.slice(index, index + 2).entries()) {
      const x = margin + offset * column;
      text(detail[0].toUpperCase(), x, y, { size: 8, font: bold, tint: muted });
      const lines = wrap(regular, detail[1], 11, column - 16);
      lines.forEach((value, lineIndex) => text(value, x, y - 16 - lineIndex * 14, { size: 11 }));
      rowHeight = Math.max(rowHeight, 16 + lines.length * 14);
    }
    y -= rowHeight + 14;
  }
  rule(y + 4);
  y -= 22;

  // Where the booking stands after this payment.
  const balanceCents = Math.max(0, receipt.contractCents - receipt.receivedSoFarCents);
  const summary: [string, string][] = [
    ['Contract price', money(receipt.contractCents)],
    ['Received so far, including this payment', money(receipt.receivedSoFarCents)],
    ['Remaining balance', money(balanceCents)],
  ];
  for (const [label, value] of summary) {
    text(label, margin, y, { size: 10, tint: muted });
    text(value, right, y, { size: 10, font: bold, align: 'right' });
    y -= 18;
  }

  if (receipt.voided) {
    const danger = color(EMAIL_THEME.danger);
    y -= 16;
    text('VOIDED', margin, y, { size: 18, font: bold, tint: danger });
    y -= 18;
    const reason = `This payment was voided on ${manilaDateTime.format(receipt.voided.at)}: ${receipt.voided.reason}`;
    for (const value of wrap(regular, reason, 10, width)) {
      text(value, margin, y, { size: 10, tint: danger });
      y -= 14;
    }
  }

  // The footer every acknowledgment receipt carries.
  rule(margin + 40);
  text('This is an acknowledgment of payment and not an official receipt.', margin, margin + 22, {
    size: 9,
    font: bold,
  });
  text(
    `${BRAND.legalName} keeps this record with booking ${receipt.bookingReference}.`,
    margin,
    margin + 8,
    { size: 8, tint: muted },
  );
  return pdf.save();
}

const receiptPayment = {
  include: {
    booking: {
      include: {
        payments: {
          select: {
            id: true,
            amountCents: true,
            receivedAt: true,
            createdAt: true,
            voidedAt: true,
          },
        },
      },
    },
  },
} satisfies Prisma.AdminCashPaymentDefaultArgs;

/**
 * A payment's receipt, or null when it does not exist, belongs to another booking, or was voided
 * and the reader is the client (staff can still download it, marked voided).
 */
export async function acknowledgmentReceipt(
  paymentId: string,
  options: { bookingId?: string; includeVoided: boolean },
) {
  if (!/^[a-z0-9]{10,40}$/i.test(paymentId)) return null;
  const payment = await prisma.adminCashPayment.findUnique({
    where: { id: paymentId },
    ...receiptPayment,
  });
  if (!payment || !payment.acknowledgmentNumber) return null;
  if (options.bookingId && payment.bookingId !== options.bookingId) return null;
  if (payment.voidedAt && !options.includeVoided) return null;
  const { booking } = payment;
  const staff = await prisma.user.findUnique({
    where: { id: payment.recordedBy },
    select: { fullName: true, username: true },
  });
  const purpose = paymentPurpose(booking, payment, booking.payments);
  const bytes = await acknowledgmentReceiptPdf({
    acknowledgmentNumber: payment.acknowledgmentNumber,
    clientName: booking.clientName,
    bookingReference: booking.reference,
    event: `${booking.eventType} · ${booking.packageName}`,
    eventDate: booking.startsAt,
    purpose: purpose.label,
    method:
      PAYMENT_METHOD_LABELS[payment.method as keyof typeof PAYMENT_METHOD_LABELS] ?? payment.method,
    referenceNumber: payment.receiptNumber,
    amountCents: payment.amountCents,
    receivedAt: payment.receivedAt,
    recordedBy: staff?.fullName || staff?.username || `${BRAND.legalName} staff`,
    contractCents: booking.totalCents,
    receivedSoFarCents: purpose.paidBefore + (payment.voidedAt ? 0 : payment.amountCents),
    voided: payment.voidedAt
      ? { at: payment.voidedAt, reason: payment.voidReason ?? 'No reason recorded.' }
      : null,
    issuedAt: new Date(),
  });
  return { bytes, fileName: `${payment.acknowledgmentNumber.replace(/[^A-Za-z0-9-]/g, '')}.pdf` };
}

/** The download: private, never cached, and opened by the reader's own PDF viewer. */
export function receiptResponse(receipt: { bytes: Uint8Array; fileName: string }) {
  return new Response(Buffer.from(receipt.bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${receipt.fileName}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
