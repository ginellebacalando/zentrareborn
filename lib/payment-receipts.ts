import 'server-only';

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Prisma } from '@prisma/client';
import {
  PDFDocument,
  StandardFonts,
  degrees,
  rgb,
  type PDFFont,
  type PDFPage,
  type RGB,
} from 'pdf-lib';
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

/**
 * The ZENTRA wordmark exactly as the website shows it (Cinzel Decorative, open font licence, in
 * ZENTRA green), as an image because the standard PDF fonts cannot draw it. next.config.ts bundles
 * the file into the receipt routes.
 */
const RECEIPT_LOGO_PATH = path.join(
  process.cwd(),
  'public',
  'images',
  'brand',
  'zentra-wordmark.png',
);
let receiptLogo: Promise<Uint8Array | null> | undefined;

/** The wordmark's bytes, read once; without the file the receipt writes the name instead. */
function loadReceiptLogo() {
  receiptLogo ??= readFile(RECEIPT_LOGO_PATH).then(
    (bytes) => new Uint8Array(bytes),
    () => null,
  );
  return receiptLogo;
}

type TextOptions = {
  size?: number;
  font?: PDFFont;
  tint?: RGB;
  align?: 'left' | 'right';
  /** Extra space between letters, for small capital labels. */
  tracking?: number;
};

/**
 * Draws the one-page receipt (A4) in the ZENTRA palette from lib/automation/email-theme.ts: the
 * venue logo and the receipt number, who paid and how much, the payment details, what the booking
 * stands at after it, and the note that it is not an official receipt.
 */
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
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const palette = {
    brand: color(EMAIL_THEME.brand),
    brandSoft: color(EMAIL_THEME.brandSoft),
    surface: color(EMAIL_THEME.surface),
    ink: color(EMAIL_THEME.text),
    muted: color(EMAIL_THEME.muted),
    line: color(EMAIL_THEME.line),
    danger: color(EMAIL_THEME.danger),
    dangerSoft: color(EMAIL_THEME.dangerSoft),
  };
  const { width: pageWidth, height: pageHeight } = page.getSize();
  const margin = 48;
  const left = margin;
  const right = pageWidth - margin;
  const contentWidth = right - left;
  // Positions below are distances from the top of the page, so the layout reads top to bottom.
  const fromTop = (distance: number) => pageHeight - distance;

  const measure = (value: string, font: PDFFont, size: number, tracking = 0) =>
    font.widthOfTextAtSize(value, size) + tracking * Math.max(0, value.length - 1);
  const write = (value: string, x: number, top: number, options: TextOptions = {}) => {
    const { size = 10, font = regular, tint = palette.ink, align = 'left', tracking = 0 } = options;
    const shown = printable(font, value);
    let at = align === 'right' ? x - measure(shown, font, size, tracking) : x;
    if (!tracking) {
      page.drawText(shown, { x: at, y: fromTop(top), size, font, color: tint });
      return;
    }
    for (const character of shown) {
      page.drawText(character, { x: at, y: fromTop(top), size, font, color: tint });
      at += font.widthOfTextAtSize(character, size) + tracking;
    }
  };
  const label = (value: string, x: number, top: number, align: 'left' | 'right' = 'left') =>
    write(value.toUpperCase(), x, top, {
      size: 7.5,
      font: bold,
      tint: palette.muted,
      align,
      tracking: 1,
    });
  const rule = (top: number, tint: RGB = palette.line, thickness = 0.75) =>
    page.drawLine({
      start: { x: left, y: fromTop(top) },
      end: { x: right, y: fromTop(top) },
      thickness,
      color: tint,
    });
  /** A filled panel with rounded corners; `top` is the distance of its upper edge from the top. */
  const panel = (x: number, top: number, width: number, height: number, fill: RGB, radius = 8) => {
    const r = Math.min(radius, height / 2, width / 2);
    page.drawSvgPath(
      `M ${r} 0 H ${width - r} A ${r} ${r} 0 0 1 ${width} ${r} V ${height - r} A ${r} ${r} 0 0 1 ${width - r} ${height} H ${r} A ${r} ${r} 0 0 1 0 ${height - r} V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`,
      { x, y: fromTop(top), color: fill },
    );
  };

  const balanceCents = Math.max(0, receipt.contractCents - receipt.receivedSoFarCents);
  const status = receipt.voided
    ? { text: 'VOIDED', fill: palette.dangerSoft, tint: palette.danger }
    : balanceCents === 0
      ? { text: 'PAID IN FULL', fill: palette.brandSoft, tint: palette.brand }
      : { text: 'PARTIAL PAYMENT', fill: palette.surface, tint: palette.ink };

  // A voided receipt stays readable for the record but cannot pass for a live one.
  if (receipt.voided)
    page.drawText('VOIDED', {
      x: 118,
      y: 250,
      size: 120,
      font: bold,
      color: palette.danger,
      opacity: 0.07,
      rotate: degrees(32),
    });

  // The brand band and the header: the venue on the left, the document on the right.
  page.drawRectangle({
    x: 0,
    y: pageHeight - 6,
    width: pageWidth,
    height: 6,
    color: palette.brand,
  });
  const headerTop = 46;
  // The website's wordmark with the venue's name under it, as in the site footer.
  const logoBytes = await loadReceiptLogo();
  let logoHeight = 30;
  if (logoBytes) {
    const logo = await pdf.embedPng(logoBytes);
    const size = logo.scaleToFit(160, 38);
    logoHeight = size.height;
    page.drawImage(logo, {
      x: left,
      y: fromTop(headerTop + size.height),
      width: size.width,
      height: size.height,
    });
  } else
    write(EMAIL_THEME.wordmark, left, headerTop + 26, {
      size: 26,
      font: bold,
      tint: palette.brand,
      tracking: 1,
    });
  write(BRAND.nameUpper, left + 1, headerTop + logoHeight + 15, {
    size: 7.5,
    font: bold,
    tint: palette.muted,
    tracking: 2.2,
  });
  label('Acknowledgment receipt', right, headerTop + 8, 'right');
  write(receipt.acknowledgmentNumber, right, headerTop + 31, {
    size: 18,
    font: bold,
    align: 'right',
  });
  write(`Issued ${manilaDate.format(receipt.issuedAt)}`, right, headerTop + 47, {
    size: 9,
    tint: palette.muted,
    align: 'right',
  });
  const pillWidth = measure(status.text, bold, 7.5, 1) + 20;
  panel(right - pillWidth, headerTop + 57, pillWidth, 19, status.fill, 9.5);
  write(status.text, right - 10, headerTop + 70, {
    size: 7.5,
    font: bold,
    tint: status.tint,
    align: 'right',
    tracking: 1,
  });
  let top = headerTop + logoHeight + 34;
  for (const line of [
    ...BRAND.address.lines,
    `${BRAND.contact.phone}  ·  ${BRAND.contact.email}`,
  ]) {
    write(line, left, top, { size: 8.5, tint: palette.muted });
    top += 12;
  }
  top += 10;
  rule(top);

  // Who paid and how much: the two facts a client looks for first.
  top += 32;
  label('Received with thanks from', left, top);
  label('Amount received', right, top, 'right');
  const nameLines = wrap(bold, receipt.clientName, 18, contentWidth - 230);
  nameLines.forEach((line, index) =>
    write(line, left, top + 24 + index * 22, { size: 18, font: bold }),
  );
  write(money(receipt.amountCents), right, top + 30, {
    size: 26,
    font: bold,
    tint: palette.brand,
    align: 'right',
  });
  top += Math.max(42, 24 + nameLines.length * 22) + 16;

  // How the money arrived, in one light panel.
  const details: [string, string][] = [
    ['Date received', manilaDateTime.format(receipt.receivedAt)],
    ['Payment method', receipt.method],
    ['Reference no.', receipt.referenceNumber],
    [
      receipt.method === PAYMENT_METHOD_LABELS.CASH ? 'Received by' : 'Verified by',
      receipt.recordedBy,
    ],
  ];
  const inset = 16;
  const columnWidth = (contentWidth - inset * 2) / details.length;
  const detailLines = details.map(([, value]) =>
    wrap(regular, value, 10, columnWidth - 12).slice(0, 2),
  );
  const panelHeight = 44 + Math.max(...detailLines.map((lines) => lines.length)) * 13;
  panel(left, top, contentWidth, panelHeight, palette.surface);
  details.forEach(([name], index) => {
    const x = left + inset + index * columnWidth;
    label(name, x, top + 22);
    detailLines[index].forEach((line, lineIndex) =>
      write(line, x, top + 38 + lineIndex * 13, { size: 10 }),
    );
  });
  top += panelHeight + 34;

  // The payment as an invoice line.
  label('Description', left, top);
  label('Amount', right, top, 'right');
  rule(top + 9, palette.ink, 1);
  top += 31;
  write(receipt.purpose, left, top, { size: 11.5, font: bold });
  write(money(receipt.amountCents), right, top, { size: 11.5, font: bold, align: 'right' });
  for (const line of [
    `Booking ${receipt.bookingReference}`,
    ...wrap(regular, receipt.event, 9.5, contentWidth - 160),
    `Event date: ${manilaDate.format(receipt.eventDate)}`,
  ]) {
    top += 15;
    write(line, left, top, { size: 9.5, tint: palette.muted });
  }
  top += 16;
  rule(top);

  // Where the booking stands after this payment.
  const summaryLeft = right - 250;
  top += 26;
  for (const [name, value] of [
    ['Contract price', money(receipt.contractCents)],
    ['Received to date', money(receipt.receivedSoFarCents)],
  ]) {
    write(name, summaryLeft, top, { size: 9.5, tint: palette.muted });
    write(value, right, top, { size: 9.5, align: 'right' });
    top += 18;
  }
  page.drawLine({
    start: { x: summaryLeft, y: fromTop(top - 6) },
    end: { x: right, y: fromTop(top - 6) },
    thickness: 0.75,
    color: palette.line,
  });
  top += 12;
  write('Remaining balance', summaryLeft, top, { size: 11, font: bold });
  write(money(balanceCents), right, top, {
    size: 11,
    font: bold,
    tint: balanceCents ? palette.brand : palette.ink,
    align: 'right',
  });

  if (receipt.voided) {
    top += 30;
    const lines = wrap(
      regular,
      `This payment was voided on ${manilaDateTime.format(receipt.voided.at)}: ${receipt.voided.reason}`,
      9.5,
      contentWidth - inset * 2,
    );
    panel(left, top, contentWidth, 22 + lines.length * 13, palette.dangerSoft);
    lines.forEach((line, index) =>
      write(line, left + inset, top + 18 + index * 13, { size: 9.5, tint: palette.danger }),
    );
  }

  // The note every acknowledgment receipt carries, and the venue's details.
  const footerTop = pageHeight - 124;
  panel(left, footerTop, contentWidth, 50, palette.brandSoft);
  write(
    'This is an acknowledgment of payment and not an official receipt.',
    left + inset,
    footerTop + 21,
    { size: 9.5, font: bold, tint: palette.brand },
  );
  write(
    `Please keep it with your booking reference ${receipt.bookingReference}.`,
    left + inset,
    footerTop + 36,
    { size: 8.5, tint: palette.muted },
  );
  rule(pageHeight - 54);
  write(
    `${BRAND.legalName}  ·  ${BRAND.contact.phone}  ·  ${BRAND.contact.email}`,
    left,
    pageHeight - 38,
    { size: 8, tint: palette.muted },
  );
  write('Thank you for celebrating with us.', right, pageHeight - 38, {
    size: 8,
    font: italic,
    tint: palette.muted,
    align: 'right',
  });
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
