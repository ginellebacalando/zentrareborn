# Client-only scope

## Included pages

- Home, About, Facilities, Gallery, Contact, FAQ, Rules, Privacy, Terms, Event Policies, and Testimonies
- Event package pages for weddings, birthdays, christenings, debuts, gender reveals, and Christmas parties

## Included backend

- `/api/client/**` for inquiries, packages, public content, settings, FAQs, and testimonials
- `/api/health` for runtime health checks
- Transitive database, validation, storage, inquiry notification, content, package, and testimony services required by those routes
- Prisma schema for client generation against the existing database

## Explicitly excluded

- Administrator pages and dashboard layouts
- Administrator API endpoints
- Administrator UI components and assets
- Administrator authentication, password recovery, team-access screens, and route protection
- Administrator reports, exports, maintenance utilities, documentation, migrations, seeders, and deployment workers
- Smart Assistant UI, APIs, AI providers, knowledge index, feature controls, and environment connections
- Online booking, appointment/calendar intake, payment information, receipts, and booking orchestration
