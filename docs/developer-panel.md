# Developer Command Center

The private workspace is at `/developer`, with sign-in at `/developer/access`. It is disabled by default. It has no link in the public website or staff sidebar. Knowing its URL grants no access.

## Explicit temporary local access

When the operator explicitly requests a login-free development window, run `npm.cmd run developer:local-access -- --origin=http://localhost:3001` from the project folder. This installs any missing additive developer tables and writes a fixed seven-day lease to ignored `.env.local`. Existing developer credentials and allowlisted accounts are preserved. It does not renew on startup or page refresh; running the operator command again would explicitly create a new window.

Restart the development server bound to `127.0.0.1` (the default `npm run dev` now uses that binding), then open `/developer`. The local page creates an audited temporary developer session through a same-origin POST and opens directly. Password and authenticator prompts are skipped for that local identity only, including system changes. CSRF, exact Origin checks, input validation, audit records, and restricted integration destinations remain enforced.

The exception requires `NODE_ENV=development`, a local environment, a loopback HTTP origin and PostgreSQL database, exact loopback request headers, and a valid lease of no more than seven days. It is rejected in production, hosted preview deployments, remote databases, cross-origin requests, or remotely forwarded requests. The server must remain bound to loopback and must not be exposed through a tunnel or proxy. The temporary account has undisclosed random credentials and cannot use normal credential login. Its session is rejected after expiry even if the browser keeps the cookie. Normal developer accounts continue to require MFA during the window.

The window deadline is displayed in the panel. At that deadline, normal authentication is required again, or access stays closed if normal developer enrollment is incomplete. To revoke the exception early, set `DEVELOPER_LOCAL_ACCESS_ENABLED=false` in `.env.local` and reload/restart the development server. Existing ordinary developer accounts and production authentication are unchanged.

## Reference and scope

The old application at `../Zentra/app/admin/(dashboard)/command-center` was inspected as the reference. Its four workspaces are represented here, with independent developer authorization:

| Old Command Center                       | Developer workspace                                                                                                                                                              |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Overview / readiness                     | Overview and Connections, with actual database and authenticated n8n checks; configuration-only checks are labeled                                                               |
| Task Templates                           | General/category checklists, step order, role, priority, required flag, due offset, draft versions, publication, archive and restore                                             |
| Assistant Knowledge / FAQ control center | Reviewed knowledge sources, FAQ drafts/publication/hide/archive, FAQ categories, published-source tests, topic-gap review, and source coverage                                   |
| Public Content                           | Gallery, facilities, rules, privacy, terms, about and contact; immutable draft revisions, review, approval, publication, archive and restoration                                 |
| Additional developer operations          | Approved n8n workflow activation/pause and editor links, inquiry delivery limits/retries, signed knowledge ingestion, developer-session revocation, account disable, audit trail |

Public booking, payment, and the previously removed Smart Assistant UI are not restored. The separately authorized [Ask Zion public chatbot](chatbot.md) uses visitor-safe website sources; developer documents and task templates are not included in that public assistant. Task templates are published in the private feed for an orchestration consumer; this does not create or migrate staff tasks. The source-test tool searches published evidence without calling a language model or persisting questions. It is labeled as a source-coverage test and does not claim a live chatbot response. A connected chatbot can report controlled missing-information topics; raw prompts and transcripts are rejected.

## Provisioning a developer

Use a trusted interactive operator terminal. No web registration or administrator-role promotion exists.

1. Configure the existing PostgreSQL connection. Inspect the target, then install the eight additive developer tables:

   ```powershell
   npm.cmd run developer:setup
   npm.cmd run developer:setup -- --install
   ```

   Remote schema/account changes require the explicit `--allow-remote` option. Applying the developer SQL never drops or overwrites client/admin tables. Back up and review production schema changes through the deployment process.

2. Put a securely generated 32-byte hex `DEVELOPER_ENCRYPTION_KEY` in the server secret manager. For a local development database only, enrollment generates it in ignored `.env.local` when absent. Keep this key stable; changing it requires re-enrollment of MFA seeds.

3. Enroll each explicitly approved developer:

   ```powershell
   npm.cmd run developer:setup -- --create --email=approved-developer@example.com
   ```

   Enter a unique 16–72-byte password privately. The CLI prints an enrollment URI only in that operator terminal and requires a valid authenticator code before saving the account. Transfer the URI through an approved private channel; do not paste passwords, seeds, API keys or enrollment URIs into chat or source control. MFA secrets are encrypted with AES-256-GCM and bound to the account ID. Passwords use bcrypt with cost 12.

4. Set `DEVELOPER_EMAIL_ALLOWLIST` to approved account emails, `DEVELOPER_ORIGIN` to the exact browser origin, and `DEVELOPER_PANEL_ENABLED=true`. Restart the server if environment changes require it. An enabled account and allowlisted email are both required on every authenticated request.

5. Open `/developer/access` and sign in with the developer password and authenticator code. Outside the explicitly enabled temporary local window, there is no local auto-login. There is no default real account, admin-session shortcut, or production preview bypass.

Disable/recover an account from the trusted operator terminal:

```powershell
npm.cmd run developer:setup -- --disable --email=approved-developer@example.com
npm.cmd run developer:setup -- --rotate --email=approved-developer@example.com
```

Rotation requires a new password and verified new authenticator and revokes all previous sessions. There are no recovery codes or public password-reset endpoints. A developer can revoke active developer sessions and disable another developer from Access & Security. Account creation remains an operator action.

## Production ingress requirement

Production stays closed unless `DEVELOPER_ORIGIN` uses HTTPS, the encryption key and email allowlist are valid, and a random `DEVELOPER_GATEWAY_SECRET` of at least 43 characters exists. Every developer page and API request must also carry a matching `x-zion-developer-gateway` header.

Deploy the developer routes behind an identity-aware private gateway/VPN. Authenticate the developer group at that gateway, strip any client-supplied verification header, and inject the server-side secret only after successful gateway authorization. Block direct access to the origin with firewall/private-network rules. Keep the gateway secret out of browser JavaScript. A separate hostname can route only `/developer/*`, `/api/developer/*`, and necessary static assets to the same application. The application enforces the shared-secret header; deploying and configuring the gateway is an infrastructure step and has not been performed by this change.

Internal panel API calls, page reads, and the scoped machine feed all require the gateway in production. The n8n machine identity must be authorized by the gateway too. Do not disable the guard to make ingestion work.

## Session and mutation boundaries

- Developer sessions are independent opaque, 256-bit random tokens, stored only as SHA-256 hashes. The production cookie is `__Host-zion-developer`, Secure, HttpOnly, SameSite=Strict, Path=/, with no Domain attribute.
- Absolute expiry is 30 minutes; inactivity expiry is 10 minutes. A new sign-in revokes the developer's previous sessions. Account disable, allowlist removal, expiry and session revocation are checked at the database on each request.
- Every mutation enforces exact configured Origin, same-origin CSRF verification, authenticated developer access, bounded JSON and operation-specific validation. Every persisted change or external operation requires a fresh TOTP code. A TOTP time step is consumed atomically and cannot be replayed, including after sign-in.
- Database-backed throttles apply across application instances. Failed sign-ins and MFA denials are audited without storing submitted credentials or questions. Server failures return generic errors.
- All eight developer tables enable row-level security and revoke access from PUBLIC and Supabase's `anon`/`authenticated` roles where those roles exist. No browser-facing policies are installed. Use a privileged server-only connection; never use a Supabase anon/authenticated role for this control plane.
- Draft/source and orchestration edits use optimistic revisions. Published source revisions remain stable while new drafts are edited. Public content follows draft → review → approved → published; restoration creates a new draft. Publication currently permits the same developer to review and approve; this is not a two-person approval system.
- The developer audit table records actor ID, action, target, result and timestamp. Database owners can alter it: export to an external append-only audit sink if tamper resistance is required.

## n8n and connected services

Set `N8N_API_BASE_URL` to the approved HTTPS API root, for example `https://automation.example.com/api/v1`, and put a scoped n8n key in `N8N_API_KEY`. List exact destination hostnames in `DEVELOPER_OUTBOUND_HOSTS`, and approved workflow IDs in `N8N_DEVELOPER_WORKFLOW_IDS` (up to 20). Only those workflows can be inspected or activated/paused. Node changes use the authenticated n8n editor, linked from the panel; the application does not proxy unrestricted n8n administration or expose workflow credentials. Use minimum scopes needed for reading and activating/deactivating approved workflows. See [n8n API authentication](https://docs.n8n.io/connect/n8n-api/authentication/).

Developer integration calls reject HTTP, credentials/query strings in configured URLs, unapproved hosts, private/reserved destination addresses, and redirects. Restrict outbound traffic at the deployment network as well. n8n and storage/email provider versions and policies remain operator-managed.

Inquiry enablement, timeout, retry backoff and the attempt budget for new jobs are persisted in the developer configuration. The existing inquiry webhook service reads these settings. Pausing prevents delivery; jobs remain available. Manual retries use the existing idempotency key and atomic job claims, and cannot exceed the original attempt budget or replay a successful job. Retry timestamps are recorded; a separate scheduler is still needed to automatically execute due retries. The control panel does not execute arbitrary shell commands, SQL, URLs, or user-provided code.

Connections labels distinguish verified requests from configuration presence. PostgreSQL and n8n have active read-only checks. Storage, mail, admin authentication, inquiry delivery and assistant-feed configuration checks do not claim end-to-end delivery. The panel shows real inquiry delivery metadata without exposing inquiry payloads or provider responses.

The public `/api/health` endpoint returns only coarse readiness. Provider hosts, deployment information, schema/configuration details and internal environment-variable names are kept out of that public response.

## Chatbot knowledge contract

Generate a separate random token of at least 43 characters as `DEVELOPER_KNOWLEDGE_TOKEN`. An approved backend consumer requests:

```http
GET /api/developer/knowledge-feed
Authorization: Bearer <dedicated machine token>
```

The response has a content-derived `version`, `generatedAt`, and four source families: published developer documents (including task-template checklists), eligible published FAQ snapshots, currently published/unexpired public content, and visible packages in active visible categories. It excludes draft revisions, archived documents, hidden/expired FAQ/content, hidden packages, account records, staff bookings/payments, notes, credentials and conversations. The token grants no control-panel access. Each existing source family is bounded to 500 items; exceeding this fails explicitly rather than silently truncating the snapshot. Developer documents are limited to 200. The consumer must reconcile the full snapshot, removing previously indexed sources that are now absent, and treat all source text as data, not executable instructions.

The same scoped endpoint accepts only topic reports:

```http
POST /api/developer/knowledge-feed
Authorization: Bearer <dedicated machine token>
Content-Type: application/json

{"topic":"pricing"}
```

Topics: `packages`, `pricing`, `venue`, `availability`, `policies`, `contact`, `other`. Reports aggregate by topic and expire after 30 days. Unknown fields, including raw prompts or transcripts, are rejected. This intentionally minimizes the data stored compared with the old question-review queue.

For explicit push ingestion, configure `N8N_KNOWLEDGE_SYNC_URL`, the approved host, and a separate random `N8N_KNOWLEDGE_SYNC_SECRET` (at least 43 characters). Sync sends a full snapshot with a unique ID and:

- `x-zion-timestamp`: Unix time in seconds.
- `x-zion-signature`: hex HMAC-SHA256 of `<timestamp>.<exact request body>`.
- `x-zion-idempotency-key`: snapshot delivery ID.

The receiver must validate the signature with a timing-safe comparison, reject stale timestamps (for example older than five minutes), deduplicate the delivery ID, replace/reconcile approved sources, and acknowledge with JSON `{"accepted":true}`. Acceptance confirms ingestion receipt, not completed embedding or successful chatbot answers. Failed/ambiguous delivery is audited and does not claim synchronization success. No live n8n or chatbot connection is created until these settings and the receiver are supplied.

## Verification

The implementation updates Next.js and its ESLint configuration to 16.4.6, Zod to 4.6.7, Prisma packages to 7.10.1, and the Nodemailer override to 10.5.0 to address reported runtime/security advisories. The dependency audit still reports moderate issues in the existing ESLint/minimatch development-tool dependency chain; resolving those through npm's suggested forced downgrade is outside this change. Re-run audits as advisories evolve.

```powershell
npm run test:developer
npm run developer:preview
# In another terminal, while the disposable preview is running:
node scripts/check-developer-preview.mjs
```

The preview binds only to loopback port 3012, uses an in-memory PostgreSQL fixture and random test-only credentials, disables real email/webhooks/provider credentials, and stores enrollment only in ignored `.next/developer-fixture.json`. Stopping it discards the fixture. It is not a real developer-account enrollment or production-access mechanism. Unit/integration tests cover fail-closed configuration and gateway checks, TOTP verification and replay rejection, independent accounts, allowlist/session revocation, draft/publication boundaries, content approval, scoped sources, stale revisions, private-destination rejection, throttling, and safe audit records. HTTP checks verify actual route denial for authenticated staff accounts, CSRF/origin enforcement, cookie flags, feed scope, and revocation.
