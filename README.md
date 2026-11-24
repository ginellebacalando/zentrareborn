# Zion Client Web

This folder is the isolated client-facing Zion Events Place application. It preserves the public design, event-package browsing, contact inquiry journey, managed public content, testimonials, client API handlers, database access, and the bundled media used by those experiences.

## Boundary

The public application includes **Ask Zion**, a [source-based visitor chatbot](docs/chatbot.md). Online booking, online payments, and the legacy Smart Assistant remain excluded. Staff operations are isolated under `/admin`. The independent developer Command Center under `/developer` manages connections, approved n8n workflows, task templates, assistant knowledge, governed public content, developer access, and audit records. Developer access is disabled until explicitly provisioned; client and staff accounts do not grant developer permissions. See [developer setup and production ingress](docs/developer-panel.md).

Run `npm run check:client-boundary` to verify the separation.

The application follows the architecture and dependency rules in [`docs/architecture.md`](docs/architecture.md). Run `npm run check:hygiene` to enforce its filesystem conventions.

## Local setup

1. Install dependencies with `npm ci`.
2. Copy `.env.example` to `.env.local` and provide the client runtime values.
3. Generate the Prisma client with `npm run db:generate`.
4. Start the app with `npm run dev`, then open `http://localhost:3001`.

Zentra Web uses port **3001** for both `npm run dev` and `npm start` (after a production build). Keep `NEXT_PUBLIC_APP_URL`, `AUTH_URL`, and the local `DEVELOPER_ORIGIN` set to `http://localhost:3001`. The admin panel is at `http://localhost:3001/admin`.

The included Prisma schema reflects the existing shared database contract. This extraction does not include database migrations or seed scripts, so it cannot accidentally take ownership of administrator-side database evolution.

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
