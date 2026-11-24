$ErrorActionPreference = 'Stop'

$targetPath = 'C:\Users\jerom\Downloads\Mobile Devices\IAS-Test-Cases-Progress-Tracker-ZenTra.xlsx'
$workDir = 'C:\Users\jerom\Downloads\ZenTra-Web\.codex-spreadsheet-work-20261008'
$stagedPath = Join-Path $workDir 'IAS-Test-Cases-Progress-Tracker-ZenTra.staged.xlsx'
$extractDir = Join-Path $workDir 'xlsx-edit'
$authoredValuesPath = Join-Path $workDir 'authored-values.json'

$recordsJson = @'
[
  {
    "id": "ID-001",
    "module": "Home Page",
    "scenario": "User opens the Zion Events Place landing page and confirms the main public content loads.",
    "action": "1. Open http://localhost:3000/.\n2. Wait for the landing page to load.\n3. Review hero, highlights, testimonies, and footer showing © 2026 Zion Events Place.",
    "input": "Home route /",
    "pass": null,
    "fail": null,
    "component": "Functional Suitability",
    "comment": "Pending: public home page was not rerun on 2026-10-08."
  },
  {
    "id": "ID-002",
    "module": "Public Navigation",
    "scenario": "User opens the public navigation menu and sees current public links.",
    "action": "1. Open the home page.\n2. Open the main navigation.\n3. Confirm public routes are reachable and removed client-account or booking links are absent.",
    "input": "Public menu links",
    "pass": null,
    "fail": null,
    "component": "Usability",
    "comment": "Pending: public navigation was not rerun on 2026-10-08."
  },
  {
    "id": "ID-003",
    "module": "Package Navigation",
    "scenario": "User expands Packages and sees each current event package option.",
    "action": "1. Open the menu.\n2. Hover over or tap Packages.\n3. Confirm Weddings, Debuts, Christening, Birthdays, Gender Reveal, and Christmas Party are listed.",
    "input": "Packages menu",
    "pass": null,
    "fail": null,
    "component": "Usability",
    "comment": "Pending: package navigation was not rerun on 2026-10-08."
  },
  {
    "id": "ID-004",
    "module": "Public Static Pages",
    "scenario": "User opens About, Facilities, Policies, Privacy, Terms, Rules, and Testimonies.",
    "action": "1. Open each public information route.\n2. Confirm content loads without route errors.\n3. Confirm Zion Events Place branding remains visible.",
    "input": "Public information routes",
    "pass": null,
    "fail": null,
    "component": "Functional Suitability",
    "comment": "Pending: full public page route pass was not rerun today."
  },
  {
    "id": "ID-005",
    "module": "Contact Actions",
    "scenario": "User starts contact actions from the public contact page.",
    "action": "1. Open /contact.\n2. Click email, phone, and map/location actions.\n3. Confirm each action opens the expected handler or link.",
    "input": "Email, phone, map links",
    "pass": null,
    "fail": null,
    "component": "Usability",
    "comment": "Pending: contact actions were not rerun on 2026-10-08."
  },
  {
    "id": "ID-006",
    "module": "Contact Inquiry Persistence",
    "scenario": "Client submits a contact inquiry and the system stores the operational records.",
    "action": "1. POST a valid contact inquiry.\n2. Confirm Inquiry, Activity, Notification, and audit records are persisted.\n3. Confirm no secret or credential appears in the response.",
    "input": "Valid contact inquiry payload",
    "pass": null,
    "fail": null,
    "component": "Functional Suitability",
    "comment": "Pending: implementation exists, but no executed runtime verification was provided for this pass."
  },
  {
    "id": "ID-007",
    "module": "Inquiry Abuse Protection",
    "scenario": "Public inquiry route rejects abusive or automated submissions.",
    "action": "1. Send repeated public inquiry POSTs.\n2. Confirm origin, rate-limit, and honeypot protection blocks abuse.\n3. Confirm user-safe error feedback.",
    "input": "Repeated inquiry payloads",
    "pass": null,
    "fail": "FAILED",
    "component": "Security",
    "comment": "Audited gap: planned origin, rate-limit, and honeypot protection are not implemented."
  },
  {
    "id": "ID-008",
    "module": "Inquiry-to-Booking Conversion",
    "scenario": "Admin converts an inquiry to a staff booking without losing source tracking.",
    "action": "1. Open recent inquiries in admin.\n2. Prefill a staff booking from an inquiry.\n3. Confirm source inquiry ID is stored and duplicate conversion is prevented.",
    "input": "Recent inquiry record",
    "pass": null,
    "fail": "FAILED",
    "component": "Functional Suitability",
    "comment": "Audited gap: booking does not store source inquiry ID, mark handled, or prevent duplicate conversion."
  },
  {
    "id": "ID-009",
    "module": "FAQ Content Source",
    "scenario": "Public FAQ page uses the published FAQ database content.",
    "action": "1. Open /faq.\n2. Compare visible FAQ entries with published FAQ API records.\n3. Confirm UI reflects database-managed FAQ content.",
    "input": "/faq and FAQ APIs",
    "pass": null,
    "fail": "FAILED",
    "component": "Functional Suitability",
    "comment": "Current FAQ UI still uses hardcoded STATIC_FAQS despite published FAQ APIs."
  },
  {
    "id": "ID-010",
    "module": "Published Public Content API",
    "scenario": "Public pages read approved and published content versions.",
    "action": "1. Request public content APIs.\n2. Confirm only approved published versions are returned.\n3. Confirm unpublished drafts are not visible publicly.",
    "input": "Published public content APIs",
    "pass": null,
    "fail": null,
    "component": "Security",
    "comment": "Pending: approved published-content APIs exist, but no public runtime execution evidence was provided."
  },
  {
    "id": "ID-011",
    "module": "Public Catalog Admin Management",
    "scenario": "Admin can manage public packages, catalog, and content visibility.",
    "action": "1. Open private admin content-management area.\n2. Create or publish a package or public content record.\n3. Confirm public pages display the approved version.",
    "input": "Admin content management",
    "pass": null,
    "fail": "FAILED",
    "component": "Functional Suitability",
    "comment": "No current admin UI manages or publishes FAQs, packages, catalog, content, or active visibility flags."
  },
  {
    "id": "ID-012",
    "module": "Testimony Moderation",
    "scenario": "Admin moderates public testimonies before they appear on the client site.",
    "action": "1. Open testimony moderation in admin.\n2. Approve or hide a testimony.\n3. Confirm the public testimony section reflects the moderation state.",
    "input": "Admin testimony moderation",
    "pass": null,
    "fail": "FAILED",
    "component": "Functional Suitability",
    "comment": "No current admin UI exists for testimony moderation or public visible flags."
  },
  {
    "id": "ID-013",
    "module": "Gallery and Media Assets",
    "scenario": "User browses gallery images and videos without broken assets.",
    "action": "1. Open /gallery, /facilities, and one event page.\n2. Inspect public images and videos.\n3. Confirm there are no missing public asset references.",
    "input": "Public images and videos",
    "pass": null,
    "fail": null,
    "component": "Reliability",
    "comment": "Pending: images were organized previously, but no full media audit was rerun today."
  },
  {
    "id": "ID-014",
    "module": "Removed Client Accounts",
    "scenario": "Public site does not show removed client account login or registration flows.",
    "action": "1. Review public navigation, footer, and calls to action.\n2. Search for client login or registration entry points.\n3. Confirm none are visible.",
    "input": "Public visible links",
    "pass": null,
    "fail": null,
    "component": "Functional Suitability",
    "comment": "Pending: client account removal is current scope, but visible-link audit was not rerun today."
  },
  {
    "id": "ID-015",
    "module": "Removed Booking and Assistant Flows",
    "scenario": "Public site does not expose removed online booking, online payment, or smart assistant flows.",
    "action": "1. Review public navigation, event pages, contact page, and footer.\n2. Search for online booking, payment, chatbot, or calendar availability links.\n3. Confirm none are visible.",
    "input": "Public visible links",
    "pass": null,
    "fail": null,
    "component": "Functional Suitability",
    "comment": "Pending: removed-flow audit was not rerun today."
  },
  {
    "id": "ID-016",
    "module": "SEO Metadata",
    "scenario": "Public pages use current Zion Events Place metadata.",
    "action": "1. Inspect title, description, and Open Graph metadata for Home and one package page.\n2. Confirm Zion Events Place branding.\n3. Confirm preview image values exist where expected.",
    "input": "Page metadata",
    "pass": null,
    "fail": null,
    "component": "Maintainability",
    "comment": "Pending: SEO metadata was not rerun on 2026-10-08."
  },
  {
    "id": "ID-017",
    "module": "Accessibility Labels",
    "scenario": "Public interactive controls expose meaningful labels.",
    "action": "1. Inspect navigation, theme, menu, gallery, and inquiry controls.\n2. Confirm icon-only controls have accessible names.\n3. Confirm form inputs have labels.",
    "input": "Public interactive controls",
    "pass": null,
    "fail": null,
    "component": "Accessibility",
    "comment": "Pending: accessibility audit was not rerun today."
  },
  {
    "id": "ID-018",
    "module": "Responsive Public Layout",
    "scenario": "Public pages remain readable on desktop and mobile viewports.",
    "action": "1. Open Home, Gallery, Contact, and one event page.\n2. Test desktop and 390px mobile width.\n3. Confirm no horizontal overflow or overlapping text.",
    "input": "Desktop and mobile public pages",
    "pass": null,
    "fail": null,
    "component": "Portability",
    "comment": "Pending: public responsive audit was not rerun today."
  },
  {
    "id": "ID-019",
    "module": "Policies and Legal Pages",
    "scenario": "User can read privacy, terms, rules, and public policies.",
    "action": "1. Open /privacy, /terms, /rules, and /policies.\n2. Confirm content displays.\n3. Confirm links are reachable from public navigation or footer.",
    "input": "Legal and policy routes",
    "pass": null,
    "fail": null,
    "component": "Compliance",
    "comment": "Pending: legal route audit was not rerun today."
  },
  {
    "id": "ID-020",
    "module": "Inquiry Queue Failure Recovery",
    "scenario": "Inquiry commit and downstream queue failure do not mislead users or create retry duplicates.",
    "action": "1. Simulate n8n queue failure after inquiry commit.\n2. Confirm the user sees truthful status.\n3. Confirm retry cannot create duplicates.",
    "input": "Contact inquiry queue failure",
    "pass": null,
    "fail": "FAILED",
    "component": "Reliability",
    "comment": "Audited code-flow gap: DB commit can succeed before n8n queue failure returns an error, risking misleading retry duplicates."
  },
  {
    "id": "ID-021",
    "module": "Admin Login Access Control",
    "scenario": "Private admin routes deny unauthenticated access and client-role users.",
    "action": "1. Open protected admin routes unauthenticated.\n2. Try a client-role session.\n3. Confirm protected modules stay blocked.",
    "input": "Unauthenticated and client-role sessions",
    "pass": "PASSED",
    "fail": null,
    "component": "Security",
    "comment": "Passed in earlier isolated preview check for unauthenticated access, client-role denial, and protected modules; not live production."
  },
  {
    "id": "ID-022",
    "module": "Session and Rate Limits",
    "scenario": "Admin authentication uses DB-backed sessions and rate limits.",
    "action": "1. Sign in to the private panel.\n2. Confirm 8-hour DB-backed session behavior.\n3. Confirm failed login attempts are rate limited.",
    "input": "Admin auth flow",
    "pass": null,
    "fail": null,
    "component": "Security",
    "comment": "Pending: rate-limit and 8-hour expiry scenarios were not executed today."
  },
  {
    "id": "ID-023",
    "module": "Admin Profile Contact Update",
    "scenario": "Admin updates profile contact details and the saved values persist after reload.",
    "action": "1. Open Admin profile.\n2. Edit allowed name/contact fields.\n3. Reload Profile and confirm saved values persist.",
    "input": "Admin profile edit",
    "pass": null,
    "fail": null,
    "component": "Functional Suitability",
    "comment": "Pending: profile page access was verified, but profile edit-and-reload persistence was not executed today."
  },
  {
    "id": "ID-024",
    "module": "Profile Role Escalation Prevention",
    "scenario": "Admin Profile cannot be used to change role, account status, or privileged access.",
    "action": "1. Open Admin profile.\n2. Attempt or inspect for role/status edit controls.\n3. Confirm role escalation is unavailable.",
    "input": "Admin profile controls",
    "pass": null,
    "fail": null,
    "component": "Security",
    "comment": "Pending: source scope keeps role/status outside Profile, but no dedicated runtime escalation test was executed today."
  },
  {
    "id": "ID-025",
    "module": "Admin Mobile Menu Navigation",
    "scenario": "Admin mobile menu opens and keeps private navigation usable without horizontal overflow.",
    "action": "1. Open admin at 390x844.\n2. Open the mobile menu.\n3. Confirm navigation and logout remain visible and usable.",
    "input": "Admin mobile viewport",
    "pass": "PASSED",
    "fail": null,
    "component": "Portability",
    "comment": "Verified 2026-10-08 in isolated browser check; mobile menu/navigation and logout remained usable without horizontal overflow."
  },
  {
    "id": "ID-026",
    "module": "Signout Replay Protection",
    "scenario": "Logout revokes the current admin session.",
    "action": "1. Sign out from the admin panel.\n2. Replay the old session cookie.\n3. Confirm the replay is rejected.",
    "input": "Revoked session cookie",
    "pass": "PASSED",
    "fail": null,
    "component": "Security",
    "comment": "Verified 2026-10-08 in local Auth.js API: signout replay cookie returned 401."
  },
  {
    "id": "ID-027",
    "module": "Admin Topbar Links",
    "scenario": "Admin topbar shows profile/settings links instead of venue/location and client-site shortcut.",
    "action": "1. Open the admin panel.\n2. Inspect the topbar.\n3. Click Admin profile and Settings links.",
    "input": "Admin topbar",
    "pass": "PASSED",
    "fail": null,
    "component": "Usability",
    "comment": "Verified 2026-10-08 in isolated browser check; both links navigate correctly."
  },
  {
    "id": "ID-028",
    "module": "Admin Topbar Active State",
    "scenario": "Admin topbar shows the correct active state for Profile and Settings.",
    "action": "1. Open Profile from the topbar.\n2. Open Settings from the topbar.\n3. Confirm active state follows the selected page.",
    "input": "Profile and Settings links",
    "pass": "PASSED",
    "fail": null,
    "component": "Usability",
    "comment": "Verified 2026-10-08 in isolated browser check; active state works."
  },
  {
    "id": "ID-029",
    "module": "Admin Sidebar Layout",
    "scenario": "Admin sidebar contains the current six operational links and account identity.",
    "action": "1. Open admin dashboard on desktop.\n2. Review sidebar links and account identity.\n3. Confirm no horizontal overflow.",
    "input": "Admin sidebar desktop",
    "pass": "PASSED",
    "fail": null,
    "component": "Usability",
    "comment": "Verified 2026-10-08 in isolated browser check; six operational links and identity are visible."
  },
  {
    "id": "ID-030",
    "module": "Admin Logout Control",
    "scenario": "Admin sees a full-width Logout button at the bottom of the sidebar on desktop and mobile.",
    "action": "1. Open admin panel at desktop and 390x844 mobile.\n2. Scroll or open the mobile menu.\n3. Confirm Logout remains visible and usable.",
    "input": "Sidebar logout",
    "pass": "PASSED",
    "fail": null,
    "component": "Portability",
    "comment": "Verified 2026-10-08 in isolated browser check; logout visible on desktop and 390x844 mobile."
  },
  {
    "id": "ID-031",
    "module": "Dashboard Counts",
    "scenario": "Admin dashboard uses private SQL counts instead of demo hardcoded records.",
    "action": "1. Open admin dashboard.\n2. Check totals source.\n3. Confirm counts come from private database queries.",
    "input": "Admin dashboard",
    "pass": "PASSED",
    "fail": null,
    "component": "Functional Suitability",
    "comment": "Passed in earlier isolated integration run for real aggregates; not live production and not rerun today."
  },
  {
    "id": "ID-032",
    "module": "Admin Profile Page",
    "scenario": "Admin can open the profile page from the shell.",
    "action": "1. Click Admin profile.\n2. Confirm Profile page loads.\n3. Confirm the current admin identity displays without exposing secrets.",
    "input": "Admin profile link",
    "pass": "PASSED",
    "fail": null,
    "component": "Functional Suitability",
    "comment": "Verified 2026-10-08 in isolated browser check and local Auth.js Profile API."
  },
  {
    "id": "ID-033",
    "module": "Admin Settings Policy",
    "scenario": "Admin Settings policy edits create a versioned policy and require review on new pending bookings.",
    "action": "1. Open Settings.\n2. Edit policy configuration.\n3. Confirm new pending bookings require review and existing contracts are not rewritten.",
    "input": "Settings policy change",
    "pass": null,
    "fail": null,
    "component": "Maintainability",
    "comment": "Pending: policy-version behavior is documented, but the Settings edit workflow was not executed today."
  },
  {
    "id": "ID-034",
    "module": "Booking Initial State",
    "scenario": "Staff-entered booking requests start pending, unpaid, and unreviewed.",
    "action": "1. Create request.\n2. Inspect booking state.\n3. Confirm pending, unpaid, and unreviewed.",
    "input": "Staff booking request",
    "pass": "PASSED",
    "fail": null,
    "component": "Functional Suitability",
    "comment": "Passed in earlier isolated integration run for request state; not live production."
  },
  {
    "id": "ID-035",
    "module": "Booking Identity Review",
    "scenario": "Admin verifies client identity before approving a booking request.",
    "action": "1. Open pending booking.\n2. Attempt approval before identity review.\n3. Confirm approval is blocked until identity is verified.",
    "input": "Pending booking",
    "pass": "PASSED",
    "fail": null,
    "component": "Security",
    "comment": "Passed in earlier isolated integration run for verification and approval gates; not live production."
  },
  {
    "id": "ID-036",
    "module": "Approval Separation",
    "scenario": "Booking approval does not reserve the slot or mark payment as paid.",
    "action": "1. Approve a reviewed booking request.\n2. Inspect reservation and payment states.\n3. Confirm slot remains unreserved and payment remains unpaid.",
    "input": "Reviewed booking",
    "pass": "PASSED",
    "fail": null,
    "component": "Functional Suitability",
    "comment": "Passed in earlier isolated integration run for approval separation; not live production."
  },
  {
    "id": "ID-037",
    "module": "Cash Receipt Validation",
    "scenario": "Admin records a genuine cash receipt with valid amount and unique reference.",
    "action": "1. Open approved balance.\n2. Record cash receipt.\n3. Confirm unique reference, positive amount, and no overpay.",
    "input": "Cash receipt details",
    "pass": "PASSED",
    "fail": null,
    "component": "Reliability",
    "comment": "Passed in earlier isolated integration run for cash receipt validation; not live production."
  },
  {
    "id": "ID-038",
    "module": "Reservation Preconditions",
    "scenario": "Admin can confirm reservation only after deposit and policy review requirements are met.",
    "action": "1. Review deposit and policy state.\n2. Try early reservation.\n3. Confirm requirements block confirmation.",
    "input": "Approved booking with balance",
    "pass": "PASSED",
    "fail": null,
    "component": "Reliability",
    "comment": "Passed in earlier isolated integration run for cash prerequisites and stale writes; not live production."
  },
  {
    "id": "ID-039",
    "module": "Booking Conflict Locking",
    "scenario": "System rejects conflicting confirmed reservations under SQL locking.",
    "action": "1. Create overlapping slot attempts.\n2. Confirm one succeeds.\n3. Confirm the conflict is rejected.",
    "input": "Conflicting booking slots",
    "pass": "PASSED",
    "fail": null,
    "component": "Reliability",
    "comment": "Passed in earlier isolated integration run for confirmed conflicts; not live production."
  },
  {
    "id": "ID-040",
    "module": "Event Completion Rule",
    "scenario": "Admin can complete only past confirmed and fully paid events.",
    "action": "1. Open future or unpaid booking.\n2. Attempt completion.\n3. Confirm completion requires past date and full payment.",
    "input": "Confirmed booking",
    "pass": null,
    "fail": null,
    "component": "Functional Suitability",
    "comment": "Pending: completion rule is documented, but no executed isolated or live verification was provided."
  },
  {
    "id": "ID-041",
    "module": "Cancellation History",
    "scenario": "Cancelled booking keeps history and audit trail.",
    "action": "1. Cancel a booking.\n2. Inspect status and history.\n3. Confirm cancellation details remain available.",
    "input": "Booking cancellation",
    "pass": "PASSED",
    "fail": null,
    "component": "Maintainability",
    "comment": "Passed in earlier isolated integration run through cancellation/voiding history; not live production."
  },
  {
    "id": "ID-042",
    "module": "Receipt Void Permission",
    "scenario": "Only SUPERADMIN can void a receipt with a reason after cancellation.",
    "action": "1. Try void as ADMIN.\n2. Try without reason or before cancellation.\n3. Confirm only SUPERADMIN with reason after cancellation can void.",
    "input": "Receipt void request",
    "pass": "PASSED",
    "fail": null,
    "component": "Security",
    "comment": "Passed in earlier isolated integration run for owner-only voiding; not live production."
  },
  {
    "id": "ID-043",
    "module": "Contract Snapshot Download",
    "scenario": "Admin generates a versioned contract snapshot as a .txt download.",
    "action": "1. Generate eligible contract.\n2. Download snapshot.\n3. Confirm versioned .txt content.",
    "input": "Contract generation",
    "pass": "PASSED",
    "fail": null,
    "component": "Functional Suitability",
    "comment": "Passed in earlier isolated integration run for contract issue/snapshot states; not live production."
  },
  {
    "id": "ID-044",
    "module": "Physical Signing Record",
    "scenario": "Admin records physical contract signing with signer and document reference.",
    "action": "1. Open issued contract.\n2. Record physical signing details.\n3. Confirm signer and document reference are saved.",
    "input": "Physical signing details",
    "pass": "PASSED",
    "fail": null,
    "component": "Compliance",
    "comment": "Passed in earlier isolated integration run for physical-signature states; not live production."
  },
  {
    "id": "ID-045",
    "module": "Calendar Filters",
    "scenario": "Admin filters calendar events by search, date, and status on desktop and mobile agenda.",
    "action": "1. Open Calendar.\n2. Use search, date, and status filters.\n3. Confirm desktop month and 390px mobile agenda update.",
    "input": "Calendar filters",
    "pass": "PASSED",
    "fail": null,
    "component": "Usability",
    "comment": "Passed in earlier isolated browser check for search/date/status filters and mobile agenda; not live production."
  },
  {
    "id": "ID-046",
    "module": "Cash-only Payments",
    "scenario": "Admin records staff-verified cash payments without online gateways.",
    "action": "1. Open payment flow.\n2. Record staff cash receipt.\n3. Confirm no card/e-wallet gateway or automatic payment verification.",
    "input": "Cash payment record",
    "pass": "PASSED",
    "fail": null,
    "component": "Functional Suitability",
    "comment": "Passed in earlier isolated admin flow for staff-recorded cash; no live gateway/provider test."
  },
  {
    "id": "ID-047",
    "module": "Audit Logs",
    "scenario": "Admin mutations persist audit logs for sensitive actions.",
    "action": "1. Perform private mutation.\n2. Open logs.\n3. Confirm audit entry with action context.",
    "input": "Private admin mutation",
    "pass": "PASSED",
    "fail": null,
    "component": "Maintainability",
    "comment": "Passed in earlier isolated integration run for audit persistence; not live production."
  },
  {
    "id": "ID-048",
    "module": "Notification Outbox",
    "scenario": "System queues notification outbox records for follow-up processing.",
    "action": "1. Trigger notification workflow.\n2. Inspect outbox.\n3. Confirm queued record persists.",
    "input": "Notification-creating workflow",
    "pass": "PASSED",
    "fail": null,
    "component": "Reliability",
    "comment": "Passed in earlier isolated integration run for outbox and mocked email; no live delivery claim."
  },
  {
    "id": "ID-049",
    "module": "Outbound Email Delivery",
    "scenario": "Notification provider delivers outbound email to recipients.",
    "action": "1. Configure provider.\n2. Trigger outbound email.\n3. Confirm delivery is accepted and received by recipient.",
    "input": "Email notification",
    "pass": null,
    "fail": "FAILED",
    "component": "Reliability",
    "comment": "Blocked: Resend provider is not configured, scheduler is not installed, and delivery is not verified."
  },
  {
    "id": "ID-050",
    "module": "Cross-origin Admin Mutation",
    "scenario": "Cross-origin requests cannot mutate private admin data.",
    "action": "1. Send cross-origin admin mutation.\n2. Confirm rejection.\n3. Confirm no private data changes.",
    "input": "Cross-origin admin mutation",
    "pass": "PASSED",
    "fail": null,
    "component": "Security",
    "comment": "Passed in earlier isolated preview check for cross-site rejection; not live production."
  },
  {
    "id": "ID-051",
    "module": "Booking Search and Private Export",
    "scenario": "Admin filters booking records and can produce private booking export data.",
    "action": "1. Search bookings by client or reference.\n2. Filter by status/date.\n3. Confirm private export data matches filtered records.",
    "input": "Booking list filters and export data",
    "pass": "PASSED",
    "fail": null,
    "component": "Functional Suitability",
    "comment": "Passed in earlier isolated private-read coverage for booking filters/export data; UI download was not separately claimed."
  },
  {
    "id": "ID-052",
    "module": "Admin Notification Processing",
    "scenario": "Admin can process queued notifications and distinguish provider acceptance from delivery.",
    "action": "1. Queue admin notification.\n2. Process with mocked provider.\n3. Confirm accepted/rejected states do not claim recipient delivery.",
    "input": "Queued notification processing",
    "pass": "PASSED",
    "fail": null,
    "component": "Reliability",
    "comment": "Passed in earlier isolated integration run with mocked email acceptance/rejection; no live delivery claim."
  },
  {
    "id": "ID-053",
    "module": "Settings Owner-only Permissions",
    "scenario": "Only the owner role can edit protected venue policy and sensitive settings.",
    "action": "1. Attempt settings edit as non-owner admin.\n2. Attempt as owner.\n3. Confirm owner-only edit permission is enforced.",
    "input": "Protected settings edit",
    "pass": "PASSED",
    "fail": null,
    "component": "Security",
    "comment": "Passed in earlier isolated role-authorization coverage for owner-only policy operations; not live production."
  },
  {
    "id": "ID-054",
    "module": "Payment Dashboard Totals",
    "scenario": "Dashboard payment totals reflect staff-recorded cash receipts and outstanding balances.",
    "action": "1. Record cash receipt in isolated flow.\n2. Open dashboard totals.\n3. Confirm cash and balance aggregates update.",
    "input": "Cash receipts and dashboard totals",
    "pass": "PASSED",
    "fail": null,
    "component": "Functional Suitability",
    "comment": "Passed in earlier isolated integration run for cash receipts and real aggregates; not live production."
  },
  {
    "id": "ID-055",
    "module": "Public FAQ Accordion Usability",
    "scenario": "Public FAQ accordion/search remains usable for visitors after content-source changes.",
    "action": "1. Open /faq.\n2. Use accordion and search/filter controls.\n3. Confirm answers remain readable and no public error appears.",
    "input": "Public FAQ accordion",
    "pass": null,
    "fail": null,
    "component": "Functional Suitability",
    "comment": "Pending: FAQ source gap is tracked separately, and accordion/search usability was not rerun today."
  }
]
'@

function Get-ColumnNumber([string] $cellRef) {
    $letters = ($cellRef -replace '\d', '').ToUpperInvariant()
    $number = 0
    foreach ($char in $letters.ToCharArray()) {
        $number = ($number * 26) + ([int][char]$char - [int][char]'A' + 1)
    }
    return $number
}

function Ensure-Cell($xml, $rowNode, [string] $cellRef) {
    $ns = $xml.DocumentElement.NamespaceURI
    $cells = @($rowNode.ChildNodes | Where-Object { $_.LocalName -eq 'c' })
    foreach ($cell in $cells) {
        if ($cell.r -eq $cellRef) {
            return $cell
        }
    }

    $newCell = $xml.CreateElement('c', $ns)
    $newCell.SetAttribute('r', $cellRef)
    $targetCol = Get-ColumnNumber $cellRef
    $insertBefore = $null
    foreach ($cell in $cells) {
        if ((Get-ColumnNumber $cell.r) -gt $targetCol) {
            $insertBefore = $cell
            break
        }
    }
    if ($insertBefore -ne $null) {
        [void]$rowNode.InsertBefore($newCell, $insertBefore)
    } else {
        [void]$rowNode.AppendChild($newCell)
    }
    return $newCell
}

function Ensure-Row($xml, [int] $rowNumber) {
    $ns = $xml.DocumentElement.NamespaceURI
    $sheetData = $xml.DocumentElement.GetElementsByTagName('sheetData', $ns).Item(0)
    $rows = @($sheetData.ChildNodes | Where-Object { $_.LocalName -eq 'row' })
    foreach ($row in $rows) {
        if ([int]$row.r -eq $rowNumber) {
            return $row
        }
    }

    $newRow = $xml.CreateElement('row', $ns)
    $newRow.SetAttribute('r', [string]$rowNumber)
    $insertBefore = $null
    foreach ($row in $rows) {
        if ([int]$row.r -gt $rowNumber) {
            $insertBefore = $row
            break
        }
    }
    if ($insertBefore -ne $null) {
        [void]$sheetData.InsertBefore($newRow, $insertBefore)
    } else {
        [void]$sheetData.AppendChild($newRow)
    }
    return $newRow
}

function Clear-CellChildren($cell) {
    while ($cell.HasChildNodes) {
        [void]$cell.RemoveChild($cell.FirstChild)
    }
    foreach ($attrName in @('t', 'cm', 'vm', 'ph')) {
        if ($cell.HasAttribute($attrName)) {
            $cell.RemoveAttribute($attrName)
        }
    }
}

function Set-InlineString($xml, $rowNode, [string] $cellRef, $value) {
    $cell = Ensure-Cell $xml $rowNode $cellRef
    Clear-CellChildren $cell
    if ($null -eq $value -or [string]$value -eq '') {
        return
    }
    $ns = $xml.DocumentElement.NamespaceURI
    $cell.SetAttribute('t', 'inlineStr')
    $is = $xml.CreateElement('is', $ns)
    $text = $xml.CreateElement('t', $ns)
    [void]$text.SetAttribute('space', 'http://www.w3.org/XML/1998/namespace', 'preserve')
    $text.InnerText = [string]$value
    [void]$is.AppendChild($text)
    [void]$cell.AppendChild($is)
}

function Set-Number($xml, $rowNode, [string] $cellRef, [double] $value) {
    $cell = Ensure-Cell $xml $rowNode $cellRef
    Clear-CellChildren $cell
    $ns = $xml.DocumentElement.NamespaceURI
    $v = $xml.CreateElement('v', $ns)
    $v.InnerText = [string]::Format([Globalization.CultureInfo]::InvariantCulture, '{0}', $value)
    [void]$cell.AppendChild($v)
}

function Add-WrapStyleClone([xml] $stylesXml, [int] $baseStyleId) {
    $ns = $stylesXml.DocumentElement.NamespaceURI
    $manager = New-Object System.Xml.XmlNamespaceManager($stylesXml.NameTable)
    $manager.AddNamespace('m', $ns)
    $cellXfs = $stylesXml.SelectSingleNode('/m:styleSheet/m:cellXfs', $manager)
    if ($null -eq $cellXfs) { throw 'styles.xml has no cellXfs collection.' }
    $xfNodes = @($cellXfs.ChildNodes | Where-Object { $_.LocalName -eq 'xf' })
    if ($baseStyleId -lt 0 -or $baseStyleId -ge $xfNodes.Count) {
        throw "Base style id is out of range: $baseStyleId"
    }

    foreach ($child in @($xfNodes[$baseStyleId].ChildNodes)) {
        if ($child.LocalName -eq 'alignment' -and $child.GetAttribute('wrapText') -eq '1') {
            return $baseStyleId
        }
    }

    $clone = $xfNodes[$baseStyleId].CloneNode($true)
    $clone.SetAttribute('applyAlignment', '1')
    $alignment = $null
    foreach ($child in @($clone.ChildNodes)) {
        if ($child.LocalName -eq 'alignment') {
            $alignment = $child
            break
        }
    }
    if ($null -eq $alignment) {
        $alignment = $stylesXml.CreateElement('alignment', $ns)
        [void]$clone.AppendChild($alignment)
    }
    $alignment.SetAttribute('wrapText', '1')
    [void]$cellXfs.AppendChild($clone)
    $cellXfs.SetAttribute('count', [string]($xfNodes.Count + 1))
    return $xfNodes.Count
}

function Set-ReadableWebRows([xml] $sheetXml, [xml] $stylesXml) {
    $wrapStyleByBase = @{}
    foreach ($rowNumber in 42..66) {
        $row = Ensure-Row $sheetXml $rowNumber
        $row.SetAttribute('ht', '72')
        $row.SetAttribute('customHeight', '1')
        foreach ($column in @('B', 'C', 'D', 'E', 'I')) {
            $cellRef = "$column$rowNumber"
            $cell = Ensure-Cell $sheetXml $row $cellRef
            $baseStyleId = 0
            if ($cell.HasAttribute('s') -and $cell.GetAttribute('s') -ne '') {
                $baseStyleId = [int]$cell.GetAttribute('s')
            }
            $key = [string]$baseStyleId
            if (-not $wrapStyleByBase.ContainsKey($key)) {
                $wrapStyleByBase[$key] = Add-WrapStyleClone $stylesXml $baseStyleId
            }
            $cell.SetAttribute('s', [string]$wrapStyleByBase[$key])
        }
    }
}

function Get-SheetTarget([xml] $workbookXml, [xml] $relsXml, [string] $sheetName) {
    $mainNs = New-Object System.Xml.XmlNamespaceManager($workbookXml.NameTable)
    $mainNs.AddNamespace('m', 'http://schemas.openxmlformats.org/spreadsheetml/2006/main')
    $mainNs.AddNamespace('r', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships')
    $sheetNode = $workbookXml.SelectSingleNode("//m:sheets/m:sheet[@name='$sheetName']", $mainNs)
    if ($null -eq $sheetNode) { throw "Sheet '$sheetName' was not found." }
    $rid = $sheetNode.GetAttribute('id', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships')

    $relNs = New-Object System.Xml.XmlNamespaceManager($relsXml.NameTable)
    $relNs.AddNamespace('rel', 'http://schemas.openxmlformats.org/package/2006/relationships')
    $relNode = $relsXml.SelectSingleNode("//rel:Relationship[@Id='$rid']", $relNs)
    if ($null -eq $relNode) { throw "Relationship '$rid' was not found." }
    $target = $relNode.Target
    if ($target.StartsWith('/')) {
        return $target.TrimStart('/')
    }
    return "xl/$target"
}

if (Test-Path -Path $stagedPath) {
    Remove-Item -Path $stagedPath -Force
}
if (Test-Path -Path $extractDir) {
    $resolvedExtract = [IO.Path]::GetFullPath($extractDir)
    $resolvedWork = [IO.Path]::GetFullPath($workDir)
    if (-not $resolvedExtract.StartsWith($resolvedWork, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to clear unexpected path: $extractDir"
    }
    Remove-Item -Path $extractDir -Recurse -Force
}

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

function Read-ZipEntryText($zip, [string] $entryName) {
    $entry = $zip.GetEntry($entryName)
    if ($null -eq $entry) { throw "ZIP entry not found: $entryName" }
    $stream = $entry.Open()
    $reader = New-Object IO.StreamReader($stream)
    try {
        return $reader.ReadToEnd()
    } finally {
        $reader.Dispose()
        $stream.Dispose()
    }
}

function Write-ZipEntryText($zip, [string] $entryName, [string] $content) {
    $existing = $zip.GetEntry($entryName)
    if ($null -ne $existing) {
        $existing.Delete()
    }
    $entry = $zip.CreateEntry($entryName, [IO.Compression.CompressionLevel]::Optimal)
    $stream = $entry.Open()
    $writer = New-Object IO.StreamWriter($stream, (New-Object System.Text.UTF8Encoding($false)))
    try {
        $writer.Write($content)
    } finally {
        $writer.Dispose()
        $stream.Dispose()
    }
}

function Get-ZipEntrySha256($zip, [string] $entryName) {
    $entry = $zip.GetEntry($entryName)
    if ($null -eq $entry) { throw "ZIP entry not found: $entryName" }
    $sha256 = [Security.Cryptography.SHA256]::Create()
    $stream = $entry.Open()
    try {
        $hashBytes = $sha256.ComputeHash($stream)
        return -join ($hashBytes | ForEach-Object { $_.ToString('x2') })
    } finally {
        $stream.Dispose()
        $sha256.Dispose()
    }
}

function Convert-XmlToUtf8Text([xml] $xmlDocument) {
    $settings = New-Object System.Xml.XmlWriterSettings
    $settings.Encoding = New-Object System.Text.UTF8Encoding($false)
    $settings.Indent = $false
    $settings.OmitXmlDeclaration = $false
    $stringBuilder = New-Object System.Text.StringBuilder
    $writer = [System.Xml.XmlWriter]::Create($stringBuilder, $settings)
    try {
        $xmlDocument.Save($writer)
    } finally {
        $writer.Close()
    }
    return $stringBuilder.ToString() -replace 'encoding="utf-16"', 'encoding="UTF-8"'
}

Copy-Item -Path $targetPath -Destination $stagedPath -Force
$zip = [IO.Compression.ZipFile]::Open($stagedPath, [IO.Compression.ZipArchiveMode]::Update)
try {
    [xml]$workbookXml = Read-ZipEntryText $zip 'xl/workbook.xml'
    [xml]$relsXml = Read-ZipEntryText $zip 'xl/_rels/workbook.xml.rels'
    $webSheetRelative = Get-SheetTarget $workbookXml $relsXml 'Test Cases (Web)'
    $mobileSheetRelative = Get-SheetTarget $workbookXml $relsXml 'Test Cases (Mobile)'

    if ($webSheetRelative -eq $mobileSheetRelative) {
        throw 'Web and Mobile sheets resolved to the same XML target.'
    }

    [xml]$sheetXml = Read-ZipEntryText $zip $webSheetRelative
    [xml]$stylesXml = Read-ZipEntryText $zip 'xl/styles.xml'
    if (-not (Test-Path -Path $authoredValuesPath)) {
        throw "Artifact-authored values file is missing: $authoredValuesPath"
    }
    $payload = Get-Content -Path $authoredValuesPath -Raw | ConvertFrom-Json
    $passCount = [int]$payload.passCount
    $failCount = [int]$payload.failCount

    foreach ($update in $payload.cells) {
        $address = [string]$update.address
        $rowNumber = [int]($address -replace '\D', '')
        $row = Ensure-Row $sheetXml $rowNumber
        if ($update.type -eq 'number') {
            Set-Number $sheetXml $row $address ([double]$update.value)
        } elseif ($update.type -eq 'blank') {
            Set-InlineString $sheetXml $row $address $null
        } else {
            Set-InlineString $sheetXml $row $address $update.value
        }
    }

    Set-ReadableWebRows $sheetXml $stylesXml

    $xmlText = Convert-XmlToUtf8Text $sheetXml
    Write-ZipEntryText $zip $webSheetRelative $xmlText
    $stylesText = Convert-XmlToUtf8Text $stylesXml
    Write-ZipEntryText $zip 'xl/styles.xml' $stylesText
    $sha = Get-ZipEntrySha256 $zip $mobileSheetRelative
} finally {
    $zip.Dispose()
}

[pscustomobject]@{
    stagedPath = $stagedPath
    webSheet = $webSheetRelative
    mobileSheet = $mobileSheetRelative
    mobileSheetSha256 = $sha
    passCount = $passCount
    failCount = $failCount
    pendingCount = 55 - $passCount - $failCount
    rating = $passCount / 55
} | ConvertTo-Json -Compress
