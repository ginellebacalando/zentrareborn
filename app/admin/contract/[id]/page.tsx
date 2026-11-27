import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { bookingPagePath } from '@/components/admin/booking-links';
import { BRAND } from '@/config/brand';
import { currentAdmin } from '@/lib/admin/access';
import { readContractSnapshot } from '@/lib/admin/contract-document';
import { adminPageActor } from '@/lib/admin/page-access';
import { canOpenPage, isAdminPage } from '@/lib/admin/permissions';
import { prisma } from '@/lib/prisma';
import ContractDocument from './_components/ContractDocument';
import ContractToolbar from './_components/ContractToolbar';
import LegacyContract from './_components/LegacyContract';
import styles from './_components/Contract.module.css';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

function findContract(id: string) {
  return prisma.adminContract.findUnique({
    where: { id },
    select: {
      version: true,
      status: true,
      body: true,
      signedBy: true,
      signedAt: true,
      signedReference: true,
      booking: { select: { reference: true } },
    },
  });
}

/** The printed footer on every page: who issued the contract, its number and the page count. */
function pageFooter(contractNumber: string) {
  const text = JSON.stringify(`ZENTRA · ${BRAND.legalName} · Contract ${contractNumber}`);
  const box =
    'font-family: var(--font-zion-sans); font-size: var(--type-caption); color: var(--palette-zentra-muted);';
  return `@page { @bottom-left { content: ${text}; ${box} } @bottom-right { content: "Page " counter(page) " of " counter(pages); ${box} } }`;
}

/** The title also names the file when the contract is saved as PDF. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const actor = await currentAdmin();
  if (!actor || !canOpenPage(actor.role, 'bookings')) return { title: 'Contract' };
  const contract = await findContract((await params).id);
  return contract
    ? { title: { absolute: `ZENTRA contract ${contract.booking.reference} v${contract.version}` } }
    : { title: 'Contract' };
}

/**
 * One contract, ready to print or save as PDF (docs/admin-panel.md, "Contracts"). Everyone who may
 * open Bookings may open it. It sits outside the panel's frame, so only the paper prints.
 */
export default async function Page({ params }: Props) {
  if (!isAdminPage('bookings')) notFound();
  await adminPageActor('bookings');
  const contract = await findContract((await params).id);
  if (!contract) notFound();
  const { reference } = contract.booking;
  const snapshot = readContractSnapshot(contract.body);
  const signed =
    contract.signedAt && contract.signedBy && contract.signedReference
      ? { by: contract.signedBy, at: contract.signedAt, reference: contract.signedReference }
      : null;
  return (
    <div className={styles.canvas}>
      <style>{pageFooter(`${reference}-v${contract.version}`)}</style>
      <ContractToolbar backHref={bookingPagePath(reference, 'agreements')} />
      <main id="main-content">
        {snapshot ? (
          <ContractDocument snapshot={snapshot} status={contract.status} signed={signed} />
        ) : (
          <LegacyContract
            reference={reference}
            version={contract.version}
            status={contract.status}
            body={contract.body}
          />
        )}
      </main>
    </div>
  );
}
