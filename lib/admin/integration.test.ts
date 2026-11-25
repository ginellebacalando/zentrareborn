import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { createServer } from 'pglite-server';

test(
  'admin workflows persist safely in an isolated PostgreSQL test database',
  { timeout: 120000 },
  async () => {
    const db = new PGlite();
    await db.waitReady;
    const sql = execFileSync(
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
    const start = sql.indexOf('-- CreateSchema');
    assert.ok(start >= 0, 'Expected generated schema SQL');
    await db.exec(sql.slice(start));
    const adminSql = readFileSync('prisma/admin.sql', 'utf8');
    await db.exec(adminSql.slice(adminSql.indexOf('-- Admin-only data')));
    await db.exec(readFileSync('prisma/automation.sql', 'utf8'));
    await db.exec(readFileSync('prisma/booking-holds.sql', 'utf8'));
    await db.exec(readFileSync('prisma/payment-proofs.sql', 'utf8'));
    const server = createServer(db);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    process.env.DATABASE_URL = `postgresql://postgres@127.0.0.1:${address.port}/postgres`;
    process.env.DATABASE_POOL_MAX = '1';
    process.env.AUTH_SECRET = randomBytes(32).toString('hex');
    // A staff inbox from the shell would add staff calendar invitations to the confirmation
    // below and change the exact delivery counts this test checks.
    delete process.env.STAFF_NOTIFICATION_EMAIL;
    delete process.env.SMTP_USER;
    const { prisma } = await import('../prisma');
    const { adminMutate, adminRead } = await import('./service');
    const { findSignInAccount } = await import('./sign-in');
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
    const administrator = {
      ...actor,
      id: 'test-admin',
      role: 'ADMIN' as const,
    };
    try {
      await prisma.user.create({
        data: {
          id: actor.id,
          username: actor.username,
          email: actor.email,
          role: actor.role,
          status: 'ACTIVE',
        },
      });
      await prisma.user.create({
        data: {
          id: 'test-client-account',
          username: 'client',
          email: 'client-account@example.test',
          role: 'CLIENT',
          status: 'ACTIVE',
        },
      });
      // Admin sign-in takes the email or the username in any letter case, never as a pattern.
      assert.equal((await findSignInAccount('OWNER@Example.test'))?.id, actor.id);
      assert.equal((await findSignInAccount('Owner'))?.id, actor.id);
      assert.equal(await findSignInAccount('own%'), null);
      assert.equal(await findSignInAccount('_wner'), null);
      assert.equal(await findSignInAccount('nobody'), null);
      await prisma.user.create({
        data: {
          id: 'test-owner-twin',
          username: 'OWNER',
          email: 'owner-twin@example.test',
          role: 'CLIENT',
          status: 'ACTIVE',
        },
      });
      assert.equal(await findSignInAccount('owner'), null, 'a shared username signs in no one');
      await prisma.user.delete({ where: { id: 'test-owner-twin' } });
      await prisma.inquiry.create({
        data: {
          id: 'test-business-inquiry',
          inquiryReference: 'INQ-TEST-001',
          fullName: 'Inquiry Client',
          email: 'inquiry@example.test',
          message: 'Please share the available wedding packages.',
          eventInterest: 'Wedding',
        },
      });
      const directory = await adminRead('team', new URLSearchParams(), actor);
      assert.ok('team' in directory && directory.team);
      assert.deepEqual(
        directory.team.map((member) => member.id),
        [actor.id],
      );
      assert.ok(directory.team.every((member) => !('passwordHash' in member)));
      const inbox = await adminRead('inquiries', new URLSearchParams(), actor);
      assert.ok('inquiries' in inbox && inbox.inquiries);
      assert.equal(inbox.inquiries.length, 1);
      assert.equal(inbox.inquiries[0].id, 'test-business-inquiry');
      await assert.rejects(
        adminMutate(
          {
            op: 'settings',
            version: 1,
            reviewed: true,
            paymentRule: 'NO_PAYMENT_REQUIRED',
            cashInstructions: 'Pay cash at the venue after approval.',
            contractTerms: 'Test reviewed terms. '.repeat(10),
          },
          administrator,
        ),
        /super administrator/,
      );
      await adminMutate(
        {
          op: 'settings',
          version: 1,
          reviewed: true,
          paymentRule: 'DEPOSIT_REQUIRED',
          cashInstructions:
            'Pay the agreed reservation fee in cash at Zion Events Place after approval; the balance is due before the event.',
          contractTerms: 'Venue reviewed terms and cash policy. '.repeat(10),
        },
        actor,
      );
      const startsAt = new Date(Date.now() + 86400000).toISOString(),
        endsAt = new Date(Date.now() + 90000000).toISOString();
      const input = {
        clientName: 'Test Client',
        email: 'client@example.test',
        phone: '09123456789',
        eventType: 'Wedding',
        packageName: 'Classic',
        venue: 'Zion Events Place',
        startsAt,
        endsAt,
        guests: 50,
        totalCents: 10000000,
        depositCents: 3000000,
        paymentRule: 'DEPOSIT_REQUIRED',
        notes: 'Test data only',
      };
      const inquiryPrefill = await adminRead(
        'bookings',
        new URLSearchParams({ inquiry: 'test-business-inquiry' }),
        actor,
      );
      assert.ok(
        'inquiry' in inquiryPrefill && inquiryPrefill.inquiry?.id === 'test-business-inquiry',
      );
      await assert.rejects(
        adminMutate(
          { op: 'create-booking', booking: input, sourceInquiryId: 'missing-inquiry' },
          actor,
        ),
        /Source inquiry not found/,
      );
      assert.equal(await prisma.adminBooking.count(), 0);
      const created = (await adminMutate(
        { op: 'create-booking', booking: input, sourceInquiryId: 'test-business-inquiry' },
        actor,
      )) as {
        id: string;
      };
      const originAudit = await prisma.auditLog.findFirst({
        where: { module: 'Bookings', action: 'CREATE' },
        orderBy: { timestamp: 'desc' },
      });
      assert.deepEqual(originAudit?.metadata, {
        bookingId: created.id,
        sourceInquiryId: 'test-business-inquiry',
      });
      const alerts = await adminRead('notifications', new URLSearchParams(), actor);
      assert.ok('notifications' in alerts && alerts.notifications);
      assert.deepEqual(
        alerts.notifications.map((notice) => notice.id),
        ['pending-bookings', 'new-inquiries'],
      );
      assert.ok(alerts.notifications.every((notice) => notice.href.startsWith('/admin/')));
      const insights = await adminRead('analytics', new URLSearchParams(), actor);
      assert.ok('analytics' in insights);
      assert.deepEqual(insights.analytics, {
        totalBookings: 1,
        inquiryCount: 1,
        cashCents: 0,
        reservations: [{ label: 'REQUESTED', count: 1 }],
        eventTypes: [{ label: 'Wedding', count: 1 }],
      });
      const get = () =>
        prisma.adminBooking.findUniqueOrThrow({
          where: { id: created.id },
          include: { payments: true, contracts: true },
        });
      const action = async (action: string) => {
        const b = await get();
        return adminMutate(
          {
            op: 'booking-action',
            id: b.id,
            revision: b.revision,
            action,
            reason: 'Verified by staff telephone call.',
          },
          actor,
        );
      };
      // Booking automation: approval needs no contact verification and holds the date until a
      // payment deadline, never later than the event start (docs/booking-automation.md).
      await action('APPROVE');
      const reviewedAlerts = await adminRead('notifications', new URLSearchParams(), actor);
      assert.ok('notifications' in reviewedAlerts && reviewedAlerts.notifications);
      assert.ok(!reviewedAlerts.notifications.some((notice) => notice.id === 'pending-bookings'));
      let b = await get();
      assert.equal(b.reservation, 'REQUESTED');
      assert.equal(b.payments.length, 0);
      assert.ok(b.holdExpiresAt, 'Approval sets a payment deadline');
      const expectedDeadline = Math.min(Date.now() + 3 * 86400000, b.startsAt.getTime());
      assert.ok(Math.abs(b.holdExpiresAt.getTime() - expectedDeadline) < 60000);
      const approvalNotice = await prisma.adminOutbox.findFirstOrThrow({
        where: { bookingId: b.id, event: 'REQUEST_APPROVED' },
      });
      assert.match(
        approvalNotice.body,
        /your date is on hold for you\. Please pay the reservation fee/,
      );
      await assert.rejects(action('CONFIRM'), /reservation fee/);
      const receipt = {
        op: 'cash-receipt',
        id: b.id,
        revision: b.revision,
        amountCents: 3000000,
        receiptNumber: 'TEST-001',
        receivedAt: new Date().toISOString(),
        note: 'Cash collected at venue',
      };
      await adminMutate(receipt, actor);
      await assert.rejects(adminMutate(receipt, actor), /changed/);
      b = await get();
      await assert.rejects(
        adminMutate(
          {
            ...receipt,
            revision: b.revision,
            amountCents: 99999999,
            receiptNumber: 'TEST-OVER',
          },
          actor,
        ),
        /exceeds/,
      );
      // Recording the reservation fee confirmed the booking by itself: no Confirm click.
      b = await get();
      assert.equal(b.reservation, 'CONFIRMED');
      assert.equal(b.holdExpiresAt, null);
      await assert.rejects(action('CONFIRM'), /Only a requested reservation/);
      const confirmation = await prisma.adminOutbox.findFirstOrThrow({
        where: { bookingId: b.id, event: 'RESERVATION_CONFIRMED' },
      });
      assert.equal(confirmation.status, 'QUEUED');
      assert.equal(confirmation.calendarMethod, 'REQUEST');
      assert.match(confirmation.calendar ?? '', /\r\nMETHOD:REQUEST\r\n/);
      assert.match(confirmation.calendar ?? '', new RegExp(`\\r\\nUID:booking-${b.id}@`));
      assert.match(confirmation.calendar ?? '', new RegExp(`\\r\\nSEQUENCE:${b.revision}\\r\\n`));
      assert.equal(
        confirmation.idempotencyKey,
        `booking:${b.id}:RESERVATION_CONFIRMED:r${b.revision}`,
      );
      assert.match(confirmation.html ?? '', /ZENTRA/);
      assert.equal(
        await prisma.adminOutbox.count({ where: { event: 'STAFF_CALENDAR_REQUEST' } }),
        0,
        'Without a staff inbox no staff calendar invitation is prepared',
      );
      await assert.rejects(
        adminMutate(
          {
            op: 'void-receipt',
            id: b.id,
            paymentId: b.payments[0].id,
            revision: b.revision,
            reason: 'Correction required',
          },
          administrator,
        ),
        /super administrator/,
      );
      await assert.rejects(
        adminMutate(
          {
            op: 'void-receipt',
            id: b.id,
            paymentId: b.payments[0].id,
            revision: b.revision,
            reason: 'Correction required',
          },
          actor,
        ),
        /Cancel the reservation/,
      );
      await adminMutate({ op: 'create-contract', id: b.id, revision: b.revision }, actor);
      b = await get();
      const c = b.contracts[0];
      assert.match(c.body, /Test Client/);
      assert.match(c.body, /ZION EVENTS PLACE/);
      await adminMutate(
        {
          op: 'contract-action',
          id: b.id,
          revision: b.revision,
          contractId: c.id,
          action: 'ISSUE',
        },
        actor,
      );
      await adminMutate(
        {
          op: 'contract-action',
          id: b.id,
          revision: b.revision,
          contractId: c.id,
          action: 'SIGN',
          signer: 'Test Client',
          reference: 'Filed signed document 001',
        },
        actor,
      );
      assert.equal((await get()).contracts[0].status, 'SIGNED');
      // A second request for the same slot cannot be approved while another booking holds or
      // confirms it, so two clients never pay for the same date.
      const clash = (await adminMutate(
        { op: 'create-booking', booking: { ...input, email: 'clash@example.test' } },
        actor,
      )) as { id: string };
      const clashRow = await prisma.adminBooking.findUniqueOrThrow({ where: { id: clash.id } });
      await assert.rejects(
        adminMutate(
          {
            op: 'booking-action',
            id: clash.id,
            revision: clashRow.revision,
            action: 'APPROVE',
            reason: 'Same date as a confirmed event.',
          },
          actor,
        ),
        /already held or confirmed/,
      );
      const later = {
        startsAt: new Date(Date.parse(startsAt) + 7 * 86400000).toISOString(),
        endsAt: new Date(Date.parse(endsAt) + 7 * 86400000).toISOString(),
      };
      const other = (await adminMutate(
        {
          op: 'create-booking',
          booking: { ...input, ...later, email: 'other@example.test' },
        },
        actor,
      )) as { id: string };
      for (const decision of ['VERIFY', 'APPROVE']) {
        const x = await prisma.adminBooking.findUniqueOrThrow({
          where: { id: other.id },
        });
        await adminMutate(
          {
            op: 'booking-action',
            id: x.id,
            revision: x.revision,
            action: decision,
            reason: 'Confirmed contact by telephone.',
          },
          actor,
        );
      }
      let x = await prisma.adminBooking.findUniqueOrThrow({
        where: { id: other.id },
      });
      // A partial payment below the reservation fee keeps the booking waiting for payment.
      await adminMutate(
        {
          ...receipt,
          id: x.id,
          revision: x.revision,
          amountCents: 1000000,
          receiptNumber: 'TEST-002',
        },
        actor,
      );
      x = await prisma.adminBooking.findUniqueOrThrow({ where: { id: x.id } });
      assert.equal(x.reservation, 'REQUESTED');
      await assert.rejects(
        adminMutate(
          {
            op: 'booking-action',
            id: x.id,
            revision: x.revision,
            action: 'CONFIRM',
            reason: 'Checked the partial payment.',
          },
          actor,
        ),
        /reservation fee/,
      );
      const dashboard = (await adminRead('dashboard', new URLSearchParams(), actor)) as {
        confirmed: number;
        cashCents: number;
      };
      assert.equal(dashboard.confirmed, 1);
      assert.equal(dashboard.cashCents, 4000000);
      await adminMutate(
        {
          op: 'settings',
          version: 2,
          reviewed: true,
          paymentRule: 'FULL_PAYMENT_REQUIRED',
          cashInstructions:
            'Pay the entire agreed price in cash at Zion Events Place before staff confirms the reservation.',
          contractTerms: 'Venue reviewed revised terms and full cash policy. '.repeat(10),
        },
        actor,
      );
      b = await get();
      await assert.rejects(
        adminMutate({ op: 'create-contract', id: b.id, revision: b.revision }, actor),
        /older policy/,
      );
      assert.equal(
        (await prisma.adminContract.findUniqueOrThrow({ where: { id: c.id } })).body,
        c.body,
        'New policy must not rewrite an existing signed agreement',
      );
      x = await prisma.adminBooking.findUniqueOrThrow({
        where: { id: other.id },
      });
      await assert.rejects(
        adminMutate({ op: 'create-contract', id: x.id, revision: x.revision }, actor),
        /Re-review/,
      );
      for (const decision of ['REVIEW_POLICY', 'APPROVE']) {
        x = await prisma.adminBooking.findUniqueOrThrow({
          where: { id: x.id },
        });
        await adminMutate(
          {
            op: 'booking-action',
            id: x.id,
            revision: x.revision,
            action: decision,
            reason: 'Owner reviewed the updated full cash policy.',
          },
          actor,
        );
      }
      x = await prisma.adminBooking.findUniqueOrThrow({ where: { id: x.id } });
      assert.equal(x.policyVersion, 3);
      assert.equal(x.paymentRule, 'FULL_PAYMENT_REQUIRED');
      await assert.rejects(
        adminMutate(
          {
            op: 'booking-action',
            id: x.id,
            revision: x.revision,
            action: 'CONFIRM',
            reason: 'Checked cash prerequisites.',
          },
          actor,
        ),
        /Full cash payment/,
      );
      // Edit details: requested bookings only, current revision, conservative resets, no email.
      x = await prisma.adminBooking.findUniqueOrThrow({ where: { id: x.id } });
      const editable = {
        ...input,
        ...later,
        email: 'other@example.test',
        paymentRule: 'FULL_PAYMENT_REQUIRED',
      };
      const edit = (
        target: { id: string; revision: number },
        changes: Partial<typeof input>,
        reason = 'Client updated the request.',
      ) =>
        adminMutate(
          {
            op: 'edit-booking',
            id: target.id,
            revision: target.revision,
            booking: { ...editable, ...changes },
            reason,
          },
          actor,
        );
      const noticesBeforeEdits = await prisma.adminOutbox.count({ where: { bookingId: x.id } });
      await edit(x, { notes: 'Client asked to add a dessert table.' });
      let edited = await prisma.adminBooking.findUniqueOrThrow({ where: { id: x.id } });
      assert.equal(edited.revision, x.revision + 1);
      assert.equal(edited.notes, 'Client asked to add a dessert table.');
      assert.equal(edited.approval, 'APPROVED', 'Notes alone keep the approval');
      assert.equal(edited.verification, 'VERIFIED');
      const editAudit = await prisma.auditLog.findFirstOrThrow({
        where: { module: 'Bookings', description: { startsWith: `Edited ${x.reference}:` } },
      });
      assert.equal(editAudit.action, 'UPDATE');
      assert.deepEqual(editAudit.metadata, { bookingId: x.id });
      await assert.rejects(edit(x, { notes: 'Stale copy' }), /changed/);
      await assert.rejects(edit(await get(), {}), /cannot be edited/);
      await assert.rejects(edit(edited, { paymentRule: 'DEPOSIT_REQUIRED' }), /payment policy/);
      await edit(edited, { guests: 80 }, 'Client confirmed a larger guest list.');
      edited = await prisma.adminBooking.findUniqueOrThrow({ where: { id: x.id } });
      assert.equal(edited.guests, 80);
      assert.equal(edited.approval, 'PENDING', 'Changed terms return to review');
      assert.equal(edited.holdExpiresAt, null, 'Back in review, the date is no longer held');
      assert.equal(edited.decisionReason, 'Client confirmed a larger guest list.');
      assert.equal(edited.verification, 'VERIFIED', 'Unchanged contact keeps verification');
      await edit(edited, { guests: 80, email: 'changed@example.test' });
      edited = await prisma.adminBooking.findUniqueOrThrow({ where: { id: x.id } });
      assert.equal(edited.email, 'changed@example.test');
      assert.equal(edited.verification, 'UNREVIEWED');
      assert.equal(edited.verificationNote, '');
      assert.equal(edited.verifiedBy, null);
      assert.equal(edited.verifiedAt, null);
      await assert.rejects(
        edit(edited, {
          guests: 80,
          email: 'changed@example.test',
          totalCents: 500000,
          depositCents: 100000,
        }),
        /cash already received/,
      );
      assert.equal(
        await prisma.adminOutbox.count({ where: { bookingId: x.id } }),
        noticesBeforeEdits,
        'Edits never queue email',
      );
      assert.ok((await prisma.auditLog.count({ where: { source: 'zion-admin' } })) > 5);
      assert.ok((await prisma.adminOutbox.count()) > 3);
      assert.equal(
        await prisma.adminOutbox.count({ where: { status: 'ACCEPTED' } }),
        0,
        'Queued messages must not be presented as sent',
      );
      const { processAdminNotifications } = await import('./notifications');
      const smtpKeys = ['SMTP_USER', 'SMTP_PASSWORD', 'MAIL_FROM'] as const;
      const originalSmtp = Object.fromEntries(smtpKeys.map((key) => [key, process.env[key]]));
      try {
        for (const key of smtpKeys) delete process.env[key];
        await assert.rejects(processAdminNotifications(), /not configured/);
        process.env.SMTP_USER = 'venue@example.test';
        process.env.SMTP_PASSWORD = 'isolated-test-only';
        process.env.MAIL_FROM = 'Zion Events Place <venue@example.test>';
        let requests = 0;
        let calendars = 0;
        const transport = {
          async send(message: {
            messageId: string;
            to: string;
            subject: string;
            text: string;
            calendar?: { method: string; content: string } | null;
          }) {
            assert.match(message.messageId, /^<automation\./);
            assert.match(message.text, /Approval:.*\nReservation:.*\nPayment:/);
            if (message.calendar) {
              calendars++;
              assert.equal(message.calendar.method, 'REQUEST');
            }
            requests++;
            if (requests === 1)
              throw Object.assign(new Error('Mailbox unavailable'), {
                responseCode: 550,
                permanent: true,
              });
            return { accepted: [message.to], rejected: [] };
          },
          close() {},
        };
        const dispatched = await processAdminNotifications({ transport });
        assert.ok(dispatched.accepted > 0);
        assert.equal(dispatched.processed, requests);
        assert.equal(calendars, 1, 'Only the confirmation carries a calendar invitation');
        assert.equal(
          await prisma.adminOutbox.count({
            where: { status: 'REVIEW_REQUIRED' },
          }),
          1,
          'Permanently rejected sends must be held for review, not retried blindly',
        );
        assert.equal(
          await prisma.adminOutbox.count({ where: { status: 'ACCEPTED' } }),
          dispatched.accepted,
        );
        const again = await processAdminNotifications({ transport });
        assert.equal(again.processed, 0, 'Accepted notices are never sent again');
      } finally {
        for (const key of smtpKeys) {
          if (originalSmtp[key] === undefined) delete process.env[key];
          else process.env[key] = originalSmtp[key];
        }
      }
      const security = await db.query<{ relrowsecurity: boolean }>(
        "SELECT relrowsecurity FROM pg_class WHERE relname LIKE 'zion_admin_%' AND relkind='r'",
      );
      assert.equal(security.rows.length, 6);
      assert.ok(security.rows.every((r) => r.relrowsecurity));

      const {
        getAdminPreferences,
        saveAdminPreferences,
        activityCsv,
        csvCell,
        readStaffNotificationEmails,
      } = await import('./preferences');
      const { getPublicSystemSettings, requireClientFeature } = await import('../system-settings');
      await prisma.systemSetting.create({
        data: {
          id: 'singleton',
          settings: { unrelated: { preserved: true }, client: { faqVisible: false } },
        },
      });
      const initialPreferences = await getAdminPreferences();
      assert.deepEqual(initialPreferences.settings.admin.staffNotifications, { emails: [] });
      const preferenceDraft = structuredClone(initialPreferences.settings);
      preferenceDraft.appearance.defaultTheme = 'dark';
      preferenceDraft.admin.security.sessionTimeoutMinutes = 15;
      preferenceDraft.admin.notifications.customerInquiries = false;
      preferenceDraft.admin.notifications.systemAlerts = false;
      preferenceDraft.admin.localization.timezone = 'Asia/Tokyo';
      preferenceDraft.admin.localization.dateFormat = 'YYYY-MM-DD (ISO)';
      preferenceDraft.client.maintenanceMode = true;
      preferenceDraft.client.disabledMessage = 'Temporarily closed for testing.';
      const updatePreferences = {
        op: 'preferences',
        settings: preferenceDraft,
        updatedAt: initialPreferences.updatedAt,
      };
      await assert.rejects(
        saveAdminPreferences(updatePreferences, administrator),
        /super administrator/,
      );
      const savedPreferences = await saveAdminPreferences(updatePreferences, actor);
      assert.deepEqual(savedPreferences.settings, preferenceDraft);
      const storedPreferences = await prisma.systemSetting.findUniqueOrThrow({
        where: { id: 'singleton' },
      });
      assert.deepEqual((storedPreferences.settings as { unrelated: unknown }).unrelated, {
        preserved: true,
      });
      await assert.rejects(saveAdminPreferences(updatePreferences, actor), /another window/);
      await assert.rejects(
        saveAdminPreferences(
          {
            ...updatePreferences,
            updatedAt: savedPreferences.updatedAt,
            settings: {
              ...preferenceDraft,
              admin: { ...preferenceDraft.admin, security: { sessionTimeoutMinutes: 0 } },
            },
          },
          actor,
        ),
      );
      const publicPreferences = await getPublicSystemSettings();
      assert.equal(publicPreferences.appearance.defaultTheme, 'dark');
      assert.equal(publicPreferences.localization.timezone, 'Asia/Tokyo');
      assert.equal(publicPreferences.client.faqVisible, false);
      assert.ok(!('admin' in publicPreferences));
      await assert.rejects(
        requireClientFeature('inquirySubmissions'),
        /Temporarily closed for testing/,
      );
      const filteredAlerts = await adminRead('notifications', new URLSearchParams(), actor);
      assert.ok('notifications' in filteredAlerts && filteredAlerts.notifications);
      assert.ok(
        !filteredAlerts.notifications.some((notice) =>
          ['new-inquiries', 'delivery-issues', 'policy-review'].includes(notice.id),
        ),
      );
      assert.ok(filteredAlerts.notifications.some((notice) => notice.id === 'payment-updates'));
      const mutedDraft = structuredClone(preferenceDraft);
      mutedDraft.admin.notifications.paymentUpdates = false;
      mutedDraft.admin.notifications.bookingConfirmations = false;
      mutedDraft.admin.notifications.bookingCancellations = false;
      mutedDraft.admin.notifications.contractUpdates = false;
      const mutedPreferences = await saveAdminPreferences(
        { op: 'preferences', settings: mutedDraft, updatedAt: savedPreferences.updatedAt },
        actor,
      );
      const mutedAlerts = await adminRead('notifications', new URLSearchParams(), actor);
      assert.ok('notifications' in mutedAlerts && mutedAlerts.notifications);
      assert.ok(
        !mutedAlerts.notifications.some((notice) =>
          [
            'payment-updates',
            'booking-confirmations',
            'booking-cancellations',
            'contract-updates',
          ].includes(notice.id),
        ),
      );
      // Staff notification emails: normalized, limited, audited without addresses, never public.
      const staffAudits = (text: string) =>
        prisma.auditLog.findMany({
          where: { module: 'Settings', action: 'SETTINGS_CHANGE', description: { contains: text } },
          select: { description: true },
        });
      assert.equal((await staffAudits('Staff notification')).length, 0, 'Unchanged lists say so');
      const staffDraft = structuredClone(mutedDraft);
      staffDraft.admin.staffNotifications.emails = [' Owner@Example.test ', 'partner@example.test'];
      const staffUpdate = {
        op: 'preferences',
        settings: staffDraft,
        updatedAt: mutedPreferences.updatedAt,
      };
      await assert.rejects(saveAdminPreferences(staffUpdate, administrator), /super administrator/);
      for (const [emails, problem] of [
        [['a', 'b', 'c', 'd', 'e', 'f'].map((name) => `${name}@example.test`), /up to 5/],
        [['owner@example.test', 'not-an-address'], /not-an-address\W+is not a valid email/],
        [['same@example.test', 'SAME@example.test'], /only once/],
        [[1, 2, 3, 4, 5].map((index) => `${'x'.repeat(50)}${index}@example.test`), /255/],
      ] as const)
        await assert.rejects(
          saveAdminPreferences(
            {
              ...staffUpdate,
              settings: {
                ...staffDraft,
                admin: { ...staffDraft.admin, staffNotifications: { emails: [...emails] } },
              },
            },
            actor,
          ),
          problem,
        );
      const staffSaved = await saveAdminPreferences(staffUpdate, actor);
      const staffEmails = ['owner@example.test', 'partner@example.test'];
      assert.deepEqual(staffSaved.settings.admin.staffNotifications.emails, staffEmails);
      assert.deepEqual(
        (await getAdminPreferences()).settings.admin.staffNotifications.emails,
        staffEmails,
      );
      const storedStaff = await prisma.systemSetting.findUniqueOrThrow({
        where: { id: 'singleton' },
      });
      assert.deepEqual(
        (storedStaff.settings as { admin: { staffNotifications: unknown } }).admin
          .staffNotifications,
        { emails: staffEmails },
      );
      const changedAudits = await staffAudits('Staff notification emails changed (2 addresses).');
      assert.equal(changedAudits.length, 1);
      assert.ok(
        !changedAudits[0].description.includes('@'),
        'The audit trail never records the addresses',
      );
      assert.ok(!JSON.stringify(await getPublicSystemSettings()).includes('@example.test'));
      assert.deepEqual(await readStaffNotificationEmails(), staffEmails);
      const clearedDraft = structuredClone(staffDraft);
      clearedDraft.admin.staffNotifications.emails = [];
      await saveAdminPreferences(
        { op: 'preferences', settings: clearedDraft, updatedAt: staffSaved.updatedAt },
        actor,
      );
      assert.equal((await staffAudits('cleared; the server default applies')).length, 1);
      assert.deepEqual(await readStaffNotificationEmails(), []);
      await prisma.auditLog.create({
        data: {
          userId: 'test-client-account',
          userName: 'Other user',
          userRole: 'CLIENT',
          action: 'UPDATE',
          module: 'Settings',
          description: 'OTHER-USER-PRIVATE-LOG',
          status: 'SUCCESS',
        },
      });
      const ownCsv = await activityCsv({ ...actor, role: 'ADMIN' }, 'Asia/Manila');
      assert.ok(ownCsv.startsWith('\uFEFF"Date and time"'));
      assert.ok(!ownCsv.includes('OTHER-USER-PRIVATE-LOG'));
      assert.equal(csvCell('=SUM(1,2)'), '"\'=SUM(1,2)"');
      await assert.rejects(activityCsv(actor, 'Invalid/Timezone'), /Unsupported export timezone/);

      const { readCatalog, saveCatalog } = await import('./catalog');
      const { getPublicPackageBySlug, getPublicEventCategories } =
        await import('../services-packages');
      const categoryInput = {
        op: 'catalog-category',
        id: null,
        updatedAt: null,
        category: {
          name: 'Catalog Weddings',
          slug: 'catalog-weddings',
          description: 'Wedding services in the isolated test catalog.',
          coverImageUrl: '',
          displayOrder: 10,
          status: 'ACTIVE',
          clientVisible: true,
        },
      };
      await assert.rejects(saveCatalog(categoryInput, administrator), /super administrator/);
      const newCategory = await saveCatalog(categoryInput, actor);
      const packageInput = {
        op: 'catalog-package',
        id: null,
        updatedAt: null,
        package: {
          eventCategoryId: newCategory.categoryId,
          packageName: 'Classic Catalog',
          slug: 'classic-catalog-test',
          description: 'Original package description.',
          price: 50000,
          currency: 'PHP',
          paxIncluded: 100,
          excessPaxFee: 500,
          reservationFee: 10000,
          downPaymentAmount: 15000,
          fullPaymentAmount: 50000,
          checkInTime: '2 PM',
          checkOutTime: '10 PM',
          packageImageUrl: '',
          contractItemDescription: 'Wedding package',
          contractInclusionDescription: 'Tables and chairs',
          internalNotes: 'OWNER-ONLY-CATALOG-NOTE',
          status: 'ACTIVE',
          clientVisible: true,
          inclusions: [
            {
              inclusionName: 'Tables and chairs',
              description: '',
              isFree: true,
              isOptional: false,
              displayOrder: 0,
            },
          ],
        },
      };
      await assert.rejects(saveCatalog(packageInput, administrator), /super administrator/);
      await saveCatalog(packageInput, actor);
      const catalog = await readCatalog(
        new URLSearchParams({ category: newCategory.categoryId }),
        actor,
      );
      assert.equal(catalog.packages.length, 1);
      const firstPackage = catalog.packages[0];
      assert.equal(firstPackage.currentVersion, 1);
      const published = await getPublicPackageBySlug(packageInput.package.slug);
      assert.equal(published.price, 50000);
      assert.equal(published.inclusions.length, 1);
      assert.ok(!('internalNotes' in published));
      const editPackage = {
        ...packageInput,
        id: firstPackage.id,
        updatedAt: firstPackage.updatedAt.toISOString(),
        package: {
          ...packageInput.package,
          price: 60000,
          description: 'Updated package description.',
          inclusions: [
            { ...packageInput.package.inclusions[0], id: firstPackage.inclusions[0].id },
          ],
        },
      };
      await saveCatalog(editPackage, actor);
      const updatedCatalog = await readCatalog(
        new URLSearchParams({ category: newCategory.categoryId, q: 'Classic' }),
        actor,
      );
      assert.equal(updatedCatalog.total, 1);
      assert.equal(updatedCatalog.packages[0].currentVersion, 2);
      assert.equal(updatedCatalog.packages[0].inclusions[0].id, firstPackage.inclusions[0].id);
      assert.equal((await getPublicPackageBySlug(packageInput.package.slug)).price, 60000);
      const versions = await prisma.packageVersion.findMany({
        where: { packageId: firstPackage.id },
        orderBy: { versionNumber: 'asc' },
      });
      assert.deepEqual(
        versions.map((version) => (version.snapshotData as { price: number }).price),
        [50000, 60000],
      );
      assert.ok(
        versions.every((version) => !('internalNotes' in (version.snapshotData as object))),
      );
      await assert.rejects(saveCatalog(editPackage, actor), /record changed/);
      await assert.rejects(saveCatalog(packageInput, actor), /slug already exists/);
      await assert.rejects(
        saveCatalog({ ...packageInput, package: { ...packageInput.package, price: -1 } }, actor),
      );
      await assert.rejects(
        saveCatalog(
          {
            ...packageInput,
            package: { ...packageInput.package, packageImageUrl: 'javascript:alert(1)' },
          },
          actor,
        ),
      );
      await assert.rejects(
        saveCatalog(
          {
            ...editPackage,
            updatedAt: updatedCatalog.packages[0].updatedAt.toISOString(),
            package: {
              ...editPackage.package,
              inclusions: [
                { ...editPackage.package.inclusions[0], id: 'another-package-inclusion' },
              ],
            },
          },
          actor,
        ),
        /belongs to another package/,
      );
      await saveCatalog(
        {
          ...categoryInput,
          id: newCategory.categoryId,
          updatedAt: updatedCatalog.category!.updatedAt.toISOString(),
          category: {
            ...categoryInput.category,
            name: 'Updated Catalog Weddings',
            clientVisible: false,
          },
        },
        actor,
      );
      assert.ok(
        !(await getPublicEventCategories()).some(
          (category) => category?.id === newCategory.categoryId,
        ),
      );
      await assert.rejects(getPublicPackageBySlug(packageInput.package.slug), /not found/);
      assert.equal(await prisma.packageVersion.count({ where: { packageId: firstPackage.id } }), 2);
    } finally {
      await prisma.$disconnect();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await db.close();
    }
  },
);
