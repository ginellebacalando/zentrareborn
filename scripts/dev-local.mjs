// Local development: the whole site, Zeni and the admin panel on an embedded PostgreSQL (PGlite)
// filled with clearly labeled demo data. It never connects to Supabase or any remote database,
// sends no email and needs no secrets.
//
//   npm run dev:local              start on http://localhost:3002
//   npm run dev:local -- --reset   rebuild the local database from scratch
//
// The database lives in .local/ (ignored by Git) and is rebuilt automatically whenever the schema
// files change. The demo staff sign-in is generated per computer and saved in
// .local/DEMO-ADMIN-SIGN-IN.txt; it exists only in this local database.
import { PGlite } from '@electric-sql/pglite';
import { createServer, LogLevel } from 'pglite-server';
import bcrypt from 'bcryptjs';
import { execFileSync, spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Staff account that exists only inside the local demo database (password: see localSecrets). */
const DEMO_ADMIN = { email: 'owner@zentra.test', name: 'Demo Owner' };
/** Bump when the demo data below changes so existing local databases are rebuilt. */
const SEED_VERSION = 'seed-2026-11-25-6';

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
const localDir = path.join(root, '.local');
const dataDir = path.join(localDir, 'pgdata');
const appPort = Number(process.env.DEV_LOCAL_PORT || 3002);
const appUrl = `http://localhost:${appPort}`;

function sqlFiles() {
  return readdirSync('prisma')
    .filter((file) => file.endsWith('.sql'))
    .sort((a, b) => (a === 'admin.sql' ? -1 : b === 'admin.sql' ? 1 : a.localeCompare(b)))
    .map((file) => path.join('prisma', file));
}

function schemaFingerprint() {
  const hash = createHash('sha256').update(SEED_VERSION);
  for (const file of [path.join('prisma', 'schema.prisma'), ...sqlFiles()]) {
    hash.update(file).update(readFileSync(file));
  }
  return hash.digest('hex');
}

/** Per-computer secrets for the local preview, kept in the ignored .local/ folder. */
function localSecrets() {
  mkdirSync(localDir, { recursive: true });
  const file = path.join(localDir, 'secrets.json');
  const stored = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
  const secrets = {
    authSecret: stored.authSecret ?? randomBytes(48).toString('hex'),
    cronSecret: stored.cronSecret ?? randomBytes(32).toString('hex'),
    demoAdminPassword: stored.demoAdminPassword ?? `Zentra-${randomBytes(9).toString('base64url')}`,
  };
  writeFileSync(file, `${JSON.stringify(secrets, null, 2)}\n`);
  writeFileSync(
    path.join(localDir, 'DEMO-ADMIN-SIGN-IN.txt'),
    `Local demo admin (exists only in this computer's demo database)\nEmail: ${DEMO_ADMIN.email}\nPassword: ${secrets.demoAdminPassword}\n`,
  );
  return secrets;
}

function firstImage(folder) {
  const directory = path.join('public', 'images', folder);
  if (!existsSync(directory)) return null;
  const file = readdirSync(directory)
    .filter((name) => /\.(webp|jpe?g|png)$/i.test(name))
    .sort()[0];
  return file ? `/images/${folder}/${file}` : null;
}

/** Manila is UTC+8 without daylight saving; returns a UTC Date for a local wall-clock time. */
function manilaDate(dayOffset, hour, minute = 0) {
  const now = new Date();
  const manilaToday = new Date(now.getTime() + 8 * 3600_000);
  return new Date(
    Date.UTC(
      manilaToday.getUTCFullYear(),
      manilaToday.getUTCMonth(),
      manilaToday.getUTCDate() + dayOffset,
      hour - 8,
      minute,
    ),
  );
}

async function buildSchema(db) {
  const schemaSql = execFileSync(
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
    {
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      env: { ...process.env, DATABASE_URL: 'postgresql://local@127.0.0.1:5432/local' },
    },
  );
  await db.exec(schemaSql.slice(schemaSql.indexOf('-- CreateSchema')));
  for (const file of sqlFiles()) {
    const sql = readFileSync(file, 'utf8');
    // schema.prisma already creates the admin tables; admin.sql adds their protections.
    const marker = '-- Admin-only data';
    await db.exec(file.endsWith('admin.sql') ? sql.slice(sql.indexOf(marker)) : sql);
  }
}

const EVENT_TYPES = [
  {
    key: 'wedding',
    slug: 'wedding-reception',
    name: 'Weddings',
    folder: 'events/weddings',
    packages: [
      ['Classic Wedding', 150000, 100],
      ['Grand Wedding', 240000, 150],
    ],
  },
  {
    key: 'debut',
    slug: 'debut',
    name: 'Debuts',
    folder: 'events/debuts-birthdays',
    packages: [
      ['Classic Debut', 95000, 80],
      ['Premier Debut', 140000, 120],
    ],
  },
  {
    key: 'christening',
    slug: 'christening',
    name: 'Christening',
    folder: 'events/christenings',
    packages: [['Christening Celebration', 60000, 60]],
  },
  {
    key: 'birthday',
    slug: 'birthday',
    name: 'Birthdays',
    folder: 'events/debuts-birthdays',
    packages: [
      ['Kids Birthday', 45000, 50],
      ['Milestone Birthday', 85000, 80],
    ],
  },
  {
    key: 'gender-reveal',
    slug: 'gender-reveal',
    name: 'Gender Reveal',
    folder: 'events/gender-reveals',
    packages: [['Gender Reveal Party', 50000, 50]],
  },
  {
    key: 'christmas-party',
    slug: 'christmas-party',
    name: 'Christmas Party',
    folder: 'events/holidays',
    packages: [['Company Christmas Party', 120000, 120]],
  },
];

const DEMO_NOTE = 'Local demo data. Replace with Zion Events Place published rates.';

async function seed(db, demoAdminPassword) {
  const now = new Date();
  const passwordHash = await bcrypt.hash(demoAdminPassword, 12);
  await db.query(
    `INSERT INTO users (id, username, email, password_hash, full_name, role, status, "createdAt", "updatedAt")
     VALUES ('demo-owner', 'demo-owner', $1, $2, $3, 'SUPERADMIN', 'ACTIVE', $4, $4)`,
    [DEMO_ADMIN.email, passwordHash, DEMO_ADMIN.name, now],
  );

  for (const [categoryIndex, type] of EVENT_TYPES.entries()) {
    const categoryId = `demo-category-${type.key}`;
    const cover = firstImage(type.folder);
    await db.query(
      `INSERT INTO event_categories (id, name, slug, category_key, description, cover_image_url, display_order, status, client_visible, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', true, $8)`,
      [categoryId, type.name, type.slug, type.key, DEMO_NOTE, cover, categoryIndex, now],
    );
    for (const [packageIndex, [packageName, price, pax]] of type.packages.entries()) {
      const packageId = `demo-package-${type.key}-${packageIndex + 1}`;
      const slug = packageName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const inclusions = [
        'Venue use for 6 hours',
        'Tables, chairs and linens',
        'Basic lights and sound',
        'Event coordinator on the day',
      ];
      await db.query(
        `INSERT INTO packages (id, event_category_id, package_name, slug, description, price, currency, pax_included,
           excess_pax_fee, reservation_fee, down_payment_amount, full_payment_amount, check_in_time, check_out_time,
           package_image_url, status, client_visible, current_version, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'PHP', $7, 450, 5000, $8, $6, '10:00 AM', '4:00 PM', $9, 'active', true, 1, $10)`,
        [
          packageId,
          categoryId,
          packageName,
          slug,
          DEMO_NOTE,
          price,
          pax,
          Math.round(price * 0.3),
          cover,
          now,
        ],
      );
      for (const [inclusionIndex, inclusionName] of inclusions.entries()) {
        await db.query(
          `INSERT INTO package_inclusions (id, package_id, inclusion_name, display_order, updated_at)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            `${packageId}-inclusion-${inclusionIndex + 1}`,
            packageId,
            inclusionName,
            inclusionIndex,
            now,
          ],
        );
      }
      await db.query(
        `INSERT INTO package_versions (id, package_id, version_number, snapshot_data, change_summary)
         VALUES ($1, $2, 1, $3, 'Local demo data')`,
        [
          `${packageId}-v1`,
          packageId,
          JSON.stringify({
            packageName,
            description: DEMO_NOTE,
            price,
            currency: 'PHP',
            paxIncluded: pax,
            excessPaxFee: 450,
            reservationFee: 5000,
            checkInTime: '10:00 AM',
            checkOutTime: '4:00 PM',
            packageImageUrl: cover,
            inclusions: inclusions.map((inclusionName) => ({ inclusionName })),
          }),
        ],
      );
    }
  }

  const testimonies = [
    [
      'Andrea M.',
      'Wedding',
      'Classic Wedding',
      5,
      'The view at sunset was unreal and the team kept everything on schedule. Our guests still talk about it.',
    ],
    [
      'Paolo R.',
      'Debut',
      'Premier Debut',
      5,
      'Smooth from the ocular visit to the last dance. The staff answered every question quickly.',
    ],
    [
      'Liza C.',
      'Christening',
      'Christening Celebration',
      4,
      'Clean venue, calm coordinators and a lovely garden for photos.',
    ],
    [
      'Mark D.',
      'Birthday',
      'Milestone Birthday',
      5,
      'Great sound, great food partners and a beautiful hall. Highly recommended.',
    ],
  ];
  for (const [
    index,
    [clientName, eventType, packageName, rating, comment],
  ] of testimonies.entries()) {
    const eventDate = manilaDate(-30 * (index + 1), 10);
    await db.query(
      `INSERT INTO testimonies (id, client_name, event_type, event_date, package_name, overall_rating, approach_rating,
         food_rating, service_rating, venue_rating, communication_rating, comment, status, is_public, is_featured,
         submitted_at, approved_by, approved_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $6, $6, $6, $6, $6, $7, 'approved', true, true, $4, 'demo-owner', $4, $8)`,
      [
        `demo-testimony-${index + 1}`,
        clientName,
        eventType,
        eventDate,
        packageName,
        rating,
        `${comment} (Demo review)`,
        now,
      ],
    );
  }

  await db.query(
    `INSERT INTO zion_admin_policy (id, reviewed, "paymentRule", version, "updatedBy", "updatedAt")
     VALUES ('venue', true, 'DEPOSIT_REQUIRED', 1, 'demo-owner', $1)`,
    [now],
  );

  // [reference, client, eventType, package, dayOffset, guests, totalPesos, approval, verification, reservation]
  const bookings = [
    [
      'ZEP-DEMO-1001',
      'Santos Family',
      'Wedding',
      'Classic Wedding',
      5,
      120,
      150000,
      'APPROVED',
      'VERIFIED',
      'CONFIRMED',
    ],
    [
      'ZEP-DEMO-1002',
      'Reyes Family',
      'Debut',
      'Premier Debut',
      9,
      110,
      140000,
      'APPROVED',
      'UNREVIEWED',
      'REQUESTED',
    ],
    [
      'ZEP-DEMO-1003',
      'Cruz Family',
      'Christening',
      'Christening Celebration',
      12,
      55,
      60000,
      'PENDING',
      'UNREVIEWED',
      'REQUESTED',
    ],
    [
      'ZEP-DEMO-1004',
      'Garcia Family',
      'Birthday',
      'Milestone Birthday',
      16,
      75,
      85000,
      'APPROVED',
      'VERIFIED',
      'CONFIRMED',
    ],
    [
      'ZEP-DEMO-1005',
      'Lim Family',
      'Gender Reveal',
      'Gender Reveal Party',
      20,
      45,
      50000,
      'APPROVED',
      'UNREVIEWED',
      'CANCELLED',
    ],
    [
      'ZEP-DEMO-1006',
      'Mendoza Family',
      'Wedding',
      'Grand Wedding',
      27,
      150,
      240000,
      'PENDING',
      'UNREVIEWED',
      'REQUESTED',
    ],
    [
      'ZEP-DEMO-1007',
      'Northwind Corp.',
      'Christmas Party',
      'Company Christmas Party',
      33,
      110,
      120000,
      'APPROVED',
      'VERIFIED',
      'CONFIRMED',
    ],
    [
      'ZEP-DEMO-1008',
      'Bautista Family',
      'Christening',
      'Christening Celebration',
      3,
      50,
      60000,
      'APPROVED',
      'VERIFIED',
      'REQUESTED',
    ],
    [
      'ZEP-DEMO-1009',
      'Aquino Family',
      'Birthday',
      'Kids Birthday',
      -10,
      40,
      45000,
      'APPROVED',
      'VERIFIED',
      'COMPLETED',
    ],
  ];
  for (const [index, row] of bookings.entries()) {
    const [
      reference,
      clientName,
      eventType,
      packageName,
      day,
      guests,
      totalPesos,
      approval,
      verification,
      reservation,
    ] = row;
    const id = `demo-booking-${index + 1}`;
    const totalCents = totalPesos * 100;
    const depositCents = Math.round(totalCents * 0.3);
    const startsAt = manilaDate(day, 10);
    const endsAt = manilaDate(day, 16);
    await db.query(
      `INSERT INTO zion_admin_bookings (id, reference, "clientName", email, phone, "eventType", "packageName", venue,
         "startsAt", "endsAt", guests, "totalCents", "depositCents", "paymentRule", approval, reservation, verification,
         notes, "policyVersion", "createdBy", "updatedBy", "updatedAt")
       VALUES ($1, $2, $3, $4, '0917 000 0000', $5, $6, 'Zion Events Place', $7, $8, $9, $10, $11, 'DEPOSIT_REQUIRED',
         $12, $13, $14, 'Local demo booking.', 1, 'demo-owner', 'demo-owner', $15)`,
      [
        id,
        reference,
        clientName,
        `client${index + 1}@example.test`,
        eventType,
        packageName,
        startsAt,
        endsAt,
        guests,
        totalCents,
        depositCents,
        approval,
        reservation,
        verification,
        now,
      ],
    );
    // History the dashboard KPIs read (docs/dashboard-kpi-contract.md): the CREATE audit entry and,
    // for secured bookings, the first RESERVATION_CONFIRMED outbox event. The outbox rows are marked
    // EXPIRED (skipped), so the automation never tries to email this demo history.
    const createdAt = manilaDate(Math.min(day, 0) - 45 + index, 11);
    await db.query(
      `INSERT INTO audit_logs (id, "timestamp", user_id, user_name, user_role, action, module, description, status, metadata, source)
       VALUES ($1, $2, 'demo-owner', $3, 'SUPERADMIN', 'CREATE', 'Bookings', $4, 'SUCCESS', $5, 'zion-admin')`,
      [
        `demo-audit-create-${index + 1}`,
        createdAt,
        DEMO_ADMIN.name,
        `Created staff-entered request ${reference}. No date or payment confirmed.`,
        JSON.stringify({ bookingId: id, sourceInquiryId: null }),
      ],
    );
    if (reservation === 'CONFIRMED' || reservation === 'COMPLETED') {
      const confirmedAt = manilaDate(Math.min(day, 0) - 20 + index, 15);
      await db.query(
        `INSERT INTO zion_admin_outbox (id, "bookingId", event, recipient, subject, body, status, attempts,
           "nextAttemptAt", "createdAt", "idempotencyKey")
         VALUES ($1, $2, 'RESERVATION_CONFIRMED', $3, 'Reservation confirmed', 'Local demo history; never sent.',
           'EXPIRED', 0, $4, $4, $5)`,
        [
          `demo-outbox-${index + 1}`,
          id,
          `client${index + 1}@example.test`,
          confirmedAt,
          `demo-confirmed:${id}`,
        ],
      );
    }
    if (verification === 'VERIFIED') {
      await db.query(
        `INSERT INTO zion_admin_cash_payments (id, "bookingId", "receiptNumber", "amountCents", "receivedAt", "recordedBy", note)
         VALUES ($1, $2, $3, $4, $5, 'demo-owner', 'Local demo deposit.')`,
        [`demo-payment-${index + 1}`, id, `OR-DEMO-${1001 + index}`, depositCents, now],
      );
    }
  }

  const inquiries = [
    ['Jasmine T.', 'Is the garden available for an evening wedding in March?', 'Wedding', 'new'],
    ['Carlo V.', 'Pwede po ba mag-ocular visit this Saturday?', 'Debut', 'new'],
    ['Nina P.', 'What is included in the christening package?', 'Christening', 'answered'],
  ];
  for (const [index, [fullName, message, eventInterest, status]] of inquiries.entries()) {
    const submittedAt = manilaDate(-index, 9 + index);
    await db.query(
      `INSERT INTO inquiries (id, inquiry_reference, full_name, email, message, event_interest, source_page, status,
         submitted_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'contact_us', $7, $8, $8)`,
      [
        `demo-inquiry-${index + 1}`,
        `INQ-DEMO-${2001 + index}`,
        fullName,
        `guest${index + 1}@example.test`,
        `${message} (Demo inquiry)`,
        eventInterest,
        status,
        submittedAt,
      ],
    );
  }
}

async function openDatabase(demoAdminPassword) {
  mkdirSync(localDir, { recursive: true });
  const fingerprintFile = path.join(localDir, 'schema-fingerprint');
  const fingerprint = schemaFingerprint();
  const stale =
    !existsSync(fingerprintFile) || readFileSync(fingerprintFile, 'utf8').trim() !== fingerprint;
  if (process.argv.includes('--reset') || stale) {
    if (existsSync(dataDir))
      console.log('Schema or demo data changed: rebuilding the local database…');
    rmSync(dataDir, { recursive: true, force: true });
  }
  const fresh = !existsSync(path.join(dataDir, 'PG_VERSION'));
  const db = new PGlite(dataDir);
  await db.waitReady;
  // PGlite inherits the computer's time zone (UTC+8 here); Supabase runs in UTC, and the app stores
  // timestamp-without-time-zone values as UTC. Pin the session and the database to UTC.
  await db.exec(`SET TIME ZONE 'UTC'; ALTER DATABASE postgres SET timezone TO 'UTC';`);
  if (fresh) {
    console.log('Creating the local demo database (first run takes a minute)…');
    await buildSchema(db);
    await seed(db, demoAdminPassword);
    writeFileSync(fingerprintFile, fingerprint);
  }
  return db;
}

if (!existsSync(path.join('public', 'fonts', 'licensed', 'fonts.css'))) {
  execFileSync(process.execPath, ['scripts/install-licensed-fonts.mjs'], { stdio: 'inherit' });
}

const secrets = localSecrets();
const db = await openDatabase(secrets.demoAdminPassword);
const pgServer = createServer(db, { logLevel: LogLevel.Error });
await new Promise((resolve) => pgServer.listen(0, '127.0.0.1', resolve));
const databaseUrl = `postgresql://postgres@127.0.0.1:${pgServer.address().port}/postgres`;

const child = spawn(
  process.execPath,
  [
    'node_modules/next/dist/bin/next',
    'dev',
    '--webpack',
    '--hostname',
    '127.0.0.1',
    '--port',
    String(appPort),
  ],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'development',
      DATABASE_URL: databaseUrl,
      DIRECT_URL: databaseUrl,
      DATABASE_POOL_MAX: '1',
      AUTH_SECRET: secrets.authSecret,
      AUTH_URL: appUrl,
      NEXT_PUBLIC_APP_URL: appUrl,
      CRON_SECRET: secrets.cronSecret,
      // Demo data uses example.test addresses. Real sending is opt-in (`-- --send-email`), so Gmail
      // settings in .env.local never send mail from the local demo by accident (Next does not
      // override variables that are already set, even when empty).
      ...(process.argv.includes('--send-email') ? {} : { SMTP_USER: '', SMTP_PASSWORD: '' }),
    },
  },
);

console.log(
  `\nZENTRA local preview: ${appUrl}  (admin: ${appUrl}/admin, sign-in in .local/DEMO-ADMIN-SIGN-IN.txt)\n` +
    'Local demo database only; nothing here touches Supabase or sends email.\n',
);

let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  child.kill();
  pgServer.close();
  await db.close();
  process.exit();
}
process.on('SIGINT', close);
process.on('SIGTERM', close);
child.on('exit', close);
