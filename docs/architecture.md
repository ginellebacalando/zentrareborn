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

All HTTP endpoints remain under `app/api/client/`, except the operational `app/api/health/` endpoint. Administrator routes, components, authentication flows, and assets are prohibited.

Smart Assistant, online booking, calendar intake, payment/receipt routes, and their backend integrations are intentionally outside this application boundary. `npm run test` enforces that removal.

## Maintenance rules

- Keep routable files named according to App Router conventions.
- Put route-local implementation details in underscore-prefixed private folders.
- Keep reusable UI outside `app/` in `components/`.
- Mark database, secret, and server integration entry points with `import 'server-only'`.
- Do not commit `.next`, alternate build directories, TypeScript build metadata, logs, backups, or runtime uploads.
- Run `npm run verify` before release.
