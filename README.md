# ZENTRA — Zion Events Place web system

ZENTRA is the website, booking journey, "Zeni" concierge and staff admin panel for Zion Events Place, styled after the team's Figma file. This folder is the client-facing application. It preserves the public design, event-package browsing, contact inquiry journey, managed public content, testimonials, client API handlers, database access, and the bundled media used by those experiences.

## Boundary

The public application includes **Ask Zion**, a [source-based visitor chatbot](docs/chatbot.md). Online booking, online payments, and the legacy Smart Assistant remain excluded. Staff operations are isolated under `/admin`. The independent developer Command Center under `/developer` manages connections, task templates, assistant knowledge, governed public content, developer access, and audit records, and shows a read-only automation status. Developer access is disabled until explicitly provisioned; client and staff accounts do not grant developer permissions. See [developer setup and production ingress](docs/developer-panel.md).

Run `npm run check:client-boundary` to verify the separation.

The application follows the architecture and dependency rules in [`docs/architecture.md`](docs/architecture.md). Run `npm run check:hygiene` to enforce its filesystem conventions.

## Local setup

1. Install dependencies with `npm ci`.
2. Copy `.env.example` to `.env.local` and provide the client runtime values.
3. Generate the Prisma client with `npm run db:generate`.
4. Start the app with `npm run dev`, then open `http://localhost:3001`.

Zentra Web uses port **3001** for both `npm run dev` and `npm start` (after a production build). Keep `NEXT_PUBLIC_APP_URL`, `AUTH_URL`, and the local `DEVELOPER_ORIGIN` set to `http://localhost:3001`. The admin panel is at `http://localhost:3001/admin`.

## Local preview (no Supabase needed)

`npm run dev:local` starts the whole system on <http://localhost:3002> with an embedded PostgreSQL
(PGlite) stored in `.local/` and clearly labeled demo data: event categories and packages, reviews,
bookings across every status, and inquiries. It never connects to Supabase, sends no email and
needs no secrets. The database rebuilds itself when the schema files change; add `-- --reset` to
start over. The demo staff sign-in for `/admin` is generated on first run and saved in the ignored `.local/DEMO-ADMIN-SIGN-IN.txt`; it
exists only in that local database. Email stays off in the local preview even when `.env.local` has Gmail settings; pass `-- --send-email` to test real sending.

## Shared online preview (Vercel + Supabase staging)

The team preview runs on Vercel's free Hobby plan against the `zentra-staging` Supabase project.
Every push to `main` redeploys it.

1. Put the staging connection strings in `.env.local`: `DATABASE_URL` (port 6543 with
   `pgbouncer=true`) and `DIRECT_URL` (port 5432).
2. `npm run db:demo:setup` checks the database. `npm run db:demo:setup -- --apply --allow-remote`
   fills an **empty** database with every table and the local preview's demo content (labeled
   "Demo"), enables row-level security on every table and removes the Supabase Data API roles'
   access. It refuses any database that already has tables. The online staff sign-in is saved in
   the ignored `.local/HOSTED-ADMIN-SIGN-IN.txt`.
3. Import the repository in Vercel and add `DATABASE_URL`, `AUTH_SECRET`, `RECEPTIONIST_STATE_KEY`
   and `CRON_SECRET`. Leave `AUTH_URL` unset on Vercel: Auth.js and the admin origin check then use
   the address being visited, so staff sign-in works on every Vercel link. Links in emails use
   Vercel's production domain on their own; set `NEXT_PUBLIC_APP_URL` only for a custom domain.
   Gmail (`SMTP_*`) and `GEMINI_API_KEY` are optional: without them email stays queued and Zeni
   uses its built-in answers. See the checklist below to turn them on.

### Turning on email, calendar invitations and Zeni's AI

Each value goes in Vercel: open the project, then Settings, Environment Variables (Production),
save, and redeploy. Never put them in Git or in chat.

1. **Email (Gmail):** turn on 2-Step Verification for the venue's Gmail account, create an App
   Password (Google Account, Security, App passwords), then add `SMTP_USER` (the Gmail address)
   and `SMTP_PASSWORD` (the 16-character App Password). `MAIL_FROM` is optional. Admin, Automation
   then shows Configured, and waiting emails go out on the next run.
2. **Owner and staff calendars:** in Admin, Settings, Communications, enter up to five addresses
   under "Staff notification emails". Each booking request appears in their calendars at once as
   a "[Pending]" event; confirming it turns the event into the reservation, and declining or
   cancelling removes it. In Google Calendar, Settings, Event settings, "Add invitations to my
   calendar" decides whether an event appears on its own ("From everyone" adds them all).
3. **Zeni's AI phrasing:** create a key in Google AI Studio and add it as `GEMINI_API_KEY`
   (`GEMINI_MODEL` is optional). Admin, Zeni then shows the key as Configured.

When a feature adds tables to an already-filled database, install them before pushing the code
that uses them. Live chat, for example: `npm run db:live-chat:check` checks, and
`npm run db:live-chat:check -- --apply --allow-remote` adds `prisma/live-chat.sql` without changing
existing data.

`vercel.json` runs the functions in Singapore (`sin1`), next to the Supabase region, and schedules
the daily automation run. Vercel's Hobby plan is for non-commercial use, so move to a paid plan
before the site serves the business.

## Fonts

The team plan uses **SFT Schrifted Sans** for all text and **Zenitha Classic** for the ZENTRA
wordmark. Those files are a trial and a personal-use version, so they are not in Git. On a team
machine run `npm run fonts:licensed -- --from <folder with sft_schrifted_sans/ and zenitha_classic/>`
(the local preview runs it automatically when it finds the folders); the files land in the ignored
`public/fonts/licensed/` and the layout loads them. Every other build, including Vercel, uses the
bundled open-license fallbacks Archivo and Cinzel Decorative (the closest free match to Zenitha's
swash capitals). Buy the licenses before using the original fonts on the public website.

## Email automation

Notifications (inquiry alerts and acknowledgements, booking decisions with calendar invitations, event reminders and a daily staff digest) are built in: each is saved to a database outbox with the business change and delivered through Gmail SMTP. Without `SMTP_USER` and `SMTP_PASSWORD` everything stays queued and nothing is reported as sent. See [the automation guide](docs/automation.md) for the Gmail App Password, `CRON_SECRET`, the Vercel and Supabase schedulers, and the admin Automation page.

- `npm run db:automation:check` checks the additive automation schema; add `-- --apply` to install `prisma/automation.sql`.
- `npm run db:booking-holds:check` checks the booking automation column ([docs/booking-automation.md](docs/booking-automation.md)); add `-- --apply` to install `prisma/booking-holds.sql`.
- `npm run automation:run` performs one automation run from the command line.
- `npm run test:automation` tests the outbox, delivery, scheduling, calendar invitations and cron authorization without contacting a mail server.

The included Prisma schema reflects the existing shared database contract. This extraction does not include database migrations, so it cannot accidentally take ownership of administrator-side database evolution. The only seed, `npm run db:demo:setup`, fills an empty test database and refuses any database that already has tables.

## Verification

The [design and engineering standard](docs/design-standard.md) and `AGENTS.md` govern the current system and all future updates. Shared design tokens live in `styles/tokens.css`. Use `npm run format` before verification; `npm run format:check` and `npm run check:design` enforce source consistency and prevent new visual exceptions. See [the change log](docs/design-change-log.md) for verified scope and remaining review work.

- `npm run check:client-boundary` checks forbidden panel paths/imports and missing static media references.
- `npm run check:hygiene` checks the standard project layout and rejects tracked generated artifacts.
- `npm run typecheck` validates TypeScript.
- `npm run test` checks the legacy feature boundaries and runs chatbot, admin, and developer tests.
- `npm run test:chatbot` verifies visitor answers, request validation, and public-source boundaries in an isolated test database.
- `npm run lint` runs Next.js, accessibility, and dependency-boundary rules with zero warnings allowed.
- `npm run build` creates the production bundle.
- `npm run verify` runs the full sequence.
