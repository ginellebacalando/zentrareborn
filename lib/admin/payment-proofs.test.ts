import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { createServer, LogLevel } from 'pglite-server';
import {
  EMPTY_PAYMENT_ACCOUNTS,
  normalizePaymentAccounts,
  onlinePaymentMethods,
  paymentAccountsProblem,
  transferReceiptNumber,
} from './payment-accounts';
import { sniffPaymentProofType, stripJpegMetadata } from '../payment-proof-file';
import { balanceDueDate } from './booking-rules';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const png = () => new Uint8Array([...PNG_SIGNATURE, ...randomBytes(48)]);
const manilaToday = () => new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10);

test('payment screenshots are recognized by their bytes and photos lose their metadata', () => {
  assert.equal(sniffPaymentProofType(png()), 'image/png');
  assert.equal(sniffPaymentProofType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), 'image/jpeg');
  assert.equal(
    sniffPaymentProofType(new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 ')),
    'image/webp',
  );
  assert.equal(sniffPaymentProofType(new TextEncoder().encode('%PDF-1.7')), 'application/pdf');
  assert.equal(sniffPaymentProofType(new TextEncoder().encode('<svg onload=alert(1)>')), null);
  assert.equal(sniffPaymentProofType(new TextEncoder().encode('GIF89a')), null);
  // SOI, APP0 (kept), APP1 with EXIF (removed), start of scan with image data, EOI.
  const app0 = [0xff, 0xe0, 0x00, 0x07, 0x4a, 0x46, 0x49, 0x46, 0x00];
  const exif = [0xff, 0xe1, 0x00, 0x08, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00];
  const scan = [0xff, 0xda, 0x00, 0x04, 0x01, 0x02, 0x03, 0x04, 0xff, 0xd9];
  const photo = new Uint8Array([0xff, 0xd8, ...app0, ...exif, ...scan]);
  assert.deepEqual([...stripJpegMetadata(photo)], [0xff, 0xd8, ...app0, ...scan]);
  // A file that does not parse as expected is kept unchanged rather than damaged.
  const odd = new Uint8Array([0xff, 0xd8, 0x00, 0x01, 0x02, 0x03]);
  assert.deepEqual([...stripJpegMetadata(odd)], [...odd]);
});

test('payment accounts are offered only when complete and valid', () => {
  assert.deepEqual(onlinePaymentMethods(EMPTY_PAYMENT_ACCOUNTS), []);
  assert.equal(paymentAccountsProblem(EMPTY_PAYMENT_ACCOUNTS), null);
  const accounts = normalizePaymentAccounts({
    gcash: { accountName: ' Zion Events Place ', number: '0917-123 4567' },
    bank: { bankName: '', accountName: '', accountNumber: '' },
  });
  assert.deepEqual(accounts.gcash, { accountName: 'Zion Events Place', number: '09171234567' });
  assert.equal(paymentAccountsProblem(accounts), null);
  assert.deepEqual(onlinePaymentMethods(accounts), ['GCASH']);
  assert.equal(
    paymentAccountsProblem({ ...accounts, gcash: { ...accounts.gcash, number: '12345' } })?.field,
    'gcashNumber',
  );
  assert.equal(
    paymentAccountsProblem({
      ...accounts,
      bank: { bankName: 'BPI', accountName: '', accountNumber: '1234 5678 90' },
    })?.field,
    'bankAccountName',
  );
  // One transfer has one receipt number, however the client typed the reference.
  assert.equal(transferReceiptNumber('GCASH', '1234 5678 901'), 'GCASH-12345678901');
  assert.equal(transferReceiptNumber('BANK_TRANSFER', 'ab-12'), 'BANK-AB-12');
});

test(
  'a payment screenshot is verified or rejected by staff and confirms the booking only when verified',
  { timeout: 120000 },
  async () => {
    const db = new PGlite();
    await db.waitReady;
    const generated = execFileSync(
      process.execPath,
      [
        'node_modules/prisma/build/index.js',
        'migrate',
        'diff',
        '--from-empty',
        '--to-schema',
        'prisma/schema.prisma',
        '--script',
      ],
      { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 },
    );
    await db.exec(generated.slice(generated.indexOf('-- CreateSchema')));
    await db.exec('CREATE ROLE anon; CREATE ROLE authenticated;');
    const adminSql = readFileSync('prisma/admin.sql', 'utf8');
    await db.exec(adminSql.slice(adminSql.indexOf('-- Admin-only data')));
    await db.exec(readFileSync('prisma/automation.sql', 'utf8'));
    await db.exec(readFileSync('prisma/booking-holds.sql', 'utf8'));
    const proofsSql = readFileSync('prisma/payment-proofs.sql', 'utf8');
    await db.exec(proofsSql);
    // Re-running the installer SQL must be harmless.
    await db.exec(proofsSql);
    const receiptsSql = readFileSync('prisma/payment-receipts.sql', 'utf8');
    await db.exec(receiptsSql);
    await db.exec(receiptsSql);
    const server = createServer(db, { logLevel: LogLevel.Error });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    process.env.DATABASE_URL = `postgresql://postgres@127.0.0.1:${address.port}/postgres`;
    process.env.DATABASE_POOL_MAX = '1';
    process.env.AUTH_SECRET = randomBytes(32).toString('hex');
    process.env.NEXT_PUBLIC_APP_URL = 'https://zentra.example.test';
    delete process.env.STAFF_NOTIFICATION_EMAIL;
    delete process.env.SMTP_USER;
    const { prisma } = await import('../prisma');
    const { adminMutate, adminRead } = await import('./service');
    const { getAdminPreferences } = await import('./preferences');
    const { expireUnpaidHolds, remindWaitingProofs, scheduleBalanceReminders } =
      await import('./booking-automation');
    const { paymentLinkToken } = await import('../payment-link');
    const { readPaymentPage, submitPaymentProof } = await import('../../services/payment-proofs');
    const actor = {
      id: 'test-owner',
      email: 'owner@example.test',
      username: 'owner',
      fullName: 'Test Owner',
      profileImage: null,
      contactNumber: null,
      role: 'SUPERADMIN' as const,
      status: 'ACTIVE' as const,
      mustChangePassword: false,
      lastPasswordChangedAt: null,
    };
    try {
      const rls = await db.query<{ relrowsecurity: boolean }>(
        "SELECT relrowsecurity FROM pg_class WHERE relname = 'zion_payment_proofs'",
      );
      assert.equal(rls.rows[0]?.relrowsecurity, true, 'Screenshots are closed to the Data API');
      await adminMutate(
        {
          op: 'settings',
          version: 1,
          reviewed: true,
          paymentRule: 'DEPOSIT_REQUIRED',
          cashInstructions: 'Pay the reservation fee in cash at Zion Events Place.',
          contractTerms: 'Venue reviewed terms and cash policy. '.repeat(10),
        },
        actor,
      );
      const booking = async (days: number, name: string) => {
        const startsAt = new Date(Date.now() + days * 86400000);
        const created = (await adminMutate(
          {
            op: 'create-booking',
            booking: {
              clientName: name,
              email: `${name.toLowerCase().replace(/\s+/g, '.')}@example.test`,
              phone: '09123456789',
              eventType: 'Wedding',
              packageName: 'Classic',
              venue: 'Zion Events Place',
              startsAt: startsAt.toISOString(),
              endsAt: new Date(startsAt.getTime() + 4 * 3_600_000).toISOString(),
              guests: 50,
              totalCents: 10000000,
              depositCents: 3000000,
              paymentRule: 'DEPOSIT_REQUIRED',
              notes: 'Test data only',
            },
          },
          actor,
        )) as { id: string };
        const b = await prisma.adminBooking.findUniqueOrThrow({ where: { id: created.id } });
        await adminMutate(
          {
            op: 'booking-action',
            id: b.id,
            revision: b.revision,
            action: 'APPROVE',
            reason: 'Checked the request details.',
          },
          actor,
        );
        return created.id;
      };
      // Before any GCash or bank account is set up, the page shows cash only, and the emails link
      // it without offering an upload.
      const cashOnly = await booking(12, 'Cash Client');
      const cashApproval = await prisma.adminOutbox.findFirstOrThrow({
        where: { bookingId: cashOnly, event: 'REQUEST_APPROVED' },
      });
      assert.match(
        cashApproval.body,
        /See how to pay: https:\/\/zentra\.example\.test\/booking\/pay\//,
      );
      assert.doesNotMatch(cashApproval.body, /upload/);
      const cashPage = await readPaymentPage(paymentLinkToken(cashOnly));
      assert.ok(cashPage.state === 'waiting' && cashPage.methods.length === 0);
      // Settings: a wrong GCash number is refused; a complete account is offered to clients.
      const preferences = await getAdminPreferences();
      const withAccounts = (number: string) => ({
        op: 'preferences',
        settings: {
          ...preferences.settings,
          admin: {
            ...preferences.settings.admin,
            paymentAccounts: {
              gcash: { accountName: 'Zion Events Place', number },
              bank: { bankName: '', accountName: '', accountNumber: '' },
            },
          },
        },
        updatedAt: preferences.updatedAt,
      });
      await assert.rejects(adminMutate(withAccounts('12345'), actor), /GCash number/);
      await adminMutate(withAccounts('0917 123 4567'), actor);
      const settingsAudit = await prisma.auditLog.findFirstOrThrow({
        where: { module: 'Settings' },
        orderBy: { timestamp: 'desc' },
      });
      assert.match(settingsAudit.description, /Payment accounts changed\./);
      assert.doesNotMatch(settingsAudit.description, /0917/, 'The audit never holds the number');

      const get = (id: string) =>
        prisma.adminBooking.findUniqueOrThrow({ where: { id }, include: { payments: true } });
      const send = (
        id: string,
        fields: Partial<Record<string, string>> = {},
        file: Uint8Array = png(),
        headers: Record<string, string> = {},
      ) => {
        const form = new FormData();
        const values = {
          token: paymentLinkToken(id),
          method: 'GCASH',
          referenceNumber: '1234 5678 901',
          amount: '30000.00',
          paidOn: manilaToday(),
          website: '',
          ...fields,
        };
        for (const [key, value] of Object.entries(values))
          if (value !== undefined) form.set(key, value);
        form.set('file', new File([new Uint8Array(file)], 'IMG_0001.png', { type: 'image/png' }));
        return submitPaymentProof(
          new Request('https://zentra.example.test/api/client/payment-proofs', {
            method: 'POST',
            body: form,
            headers,
          }),
        );
      };

      const first = await booking(5, 'Payment Client');
      // The signed link opens the page; a forged or altered link shows nothing.
      const token = paymentLinkToken(first);
      assert.deepEqual(await readPaymentPage(`${first}.forged-signature-forged-signatu`), {
        state: 'invalid',
      });
      assert.deepEqual(await readPaymentPage(token.replace(/.$/, (c) => (c === 'a' ? 'b' : 'a'))), {
        state: 'invalid',
      });
      const page = await readPaymentPage(token);
      assert.equal(page.state, 'waiting');
      assert.equal(page.amountDueCents, 3000000);
      assert.deepEqual(page.methods, ['GCASH']);
      assert.equal(page.accounts.gcash.number, '09171234567');
      assert.equal(page.accounts.bank.accountNumber, '', 'An unused method shows no details');
      const approval = await prisma.adminOutbox.findFirstOrThrow({
        where: { bookingId: first, event: 'REQUEST_APPROVED' },
      });
      assert.ok(
        approval.body.includes(`https://zentra.example.test/booking/pay/${token}`),
        'The approval email links the payment page',
      );
      assert.match(approval.body, /See how to pay or upload your payment: https:/);

      // Uploads that must never be stored.
      await assert.rejects(
        send(first, {}, png(), { 'sec-fetch-site': 'cross-site' }),
        /payment page/,
      );
      await assert.rejects(send(first, { website: 'https://spam.example' }), /Check the payment/);
      await assert.rejects(send(first, { method: 'BANK_TRANSFER' }), /not available/);
      await assert.rejects(send(first, { paidOn: '2999-01-01' }), /future/);
      await assert.rejects(send(first, { amount: '100000.01' }), /more than the balance/);
      await assert.rejects(
        send(first, {}, new TextEncoder().encode('<svg onload=alert(1)>')),
        /JPG, PNG or WebP/,
      );
      await assert.rejects(
        send(first, { token: `${first}.not-the-signature-not-the-sig` }),
        /not valid/,
      );
      assert.equal(await prisma.adminPaymentProof.count(), 0);

      const sameImage = png();
      const sent = await send(first, {}, sameImage);
      assert.equal(sent.status, 'SUBMITTED');
      const stored = await prisma.adminPaymentProof.findFirstOrThrow({
        where: { bookingId: first },
      });
      assert.equal(stored.referenceNumber, '12345678901');
      assert.equal(stored.fileName, 'payment-proof.png', 'The client file name is never kept');
      assert.equal(stored.amountCents, 3000000);
      for (const event of ['PAYMENT_PROOF_RECEIVED', 'PAYMENT_PROOF_STAFF_ALERT'])
        assert.equal(await prisma.adminOutbox.count({ where: { bookingId: first, event } }), 1);
      assert.equal((await readPaymentPage(token)).state, 'waiting');

      // While staff check the screenshot the date stays held, even past its deadline.
      await prisma.adminBooking.update({
        where: { id: first },
        data: { holdExpiresAt: new Date(Date.now() - 60_000) },
      });
      await expireUnpaidHolds(new Date());
      assert.equal((await get(first)).reservation, 'REQUESTED');

      // A screenshot left waiting more than a day reminds staff once, with a link to its booking.
      assert.equal(await remindWaitingProofs(new Date()), 0, 'Not before a day has passed');
      const dayLater = new Date(stored.createdAt.getTime() + 25 * 3_600_000);
      assert.equal(await remindWaitingProofs(dayLater), 1);
      assert.equal(await remindWaitingProofs(dayLater), 0, 'Each screenshot is reminded once');
      const stillWaiting = await prisma.adminOutbox.findFirstOrThrow({
        where: { bookingId: first, event: 'PAYMENT_PROOF_WAITING' },
      });
      assert.match(stillWaiting.subject, /^Payment screenshot still waiting /);
      assert.equal(stillWaiting.replyTo, 'payment.client@example.test');
      assert.ok(
        stillWaiting.body.includes(
          `https://zentra.example.test/admin/bookings/${encodeURIComponent((await get(first)).reference)}?tab=payments`,
        ),
        'The reminder opens the booking on its Payments tab',
      );
      assert.match(stillWaiting.body, /the date stays held/);

      const alerts = await adminRead('notifications', new URLSearchParams(), actor);
      assert.ok('notifications' in alerts && alerts.notifications);
      assert.ok(alerts.notifications.some((notice) => notice.id === 'payment-screenshots'));
      const list = await adminRead('bookings', new URLSearchParams(), actor);
      assert.ok('bookings' in list && list.bookings);
      assert.equal(list.bookings.find((row) => row.id === first)?.proofsToVerify, 1);
      const detail = await adminRead('bookings', new URLSearchParams({ id: first }), actor);
      assert.ok('booking' in detail && detail.booking && 'paymentProofs' in detail.booking);
      const [shown] = detail.booking.paymentProofs;
      assert.equal(shown.status, 'SUBMITTED');
      assert.deepEqual(shown.warnings, []);
      assert.ok(!('data' in shown) && !('sha256' in shown), 'The file stays on its own route');

      // Rejecting asks the client for another screenshot and gives them at least a day.
      let b = await get(first);
      await adminMutate(
        {
          op: 'reject-proof',
          id: first,
          revision: b.revision,
          proofId: stored.id,
          reason: 'UNREADABLE',
          note: 'The reference number is cut off.',
        },
        actor,
      );
      b = await get(first);
      assert.equal(b.reservation, 'REQUESTED');
      assert.ok(b.holdExpiresAt && b.holdExpiresAt.getTime() > Date.now() + 23 * 3_600_000);
      const rejected = await prisma.adminPaymentProof.findUniqueOrThrow({
        where: { id: stored.id },
      });
      assert.equal(rejected.status, 'REJECTED');
      assert.equal(
        rejected.reviewReason,
        'The screenshot is unclear or cut off. The reference number is cut off.',
      );
      const rejection = await prisma.adminOutbox.findFirstOrThrow({
        where: { bookingId: first, event: 'PAYMENT_REJECTED' },
      });
      assert.match(rejection.body, /could not verify the payment screenshot/);
      assert.match(rejection.subject, /\| Payment screenshot not accepted \|/);
      assert.match(rejection.body, /The reference number is cut off\./);
      assert.ok(rejection.body.includes(`/booking/pay/${token}`));
      await assert.rejects(
        adminMutate(
          {
            op: 'verify-proof',
            id: first,
            revision: b.revision,
            proofId: stored.id,
            amountCents: 3000000,
            referenceNumber: '12345678901',
            receivedAt: new Date().toISOString(),
            note: '',
            checkedRecords: true,
          },
          actor,
        ),
        /already reviewed/,
      );
      const rejectedPage = await readPaymentPage(token);
      assert.ok(rejectedPage.state === 'waiting' && rejectedPage.proof?.status === 'REJECTED');

      // The same image again is pointed out to staff; a newer upload replaces a waiting one.
      await send(first, {}, sameImage);
      const again = await adminRead('bookings', new URLSearchParams({ id: first }), actor);
      assert.ok('booking' in again && again.booking && 'paymentProofs' in again.booking);
      assert.match(again.booking.paymentProofs[0].warnings.join(' '), /same image as an earlier/);
      const replacedId = again.booking.paymentProofs[0].id;
      await send(first);
      const latest = await prisma.adminPaymentProof.findFirstOrThrow({
        where: { bookingId: first, status: 'SUBMITTED' },
      });
      assert.equal(
        (await prisma.adminPaymentProof.findUniqueOrThrow({ where: { id: replacedId } })).status,
        'REPLACED',
      );
      b = await get(first);
      const verify = (id: string, proofId: string, revision: number, extra = {}) =>
        adminMutate(
          {
            op: 'verify-proof',
            id,
            revision,
            proofId,
            amountCents: 3000000,
            referenceNumber: '1234 5678 901',
            receivedAt: new Date(Date.now() - 60_000).toISOString(),
            note: 'Found in the GCash history.',
            checkedRecords: true,
            ...extra,
          },
          actor,
        );
      await assert.rejects(verify(first, replacedId, b.revision), /newer screenshot/);
      await assert.rejects(verify(first, latest.id, b.revision, { checkedRecords: false }));
      await assert.rejects(
        verify(first, latest.id, b.revision, { amountCents: 99999999 }),
        /exceeds/,
      );

      // Verifying records the transfer and confirms the booking in the same step.
      assert.deepEqual(await verify(first, latest.id, b.revision), { id: first, confirmed: true });
      b = await get(first);
      assert.equal(b.reservation, 'CONFIRMED');
      assert.equal(b.holdExpiresAt, null);
      assert.equal(b.payments.length, 1);
      assert.equal(b.payments[0].method, 'GCASH');
      assert.equal(b.payments[0].receiptNumber, 'GCASH-12345678901');
      assert.equal(b.payments[0].amountCents, 3000000);
      const proof = await prisma.adminPaymentProof.findUniqueOrThrow({ where: { id: latest.id } });
      assert.equal(proof.status, 'VERIFIED');
      assert.equal(proof.paymentId, b.payments[0].id);
      assert.equal(
        await prisma.adminOutbox.count({ where: { bookingId: first, event: 'PAYMENT_VERIFIED' } }),
        1,
      );
      const confirmation = await prisma.adminOutbox.findFirstOrThrow({
        where: { bookingId: first, event: 'RESERVATION_CONFIRMED' },
      });
      assert.equal(confirmation.calendarMethod, 'REQUEST');
      // A balance remains, so the confirmation links the payment page for it.
      assert.match(confirmation.body, /See how to pay or upload your payment: https:/);

      // Phase 3: every recorded payment has an acknowledgment number and a downloadable receipt.
      const feePayment = b.payments[0];
      assert.match(feePayment.acknowledgmentNumber ?? '', /^ACK-\d{4}-\d{6}$/);
      const verifiedNotice = await prisma.adminOutbox.findFirstOrThrow({
        where: { bookingId: first, event: 'PAYMENT_VERIFIED' },
      });
      assert.ok(
        verifiedNotice.body.includes(
          `Download your acknowledgment receipt: https://zentra.example.test/booking/pay/${token}/receipts/${feePayment.id}`,
        ),
      );
      const receiptRoute = await import('../../app/booking/pay/[token]/receipts/[paymentId]/route');
      const download = await receiptRoute.GET(new Request('https://zentra.example.test/'), {
        params: Promise.resolve({ token, paymentId: feePayment.id }),
      });
      assert.equal(download.status, 200);
      assert.equal(download.headers.get('content-type'), 'application/pdf');
      assert.match(
        download.headers.get('content-disposition') ?? '',
        /^attachment; filename="ACK-\d{4}-\d{6}\.pdf"$/,
      );
      assert.equal(
        Buffer.from(await download.arrayBuffer())
          .subarray(0, 5)
          .toString(),
        '%PDF-',
      );
      const forgedReceipt = await receiptRoute.GET(new Request('https://zentra.example.test/'), {
        params: Promise.resolve({
          token: `${first}.forged-signature-forged-signatu`,
          paymentId: feePayment.id,
        }),
      });
      assert.equal(forgedReceipt.status, 404);

      // After confirmation the same page takes the balance, due 14 days before the event.
      const balancePage = await readPaymentPage(token);
      assert.ok(balancePage.state === 'confirmed');
      assert.equal(balancePage.paying, 'balance');
      assert.equal(balancePage.amountDueCents, 7000000);
      assert.equal(balancePage.balanceDueAt, balanceDueDate(b.startsAt, 14).toISOString());
      assert.deepEqual(
        balancePage.payments.map((payment) => payment.acknowledgmentNumber),
        [feePayment.acknowledgmentNumber],
      );
      await send(first, { referenceNumber: '5555 6666 777', amount: '70000.00' });
      const balanceProof = await prisma.adminPaymentProof.findFirstOrThrow({
        where: { bookingId: first, status: 'SUBMITTED' },
      });
      const balanceAlert = await prisma.adminOutbox.findUniqueOrThrow({
        where: { idempotencyKey: `payment-proof:${balanceProof.id}:staff` },
      });
      assert.match(balanceAlert.body, /balance of a confirmed booking/);
      b = await get(first);
      assert.deepEqual(
        await verify(first, balanceProof.id, b.revision, {
          amountCents: 7000000,
          referenceNumber: '5555 6666 777',
        }),
        { id: first, confirmed: false },
      );
      b = await get(first);
      assert.equal(b.reservation, 'CONFIRMED');
      const numbers = b.payments
        .map((payment) => Number(payment.acknowledgmentNumber?.slice(-6)))
        .sort((x, y) => x - y);
      assert.equal(numbers.length, 2);
      assert.equal(numbers[1], numbers[0] + 1, 'Acknowledgment numbers follow each other');
      const paidPage = await readPaymentPage(token);
      assert.ok(paidPage.state === 'confirmed' && paidPage.paying === null);
      assert.equal(paidPage.payments.length, 2);
      await assert.rejects(send(first), /no payment due right now/);

      // The same transfer cannot pay for a second booking.
      const second = await booking(9, 'Second Client');
      await send(second);
      const secondDetail = await adminRead('bookings', new URLSearchParams({ id: second }), actor);
      assert.ok(
        'booking' in secondDetail &&
          secondDetail.booking &&
          'paymentProofs' in secondDetail.booking,
      );
      const warnings = secondDetail.booking.paymentProofs[0].warnings.join(' ');
      assert.match(warnings, /already verified for/);
      assert.match(warnings, /already recorded as payment GCASH-12345678901/);
      const secondBooking = await get(second);
      await assert.rejects(
        verify(second, secondDetail.booking.paymentProofs[0].id, secondBooking.revision),
        /already recorded/,
      );
      assert.equal((await get(second)).payments.length, 0);

      // Balance reminders: a week before the full-payment date, then the day before.
      const reminderId = await booking(18, 'Reminder Client');
      let held = await get(reminderId);
      await adminMutate(
        {
          op: 'cash-receipt',
          id: reminderId,
          revision: held.revision,
          amountCents: 3000000,
          receiptNumber: 'OR-REMIND-1',
          receivedAt: new Date().toISOString(),
          note: '',
        },
        actor,
      );
      held = await get(reminderId);
      assert.equal(held.reservation, 'CONFIRMED');
      const cashNotice = await prisma.adminOutbox.findFirstOrThrow({
        where: { bookingId: reminderId, event: 'CASH_RECEIPT' },
      });
      assert.match(cashNotice.body, /Download your acknowledgment receipt: https:/);
      const dueAt = balanceDueDate(held.startsAt, 14);
      assert.equal(
        await scheduleBalanceReminders(new Date()),
        0,
        'Not right after a payment notice',
      );
      const later = new Date(Date.now() + 13 * 3_600_000);
      assert.equal(await scheduleBalanceReminders(later), 1);
      assert.equal(await scheduleBalanceReminders(later), 0, 'Each reminder is sent once');
      assert.equal(await scheduleBalanceReminders(new Date(dueAt.getTime() - 12 * 3_600_000)), 1);
      const reminders = await prisma.adminOutbox.findMany({
        where: { bookingId: reminderId, event: 'BALANCE_REMINDER' },
        orderBy: { createdAt: 'asc' },
      });
      assert.deepEqual(
        reminders.map((reminder) => reminder.idempotencyKey?.split(':').at(-1)),
        ['week', 'day'],
      );
      assert.match(reminders[0].body, /remaining balance of .70,000 by /);
      assert.match(reminders[0].body, /See how to pay or upload your payment: https:/);

      // A client cannot flood the review queue.
      for (let upload = 2; upload <= 5; upload += 1) await send(second);
      await assert.rejects(send(second), /several screenshots today/);
      assert.equal(
        await prisma.adminPaymentProof.count({ where: { bookingId: second, status: 'SUBMITTED' } }),
        1,
        'Only the newest upload waits for review',
      );

      // A Settings page from before phase 3 sends no full-payment rule; the saved one stays.
      const current = await getAdminPreferences();
      await adminMutate(
        {
          op: 'preferences',
          settings: {
            ...current.settings,
            admin: {
              ...current.settings.admin,
              bookingRules: { ...current.settings.admin.bookingRules, balanceDueDays: 21 },
            },
          },
          updatedAt: current.updatedAt,
        },
        actor,
      );
      const saved = await getAdminPreferences();
      assert.equal(saved.settings.admin.bookingRules.balanceDueDays, 21);
      await adminMutate(
        {
          op: 'preferences',
          settings: {
            ...saved.settings,
            admin: {
              ...saved.settings.admin,
              bookingRules: {
                paymentDeadlineDays: saved.settings.admin.bookingRules.paymentDeadlineDays,
                reviewGuestLimit: saved.settings.admin.bookingRules.reviewGuestLimit,
              },
            },
          },
          updatedAt: saved.updatedAt,
        },
        actor,
      );
      assert.equal((await getAdminPreferences()).settings.admin.bookingRules.balanceDueDays, 21);
    } finally {
      await prisma.$disconnect();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await db.close();
    }
  },
);
