// Shared by scripts/dev-local.mjs (local PGlite preview) and scripts/setup-demo-database.mjs (an
// empty hosted test database such as zentra-staging). Builds the full schema and fills it with
// clearly labeled demo content. Not a runnable script on its own.
//
// `db` is anything with `exec(sql)` for multi-statement SQL and `query(sql, params)`: a PGlite
// instance, or a node-postgres client wrapped by the caller.
import bcrypt from 'bcryptjs';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

/** Staff account that exists only inside a demo database; the caller generates its password. */
export const DEMO_ADMIN = { email: 'owner@zentra.test', name: 'Demo Owner' };
/** Bump when the demo data below changes so existing local databases are rebuilt. */
export const SEED_VERSION = 'seed-2026-11-25-6';

/** Additive SQL files, admin.sql first. Paths stay repo-relative: the local fingerprint hashes them. */
export function sqlFiles() {
  return readdirSync(path.join(root, 'prisma'))
    .filter((file) => file.endsWith('.sql'))
    .sort((a, b) => (a === 'admin.sql' ? -1 : b === 'admin.sql' ? 1 : a.localeCompare(b)))
    .map((file) => path.join('prisma', file));
}

function firstImage(folder) {
  const directory = path.join(root, 'public', 'images', folder);
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

/** Creates every table: Prisma's schema first, then the additive SQL files. */
export async function buildSchema(db) {
  const schemaSql = execFileSync(
    process.execPath,
    [
      path.join(root, 'node_modules', 'prisma', 'build', 'index.js'),
      'migrate',
      'diff',
      '--from-empty',
      '--to-schema',
      'prisma/schema.prisma',
      '--script',
    ],
    {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      // `migrate diff --from-empty` never connects; prisma.config.ts only needs a URL to load.
      // Both names are set so the real connection strings in .env.local never reach Prisma here.
      env: {
        ...process.env,
        DATABASE_URL: 'postgresql://local@127.0.0.1:5432/local',
        DIRECT_URL: 'postgresql://local@127.0.0.1:5432/local',
      },
    },
  );
  await db.exec(schemaSql.slice(schemaSql.indexOf('-- CreateSchema')));
  for (const file of sqlFiles()) {
    const sql = readFileSync(path.join(root, file), 'utf8');
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

/**
 * Fills a freshly built schema with demo content. `label` prefixes every demo note ("Local demo"
 * for the local preview, "Demo" for a shared test database) so staff can tell it is not real.
 */
export async function seed(db, { adminPassword, label = 'Local demo' }) {
  const now = new Date();
  const note = `${label} data. Replace with Zion Events Place published rates.`;
  const passwordHash = await bcrypt.hash(adminPassword, 12);
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
      [categoryId, type.name, type.slug, type.key, note, cover, categoryIndex, now],
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
          note,
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
         VALUES ($1, $2, 1, $3, $4)`,
        [
          `${packageId}-v1`,
          packageId,
          JSON.stringify({
            packageName,
            description: note,
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
          `${label} data`,
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
         $12, $13, $14, $16, 1, 'demo-owner', 'demo-owner', $15)`,
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
        `${label} booking.`,
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
         VALUES ($1, $2, 'RESERVATION_CONFIRMED', $3, 'Reservation confirmed', $6,
           'EXPIRED', 0, $4, $4, $5)`,
        [
          `demo-outbox-${index + 1}`,
          id,
          `client${index + 1}@example.test`,
          confirmedAt,
          `demo-confirmed:${id}`,
          `${label} history; never sent.`,
        ],
      );
    }
    if (verification === 'VERIFIED') {
      await db.query(
        `INSERT INTO zion_admin_cash_payments (id, "bookingId", "receiptNumber", "amountCents", "receivedAt", "recordedBy", note)
         VALUES ($1, $2, $3, $4, $5, 'demo-owner', $6)`,
        [
          `demo-payment-${index + 1}`,
          id,
          `OR-DEMO-${1001 + index}`,
          depositCents,
          now,
          `${label} deposit.`,
        ],
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
