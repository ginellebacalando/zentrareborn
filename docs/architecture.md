# Client application architecture

Zion Client Web uses the Next.js 16 App Router and a backend-for-frontend API layer.

## Layers

- `app/` contains routes, layouts, error boundaries, and route handlers. Route-specific implementation files live in underscore-prefixed private folders such as `_components` and `_providers`.
- `components/` contains reusable presentation components grouped by client feature, event packages, public content, layout, and shared primitives.
- `services/` contains server-side domain workflows and integrations. Service entry points are marked `server-only` so they cannot enter browser bundles.
- `lib/` contains shared infrastructure, validation, data access, and small framework-independent helpers.
- `config/` contains static application and brand configuration.
- `public/` contains the client media library and static assets.
- `prisma/` contains the existing database contract required to generate the client backend's Prisma types.

## Dependency direction

Routes may depend on components, services, lib, and config. Components may depend on other components, public-safe lib helpers, and config. Server services may depend on lib and config. Browser components must never import database, environment, or server service modules.

Public HTTP endpoints remain under `app/api/client/`, with `app/api/health/` for operational health. The separate authenticated staff workspace lives under `app/admin/`, `components/admin/`, `lib/admin/`, and `app/api/admin/`; Auth.js handlers live under `app/api/auth/`. These modules must not leak into public navigation or browser-safe client services. See [the admin implementation and feedback guide](admin-panel.md).

The independently authenticated developer control plane lives in `app/developer/`, `app/api/developer/`, `components/developer/`, `lib/developer/`, and `services/developer/`. Its accounts, sessions, MFA secrets, source revisions and audit records use the additive schema in `prisma/developer.sql`; administrator roles do not grant developer access. The panel follows the old Command Center feature groups, with a read-only automation status and a scoped published-knowledge feed. Server-only PostgreSQL access is isolated from Prisma development query logging. See [developer provisioning, production ingress and integration contracts](developer-panel.md).

The legacy public Smart Assistant, online booking, calendar intake, and payment/receipt routes remain intentionally removed. The separately authorized **Zeni** receptionist uses `components/chatbot/`, `lib/chatbot/`, `services/chatbot/`, and `/api/client/chatbot`; see [its source, privacy and operation contract](chatbot.md). It answers from published visitor sources, remembers request details in isolated encrypted tables in `prisma/receptionist.sql`, and creates a standard staff inquiry only after explicit visitor permission. A narrow server-only projection in `services/orchestration/receptionist-calendar.ts` reads a confirmed-conflict marker from the admin calendar for an explicit venue/time window. It exposes no staff calendar records or private event details. Reviewed recognized admin payment requirements have a bounded public-safe projection; arbitrary private instructions and developer documents remain excluded.

Zeni never creates, changes or cancels a booking itself: a new-booking intent becomes a pre-filled link to the booking page (`app/booking/_components/bookingPrefill.ts`), a visit request becomes a pre-filled contact form, and reschedule or cancellation requests go to staff through the standard inquiry hand-off. Optional LLM phrasing (Gemini) only rewords answers grounded in published sources, after personal details are redacted. The booking page's date picker reads booked and inquired dates (dates only) from `/api/client/availability` (`lib/public-availability.ts`); staff confirmation still rechecks every conflict. Notifications use the built-in outbox in `lib/automation/` (see [automation](automation.md)); no online payment collection, settlement claim or public admin-booking mutation is implied. Anonymous receptionist state/session identity remains separate from administrator/developer accounts and privileges. `npm run test` enforces retired-route boundaries and verifies chatbot, admin and developer behavior in isolated PostgreSQL databases.

## Built-in automation

Email automation is part of the application; no external workflow service is involved. Server-only modules in `lib/automation/` write every notification to the durable outbox (`zion_admin_outbox`, extended by `prisma/automation.sql`) inside the transaction of the business change, then deliver it through Gmail SMTP with Nodemailer. Delivery is attempted right after the response with `after()`, by the bearer-protected scheduled route `app/api/cron/automation/` (Vercel Cron or Supabase `pg_cron`), by `npm run automation:run`, and from the admin Automation page (`/admin/automation`). Reminders and the daily staff digest are prepared idempotently by the scheduled run. See [the automation guide](automation.md).

## Maintenance rules

The [design and engineering standard](design-standard.md) applies to the existing system and all future changes. Shared visual foundations live in `styles/tokens.css` and `styles/primitives.css`; licensed local font assets live in `app/_fonts/`.

- Keep routable files named according to App Router conventions.
- Put route-local implementation details in underscore-prefixed private folders.
- Keep reusable UI outside `app/` in `components/`.
- Mark database, secret, and server integration entry points with `import 'server-only'`.
- Do not commit `.next`, alternate build directories, TypeScript build metadata, logs, backups, or runtime uploads.
- Run `npm run verify` before release.
