import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import sharp from 'sharp';
import { PGlite } from '@electric-sql/pglite';
import { createServer, LogLevel } from 'pglite-server';
import {
  ClientPhotoFileError,
  prepareClientPhoto,
  sniffClientPhotoType,
} from './client-photo-file';
import {
  photoFromViewToken,
  photoLinkToken,
  photoViewPath,
  subjectFromPhotoToken,
} from './client-photo-link';
import { createGeminiComposer } from '@/services/chatbot/gemini';
import { createLlmRateGuard } from '@/services/chatbot/llm-rate-guard';

/**
 * Optional client photos (docs/client-photos.md): upload checks and cleaning, signed links,
 * who can see which photo, retention and immediate deletion, the photo emails, and that no photo
 * data ever reaches an AI request.
 */
process.env.AUTH_SECRET ??= 'test-only-secret-for-client-photo-links-0123456789';
process.env.NEXT_PUBLIC_APP_URL ??= 'https://zion.example.test';

const DAY_MS = 24 * 60 * 60_000;

function face(width: number, height: number) {
  return sharp({
    create: { width, height, channels: 3, background: { r: 186, g: 140, b: 118 } },
  });
}

/** A camera-like JPEG that carries a location (GPS) and camera details in its EXIF data. */
async function jpegWithLocation(width = 1200, height = 1600) {
  return face(width, height)
    .jpeg()
    .withExif({
      IFD0: { Make: 'TestPhone', Model: 'Front camera' },
      IFD3: {
        GPSLatitudeRef: 'N',
        GPSLatitude: '14/1 35/1 2400/100',
        GPSLongitudeRef: 'E',
        GPSLongitude: '121/1 0/1 1200/100',
      },
    })
    .toBuffer();
}

const blob = (bytes: Uint8Array, type = 'image/jpeg') =>
  new Blob([new Uint8Array(bytes)], { type });

/** True when the bytes contain the pair anywhere (a JPEG's APP1 marker holds EXIF or XMP). */
function contains(bytes: Uint8Array, ...pair: number[]) {
  for (let index = 0; index < bytes.length - 1; index += 1)
    if (bytes[index] === pair[0] && bytes[index + 1] === pair[1]) return true;
  return false;
}

test('uploads: wrong types, oversized and tiny photos are refused with a clear reason', async () => {
  const refused = async (file: Blob, message: RegExp) =>
    assert.rejects(prepareClientPhoto(file), (error: unknown) => {
      assert.ok(error instanceof ClientPhotoFileError);
      assert.match(error.message, message);
      return true;
    });
  await refused(
    blob(new TextEncoder().encode('%PDF-1.7 not a photo'), 'image/jpeg'),
    /JPG, PNG or WebP/,
  );
  await refused(blob(new TextEncoder().encode('GIF89a......'), 'image/gif'), /JPG, PNG or WebP/);
  await refused(blob(new TextEncoder().encode('just text'), 'image/png'), /JPG, PNG or WebP/);
  // An iPhone photo the phone did not convert gets an explanation, not a generic error.
  const heic = new Uint8Array([0, 0, 0, 0x18, ...new TextEncoder().encode('ftypheic'), 0, 0, 0, 0]);
  assert.equal(sniffClientPhotoType(heic), 'image/heic');
  await refused(blob(heic, 'image/heic'), /cannot be opened here/);
  // Over 10 MB is refused before the file is even read.
  const huge = new Uint8Array(10 * 1024 * 1024 + 1);
  huge.set([0xff, 0xd8, 0xff]);
  await refused(blob(huge), /under 10 MB/);
  await refused(blob(new Uint8Array()), /Choose a photo/);
  await refused(blob(await face(60, 60).jpeg().toBuffer()), /too small/);
  // A broken JPEG is refused rather than stored.
  await refused(
    blob(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4])),
    /could not be opened|too small/,
  );
});

test('uploads: saved photos are re-encoded, at most 800 px, with no location or other metadata', async () => {
  const original = await jpegWithLocation();
  const before = await sharp(original).metadata();
  assert.ok(before.exif, 'the test photo starts with EXIF data');
  // The GPS directory pointer (tag 0x8825) is in the original, in either byte order.
  assert.ok(contains(before.exif, 0x88, 0x25) || contains(before.exif, 0x25, 0x88));
  const saved = await prepareClientPhoto(blob(original));
  assert.equal(saved.contentType, 'image/jpeg');
  assert.ok(saved.width <= 800 && saved.height <= 800);
  assert.equal(Math.max(saved.width, saved.height), 800);
  const after = await sharp(saved.data).metadata();
  assert.equal(after.format, 'jpeg');
  assert.equal(after.exif, undefined);
  assert.equal(after.xmp, undefined);
  assert.equal(after.iptc, undefined);
  assert.equal(after.icc, undefined);
  // No APP1 segment at all: that is where EXIF (with GPS) and XMP live in a JPEG.
  assert.equal(contains(saved.data, 0xff, 0xe1), false);
  assert.equal(saved.sizeBytes, saved.data.length);
  assert.match(saved.sha256, /^[0-9a-f]{64}$/);
  // PNG and WebP become JPEG too; a transparent background turns white.
  const png = await face(400, 400).ensureAlpha(0).png().toBuffer();
  assert.equal(
    (await sharp((await prepareClientPhoto(blob(png, 'image/png'))).data).metadata()).format,
    'jpeg',
  );
  const webp = await face(500, 300).webp().toBuffer();
  const smaller = await prepareClientPhoto(blob(webp, 'image/webp'));
  assert.deepEqual([smaller.width, smaller.height], [500, 300]);
});

test('photo links are signed, expire, and serve one purpose only', () => {
  const now = new Date('2026-11-27T02:00:00Z');
  const subject = { kind: 'booking' as const, id: 'cbooking0000000000000001' };
  const token = photoLinkToken(subject, now);
  assert.deepEqual(subjectFromPhotoToken(token, now), subject);
  assert.ok(subjectFromPhotoToken(token, new Date(now.getTime() + 6.9 * DAY_MS)));
  assert.equal(subjectFromPhotoToken(token, new Date(now.getTime() + 7.1 * DAY_MS)), null);
  // Record ids may contain dashes (lib/signed-link.ts), like the local demo's "demo-visit-2".
  const demo = { kind: 'visit' as const, id: 'demo-visit-2' };
  assert.deepEqual(subjectFromPhotoToken(photoLinkToken(demo, now), now), demo);
  const flipped = `${token.slice(0, -1)}${token.endsWith('a') ? 'b' : 'a'}`;
  assert.equal(subjectFromPhotoToken(flipped, now), null);
  // Moving the expiry or the subject breaks the signature.
  const [, expiry, signature] = token.split('.');
  assert.equal(
    subjectFromPhotoToken(`b-cbooking0000000000000002.${expiry}.${signature}`, now),
    null,
  );
  const later = (parseInt(expiry, 36) + DAY_MS / 1000).toString(36);
  assert.equal(subjectFromPhotoToken(`b-${subject.id}.${later}.${signature}`, now), null);

  const view = photoViewPath({ id: 'cphoto000000000000000001', updatedAt: now }, now);
  assert.ok(view);
  assert.ok(view.startsWith('/api/client-photos/'));
  const viewToken = view.split('/').pop()!;
  assert.deepEqual(photoFromViewToken(viewToken, now), {
    id: 'cphoto000000000000000001',
    version: now.getTime().toString(36),
  });
  // Short-lived: at most 30 minutes; the address stays the same within a 15-minute step.
  assert.equal(
    photoViewPath(
      { id: 'cphoto000000000000000001', updatedAt: now },
      new Date(now.getTime() + 60_000),
    ),
    view,
  );
  assert.equal(photoFromViewToken(viewToken, new Date(now.getTime() + 31 * 60_000)), null);
  // An upload link is not a photo address, the reverse neither, and a bare id never works.
  assert.equal(photoFromViewToken(token, now), null);
  assert.equal(subjectFromPhotoToken(viewToken, now), null);
  assert.equal(photoFromViewToken('cphoto000000000000000001', now), null);
});

test('AI requests never carry photos or photo data', async () => {
  // The system's only AI call is Zeni's Gemini composer: its request is text parts only.
  const bodies: string[] = [];
  const fetchSpy = (async (_url: string | URL | Request, init?: RequestInit) => {
    bodies.push(String(init?.body));
    return new Response(
      JSON.stringify({
        candidates: [{ content: { parts: [{ text: '{}' }] }, finishReason: 'STOP' }],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }) as typeof fetch;
  const compose = createGeminiComposer({
    env: { GEMINI_API_KEY: 'test-key-not-real' },
    fetch: fetchSpy,
    guard: createLlmRateGuard({ perMinute: 10, perDay: 100 }),
    timeoutMs: 50,
    deadlineMs: 5000,
  });
  await compose({
    mode: 'answer',
    question: 'Can I add my photo before my visit so your staff can recognize me?',
    language: 'en',
    sources: [
      {
        id: 'faq-photo',
        title: 'Arrival photo',
        href: '/faq',
        text: 'Adding a photo is optional and helps our team welcome you by name.',
      },
    ],
    recentTurns: [],
    knownNames: [],
  });
  assert.equal(bodies.length, 1);
  const request = JSON.parse(bodies[0]) as {
    systemInstruction: { parts: Record<string, unknown>[] };
    contents: { parts: Record<string, unknown>[] }[];
  };
  const parts = [
    ...request.systemInstruction.parts,
    ...request.contents.flatMap((content) => content.parts),
  ];
  assert.ok(parts.length > 0);
  assert.ok(parts.every((part) => Object.keys(part).join() === 'text'));
  assert.doesNotMatch(bodies[0], /inline_?data|file_?data|image\/|\/api\/client-photos\//i);

  // No AI module reads client photos, and no photo module calls an AI service. (There is no AI
  // check of payment screenshots in this system; the payment proof code calls no AI either.)
  const files = (directory: string): string[] =>
    readdirSync(directory).flatMap((name) => {
      const full = path.join(directory, name);
      return statSync(full).isDirectory() ? files(full) : /\.tsx?$/.test(name) ? [full] : [];
    });
  const aiCode = [...files('services/chatbot'), ...files('lib/chatbot')].filter(
    (file) => !file.endsWith('.test.ts'),
  );
  assert.ok(aiCode.some((file) => file.endsWith('gemini.ts')));
  for (const file of aiCode)
    assert.doesNotMatch(
      readFileSync(file, 'utf8'),
      /client-photo|clientPhoto|ClientPhoto|zion_client_photos/,
      file,
    );
  const photoCode = [
    'lib/client-photos.ts',
    'lib/client-photo-file.ts',
    'lib/client-photo-link.ts',
    'services/client-photos.ts',
    'lib/admin/client-photos.ts',
    'lib/automation/client-photos.ts',
    'app/api/client-photos/[token]/route.ts',
    'app/api/client/photos/route.ts',
    'app/api/admin/client-photos/route.ts',
    'components/client-photo/ClientPhotoCapture.tsx',
    'components/client-photo/browser-photo.ts',
    'components/admin/ClientPhoto.tsx',
    'lib/payment-proof-file.ts',
    'lib/admin/payment-proofs.ts',
  ];
  for (const file of photoCode)
    assert.doesNotMatch(
      readFileSync(file, 'utf8'),
      /gemini|chatbot|generativelanguage|openai|anthropic|llm/i,
      file,
    );
});

test(
  'client photos: who can see them, staff actions, retention and immediate deletion',
  { timeout: 180000 },
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
    await db.exec(sql.slice(sql.indexOf('-- CreateSchema')));
    const adminSql = readFileSync('prisma/admin.sql', 'utf8');
    await db.exec(adminSql.slice(adminSql.indexOf('-- Admin-only data')));
    // The installer must apply cleanly over the schema (idempotent, additive).
    await db.exec(readFileSync('prisma/client-photos.sql', 'utf8'));
    await db.exec(readFileSync('prisma/client-photos.sql', 'utf8'));
    const server = createServer(db, { logLevel: LogLevel.Error });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    process.env.DATABASE_URL = `postgresql://postgres@127.0.0.1:${address.port}/postgres`;
    process.env.DATABASE_POOL_MAX = '1';
    const { prisma } = await import('./prisma');
    const photos = await import('./client-photos');
    const service = await import('../services/client-photos');
    const automation = await import('./automation/client-photos');
    const adminPhotos = await import('./admin/client-photos');
    const { adminMutate, adminRead } = await import('./admin/service');
    const viewRoute = await import('../app/api/client-photos/[token]/route');
    const owner = {
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
      await prisma.$executeRawUnsafe("SET TIME ZONE 'Asia/Manila'");
      await prisma.user.create({
        data: {
          id: owner.id,
          username: owner.username,
          email: owner.email,
          role: owner.role,
          status: 'ACTIVE',
        },
      });
      const now = new Date();
      const booking = async (
        id: string,
        email: string,
        fields: { reservation?: string; startsAt?: Date; endsAt?: Date } = {},
      ) => {
        const startsAt = fields.startsAt ?? new Date(now.getTime() + 10 * DAY_MS);
        await prisma.adminBooking.create({
          data: {
            id,
            reference: `PHOTO-${id}`,
            clientName: `Client ${id}`,
            email,
            phone: '09170000000',
            eventType: 'Wedding',
            packageName: 'Zion Classic',
            venue: 'Garden Pavilion',
            startsAt,
            endsAt: fields.endsAt ?? new Date(startsAt.getTime() + 4 * 3_600_000),
            guests: 80,
            totalCents: 10_000_000,
            depositCents: 1_000_000,
            paymentRule: 'DEPOSIT_REQUIRED',
            policyVersion: 1,
            createdBy: 'qa',
            updatedBy: 'qa',
            approval: 'APPROVED',
            reservation: fields.reservation ?? 'CONFIRMED',
          },
        });
        return { kind: 'booking' as const, id };
      };
      const visit = async (
        id: string,
        email: string,
        fields: { status?: string; startsAt?: Date; cancelledAt?: Date } = {},
      ) => {
        const startsAt = fields.startsAt ?? new Date(now.getTime() + 5 * DAY_MS);
        await prisma.adminVisit.create({
          data: {
            id,
            reference: `VISIT-${id}`,
            clientName: `Visitor ${id}`,
            email,
            phone: '09170000000',
            startsAt,
            endsAt: new Date(startsAt.getTime() + 3_600_000),
            status: fields.status ?? 'SCHEDULED',
            cancelledAt: fields.cancelledAt ?? null,
          },
        });
        return { kind: 'visit' as const, id };
      };
      const upload = (token: string, photo: Blob | null, consent = true) => {
        const form = new FormData();
        form.set('token', token);
        form.set('website', '');
        if (consent) form.set('consent', 'yes');
        if (photo) form.set('photo', photo, 'photo.jpg');
        return new Request('http://localhost/api/client/photos', { method: 'POST', body: form });
      };
      const remove = (token: string) =>
        new Request('http://localhost/api/client/photos', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
      const rejects = (promise: Promise<unknown>, status: number, message: RegExp) =>
        assert.rejects(promise, (error: unknown) => {
          assert.ok(error instanceof service.ClientPhotoError);
          assert.equal(error.status, status);
          assert.match(error.message, message);
          return true;
        });
      const view = (url: string) =>
        viewRoute.GET(new Request(`http://localhost${url}`), {
          params: Promise.resolve({ token: url.split('/').pop()! }),
        });

      // Ana has a booking and a visit under one address (any capitals); Ben has his own booking.
      const anaBooking = await booking('cbookingana0000000000001', 'Ana.Cruz@Example.test');
      const anaVisit = await visit('cvisitana00000000000001', 'ana.cruz@example.test');
      const benBooking = await booking('cbookingben0000000000001', 'ben@example.test');
      const photo = blob(await jpegWithLocation());

      // Saving needs a genuine link, the consent box and a photo the server can read.
      const anaToken = photoLinkToken(anaBooking);
      await rejects(service.submitClientPhoto(upload(anaToken, photo, false)), 400, /Tick the box/);
      await rejects(
        service.submitClientPhoto(upload('b-cbookingana0000000000001.zz.bad', photo)),
        404,
        /expired/,
      );
      await rejects(
        service.submitClientPhoto(upload(anaToken, blob(new TextEncoder().encode('hello')))),
        400,
        /JPG, PNG or WebP/,
      );
      assert.equal(await prisma.adminClientPhoto.count(), 0);
      const saved = await service.submitClientPhoto(upload(anaToken, photo));
      assert.ok(saved.photoUrl?.startsWith('/api/client-photos/'));
      const row = await prisma.adminClientPhoto.findUniqueOrThrow({
        where: { email: 'ana.cruz@example.test' },
      });
      assert.equal(row.source, 'WEBSITE');
      assert.equal(row.consentVersion, 'arrival-photo-consent:v1');
      assert.equal((await sharp(Buffer.from(row.data)).metadata()).exif, undefined);

      // One photo per client: Ana's visit shows the same photo; Ben's page shows none of hers.
      const anaOnVisit = await service.clientPhotoFor(anaVisit);
      assert.ok(anaOnVisit?.photoUrl);
      assert.equal((await service.clientPhotoFor(benBooking))?.photoUrl, null);
      // Ben's link can add his own photo or remove his own, never Ana's.
      const benToken = photoLinkToken(benBooking);
      await service.removeClientPhoto(remove(benToken));
      assert.ok(
        await prisma.adminClientPhoto.findUnique({ where: { email: 'ana.cruz@example.test' } }),
      );

      // The photo leaves the server only through a genuine, unexpired signed address.
      const served = await view(saved.photoUrl!);
      assert.equal(served.status, 200);
      assert.equal(served.headers.get('content-type'), 'image/jpeg');
      assert.equal(served.headers.get('cache-control'), 'private, no-store');
      assert.equal(
        (await sharp(Buffer.from(await served.arrayBuffer())).metadata()).exif,
        undefined,
      );
      assert.equal((await view(`/api/client-photos/${row.id}`)).status, 404);
      assert.equal((await view(`${saved.photoUrl!.slice(0, -1)}x`)).status, 404);
      assert.equal((await view(`/api/client-photos/${anaToken}`)).status, 404);

      // Staff see the photo on the booking; a role without the permission gets no photo field.
      const read = (await adminRead(
        'bookings',
        new URLSearchParams({ id: anaBooking.id }),
        owner,
      )) as { booking: { clientPhoto?: { url: string; review: string } | null } };
      assert.ok(read.booking.clientPhoto?.url.startsWith('/api/client-photos/'));
      assert.equal(read.booking.clientPhoto?.review, 'UNREVIEWED');
      // A client account (not staff) never receives photo data through the admin.
      const hidden = await adminPhotos.withClientPhotos([{ email: 'ana.cruz@example.test' }], {
        role: 'CLIENT',
      });
      assert.equal('clientPhoto' in hidden[0], false);

      // "Ask for a new one" records the review and emails the photo link; so does a request.
      await adminMutate(
        { op: 'client-photo-review', subject: anaBooking, decision: 'RETAKE' },
        owner,
      );
      assert.equal(
        (
          await prisma.adminClientPhoto.findUniqueOrThrow({
            where: { email: 'ana.cruz@example.test' },
          })
        ).review,
        'RETAKE',
      );
      await adminMutate({ op: 'client-photo-request', subject: benBooking }, owner);
      const emails = await prisma.adminOutbox.findMany({
        where: { event: { startsWith: 'CLIENT_PHOTO_' } },
        orderBy: { event: 'asc' },
      });
      assert.deepEqual(
        emails.map((email) => [email.event, email.recipient]),
        [
          ['CLIENT_PHOTO_REQUEST', 'ben@example.test'],
          ['CLIENT_PHOTO_RETAKE', 'ana.cruz@example.test'],
        ],
      );
      assert.ok(emails.every((email) => email.body.includes('https://zion.example.test/photo/')));
      // A photo is never attached to or embedded in an email.
      assert.ok(
        emails.every((email) => !/\/api\/client-photos\//.test(`${email.body}${email.html}`)),
      );
      await assert.rejects(
        adminMutate({ op: 'client-photo-review', subject: benBooking, decision: 'OK' }, owner),
        /no photo to review/,
      );

      // Removing the photo (or withdrawing consent) deletes it at once and is logged.
      await service.removeClientPhoto(remove(anaToken));
      assert.equal(
        await prisma.adminClientPhoto.count({ where: { email: 'ana.cruz@example.test' } }),
        0,
      );
      assert.equal((await view(saved.photoUrl!)).status, 404);
      const logged = await prisma.auditLog.findMany({
        where: { module: 'Client photos' },
        select: { action: true, description: true },
      });
      // Added, asked for a new one, requested from Ben, removed.
      assert.deepEqual(logged.map((entry) => entry.action).sort(), [
        'FILE_DELETE',
        'FILE_UPLOAD',
        'UPDATE',
        'UPDATE',
      ]);
      assert.ok(logged.every((entry) => !entry.description.includes('@')));

      // A photo staff take at the venue needs the client's consent and is recorded as theirs.
      const staffForm = (consent: boolean) => {
        const form = new FormData();
        form.set('kind', 'booking');
        form.set('id', benBooking.id);
        if (consent) form.set('consent', 'yes');
        form.set('photo', photo, 'photo.jpg');
        return new Request('http://localhost/api/admin/client-photos', {
          method: 'POST',
          body: form,
        });
      };
      await assert.rejects(
        adminPhotos.saveStaffClientPhoto(staffForm(false), owner),
        /consent box/,
      );
      const taken = await adminPhotos.saveStaffClientPhoto(staffForm(true), owner);
      assert.equal(taken.clientPhoto?.source, 'STAFF');

      // Front desk: today's event can be checked in once; its booking status never changes.
      const today = await booking('cbookingtoday00000000001', 'tina@example.test', {
        startsAt: new Date(now.getTime() - 3_600_000),
        endsAt: new Date(now.getTime() + 3 * 3_600_000),
      });
      await adminMutate({ op: 'event-check-in', id: today.id }, owner);
      await assert.rejects(
        adminMutate({ op: 'event-check-in', id: today.id }, owner),
        /already checked in/,
      );
      assert.equal(
        (await prisma.adminBooking.findUniqueOrThrow({ where: { id: today.id } })).reservation,
        'CONFIRMED',
      );
      const desk = (await adminRead('front-desk', new URLSearchParams(), owner)) as {
        eventsToday: { id: string; checkedInAt: string | null; clientPhoto?: unknown }[];
      };
      const arrival = desk.eventsToday.find((event) => event.id === today.id);
      assert.ok(arrival?.checkedInAt);
      assert.equal(arrival?.clientPhoto, null);

      // One reminder, three days before, only while there is no photo.
      const morning = new Date('2031-01-10T01:00:00Z'); // 9:00 in Manila
      await booking('cbookingremind000000001', 'rita@example.test', {
        startsAt: new Date('2031-01-13T02:00:00Z'),
      });
      await booking('cbookingremind000000002', 'ben@example.test', {
        startsAt: new Date('2031-01-13T06:00:00Z'),
      });
      assert.equal(await automation.scheduleClientPhotoReminders(morning), 1);
      assert.equal(await automation.scheduleClientPhotoReminders(morning), 0);
      assert.equal(
        await automation.scheduleClientPhotoReminders(new Date('2031-01-09T22:00:00Z')),
        0,
      );
      const reminder = await prisma.adminOutbox.findFirstOrThrow({
        where: { event: 'CLIENT_PHOTO_REMINDER' },
      });
      assert.equal(reminder.recipient, 'rita@example.test');

      // Retention: 30 days after the client's last event or visit ends, unless something is
      // still open; a photo added after that counts from when it was added.
      const later = new Date('2031-03-01T00:00:00Z');
      const daysBefore = (days: number) => new Date(later.getTime() - days * DAY_MS);
      const keep = async (email: string, consentAt: Date) =>
        prisma.adminClientPhoto.create({
          data: {
            email,
            clientName: email,
            data: new Uint8Array(row.data),
            width: row.width,
            height: row.height,
            sizeBytes: row.sizeBytes,
            sha256: row.sha256,
            consentAt,
            consentVersion: 'arrival-photo-consent:v1',
            source: 'WEBSITE',
          },
        });
      await booking('cbookingold000000000001', 'carl@example.test', {
        reservation: 'COMPLETED',
        startsAt: daysBefore(40.2),
        endsAt: daysBefore(40),
      });
      await keep('carl@example.test', daysBefore(60));
      await booking('cbookingrecent0000000001', 'dina@example.test', {
        reservation: 'COMPLETED',
        startsAt: daysBefore(10.2),
        endsAt: daysBefore(10),
      });
      await keep('dina@example.test', daysBefore(60));
      await booking('cbookingopen00000000001', 'emil@example.test', {
        startsAt: new Date(later.getTime() + 20 * DAY_MS),
      });
      await keep('emil@example.test', daysBefore(200));
      await visit('cvisitcancel00000000001', 'faye@example.test', {
        status: 'CANCELLED',
        startsAt: daysBefore(44),
        cancelledAt: daysBefore(45),
      });
      await keep('faye@example.test', daysBefore(50));
      await keep('gil@example.test', daysBefore(40));
      await booking('cbookinglate000000000001', 'hana@example.test', {
        reservation: 'COMPLETED',
        startsAt: daysBefore(40.2),
        endsAt: daysBefore(40),
      });
      await keep('hana@example.test', daysBefore(5));
      assert.equal(await automation.deleteExpiredPhotos(later), 3);
      const remaining = (await prisma.adminClientPhoto.findMany({ select: { email: true } }))
        .map((entry) => entry.email)
        .sort();
      for (const gone of ['carl@example.test', 'faye@example.test', 'gil@example.test'])
        assert.ok(!remaining.includes(gone), gone);
      for (const kept of ['dina@example.test', 'emil@example.test', 'hana@example.test'])
        assert.ok(remaining.includes(kept), kept);
      const retentionLog = await prisma.auditLog.findFirstOrThrow({
        where: { module: 'Client photos', userRole: 'SYSTEM' },
      });
      assert.match(retentionLog.description, /Deleted 3 client photos 30 days after/);
      assert.equal(await photos.deleteExpiredClientPhotos(later, 30), 0);
    } finally {
      await prisma.$disconnect();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await db.close();
    }
  },
);
