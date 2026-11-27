import 'server-only';
import type { Prisma } from '@prisma/client';
import { balanceDueDate } from './booking-rules';
import {
  CONTRACT_FORMAT,
  type ContractInclusion,
  type ContractSnapshot,
} from './contract-document';
import { defaultTerms } from './default-terms';
import { readBookingRules, readContractSignatory } from './preferences';

type Tx = Prisma.TransactionClient;

/** The booking fields the contract shows, with its payments (voided ones are left out). */
export type ContractBooking = {
  reference: string;
  clientName: string;
  email: string;
  phone: string;
  eventType: string;
  packageName: string;
  venue: string;
  startsAt: Date;
  endsAt: Date;
  guests: number;
  totalCents: number;
  depositCents: number;
  payments: {
    receiptNumber: string;
    acknowledgmentNumber: string | null;
    amountCents: number;
    receivedAt: Date;
    method: string;
    voidedAt: Date | null;
  }[];
};

const pesosToCents = (pesos: number) => (pesos > 0 ? Math.round(pesos * 100) : null);
const timeText = (value: string | null) => value?.trim() || null;

/**
 * The booklet's parts of a package ("Venue", "Catering" …) with their points, which the catalog
 * keeps as one description joined by "; ". A package edited by hand may only have the contract
 * inclusion text from the catalog editor; that becomes one list.
 */
function inclusionsOf(found: {
  inclusions: { inclusionName: string; description: string | null }[];
  contractInclusionDescription: string | null;
}): ContractInclusion[] {
  if (found.inclusions.length)
    return found.inclusions.map((inclusion) => ({
      title: inclusion.inclusionName,
      items: (inclusion.description ?? '')
        .split(/;\s+/)
        .map((item) => item.trim())
        .filter(Boolean),
    }));
  const text = found.contractInclusionDescription?.trim();
  return text
    ? [
        {
          title: 'Inclusions',
          items: text
            .split(/\s*[|\n]\s*/)
            .map((item) => item.trim())
            .filter(Boolean),
        },
      ]
    : [];
}

/**
 * Everything the printed contract shows, read in the transaction that saves it: the booking, the
 * package's inclusions, guest terms and times from the catalog (matched by the package name the
 * booking was made with), the payments received so far, when the balance is due, the venue
 * policy's terms and who signs for Zion. Queries run one after another, as a transaction allows.
 */
export async function contractSnapshot(
  tx: Tx,
  booking: ContractBooking,
  policy: { version: number; contractTerms: string },
  version: number,
  preparedAt: Date,
): Promise<ContractSnapshot> {
  const candidates = await tx.package.findMany({
    where: { packageName: booking.packageName },
    orderBy: { updatedAt: 'desc' },
    take: 5,
    select: {
      status: true,
      paxIncluded: true,
      excessPaxFee: true,
      checkInTime: true,
      checkOutTime: true,
      contractInclusionDescription: true,
      inclusions: {
        orderBy: { displayOrder: 'asc' },
        select: { inclusionName: true, description: true },
      },
    },
  });
  // The published package first; an archived one still describes what an older booking bought.
  const found = candidates.find((item) => item.status === 'ACTIVE') ?? candidates[0] ?? null;
  const rules = await readBookingRules(tx);
  const signatory = await readContractSignatory(tx);
  return {
    format: CONTRACT_FORMAT,
    reference: booking.reference,
    version,
    preparedAt: preparedAt.toISOString(),
    client: { name: booking.clientName, email: booking.email, phone: booking.phone },
    event: {
      type: booking.eventType,
      venue: booking.venue,
      startsAt: booking.startsAt.toISOString(),
      endsAt: booking.endsAt.toISOString(),
      guests: booking.guests,
    },
    package: {
      name: booking.packageName,
      inclusions: found ? inclusionsOf(found) : [],
      paxIncluded: found && found.paxIncluded > 0 ? found.paxIncluded : null,
      excessPaxFeeCents: found ? pesosToCents(found.excessPaxFee) : null,
      checkIn: found ? timeText(found.checkInTime) : null,
      checkOut: found ? timeText(found.checkOutTime) : null,
    },
    amounts: {
      totalCents: booking.totalCents,
      reservationFeeCents: booking.depositCents,
      balanceDueAt: balanceDueDate(booking.startsAt, rules.balanceDueDays).toISOString(),
    },
    payments: booking.payments
      .filter((payment) => !payment.voidedAt)
      .sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime())
      .map((payment) => ({
        acknowledgmentNumber: payment.acknowledgmentNumber,
        receiptNumber: payment.receiptNumber,
        receivedAt: payment.receivedAt.toISOString(),
        method: payment.method,
        amountCents: payment.amountCents,
      })),
    // A policy saved without terms still gives the client Zion's published ones.
    terms: { policyVersion: policy.version, text: policy.contractTerms.trim() || defaultTerms },
    signatory,
  };
}
