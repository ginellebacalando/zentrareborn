# Zion Client Web

This folder is the isolated client-facing Zion Events Place application. It preserves the public design, event-package browsing, contact inquiry journey, managed public content, testimonials, client API handlers, database access, and the bundled media used by those experiences.

## Boundary

The project intentionally contains no administrator pages, dashboard layouts, administrator API routes, login/account-recovery screens, administrator components, route protection proxy, dashboard assets, Smart Assistant, online booking, payment/receipt flow, or administrator documentation. Shared domain services are present only when a remaining client route imports them to complete an inquiry, package, content, or testimony request.

Run `npm run check:client-boundary` to verify the separation.

The application follows the architecture and dependency rules in [`docs/architecture.md`](docs/architecture.md). Run `npm run check:hygiene` to enforce its filesystem conventions.

## Local setup

1. Install dependencies with `npm ci`.
2. Copy `.env.example` to `.env.local` and provide the client runtime values.
3. Generate the Prisma client with `npm run db:generate`.
4. Start the app with `npm run dev`.

The included Prisma schema reflects the existing shared database contract. This extraction does not include database migrations or seed scripts, so it cannot accidentally take ownership of administrator-side database evolution.

## Verification

- `npm run check:client-boundary` checks forbidden panel paths/imports and missing static media references.
- `npm run check:hygiene` checks the standard project layout and rejects stale build/test artifacts.
- `npm run typecheck` validates TypeScript.
- `npm run test` verifies that Smart Assistant and online booking artifacts cannot return.
- `npm run lint` runs the Next.js ESLint rules.
- `npm run build` creates the production bundle.
- `npm run verify` runs the full sequence.
