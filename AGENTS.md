<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Mandatory design and engineering rules

These rules govern the **current application and every future fix, feature, enhancement, and refactor**, across public, administrator, and developer surfaces. Read [the design and engineering standard](docs/design-standard.md) and [architecture](docs/architecture.md) before changing the system. Preserve unrelated local work.

- Use `styles/tokens.css` as the foundation for colors, typography, spacing, sizing, radii, and motion. Reuse `styles/primitives.css` and existing feature components. Do not introduce a competing palette, font stack, arbitrary tiny text, or duplicated layout system.
- Target WCAG 2.2 AA. Use semantic HTML, logical headings, persistent form labels, explicit status/error feedback, keyboard access, visible focus, and accessible names. Prefer native controls/dialogs. Keep essential content readable without animation. Respect reduced motion; provide pause controls for automatic media.
- Read current local Next.js guides before changing routing, rendering boundaries, fonts, or CSS. Keep route-local code in private `_folders`; reusable UI in `components/`; static configuration in `config/`; shared infrastructure in `lib/`; server workflows in `services/`. Never import route implementations into shared UI or server-only dependencies into browser code.
- Follow `.editorconfig`, Prettier, strict TypeScript, and ESLint. Use focused components and functions, descriptive names, named domain types, and explicit error handling. Comments explain reasons or contracts. Do not reformat files with alternate personal conventions.
- Run `npm run verify` before declaring implementation complete. Do not bypass a failing check, weaken rules, add broad lint suppressions, or expand `docs/design-exceptions.json` to make changes pass. Legacy exceptions are a migration inventory, not approval for new debt or evidence of conformance.
- For affected screens, verify desktop and 320px mobile layouts, keyboard operation, visible focus, 200% text scaling / 400% zoom reflow, light/dark themes where supported, reduced motion, and relevant loading/empty/error/success states. Report what was actually checked and what remains unverified. Automated checks do not replace human review or user evaluation.
- Use the process and change record in `docs/design-standard.md`. Record the user task, affected files/screens, checks, and limitations for material design changes.

### Design coordination across all panels

The user explicitly instructed Design Checker to coordinate design with the **admin, client, receptionist, and developer** work chats after panel updates or enhancements. This standing rule applies to current work and future changes, including functional updates that affect visible content, navigation, or interaction states.

Use these existing chats on the local host in `C:/Users/jerom/Downloads/ZenTra-Web`:

| Panel / responsibility            | Existing chat title    | Chat ID                                |
| --------------------------------- | ---------------------- | -------------------------------------- |
| Administrator                     | Admin panel developer  | `01a1b015-4221-74e3-9436-578e8066c855` |
| Public client                     | Client panel developer | `01a1e86c-a06e-7563-ba02-c4eef00d1662` |
| Receptionist / Ask Zion assistant | receptionist chatbot   | `01a1e870-2dee-7d41-a2bf-e588153feaff` |
| Developer workspace               | Locate dev panel       | `01a1e074-3bc3-7ef1-95ac-ab12e3201b27` |

- Before shared foundations or overlapping files change, notify the affected chats and agree on source ownership. Notify all four when a shared change affects all panels. Preserve active work; a coordination notice does not request unrelated feature implementation.
- After an update or enhancement, assess its design impact and send the affected chats a verified handoff: affected screens/files, typography/palette/layout/motion changes, interaction states, keyboard/mobile/theme checks, actual verification results, screenshots where useful, unresolved findings, and review limits. Share cross-panel effects with every affected owner.
- Reuse shared tokens and preserve approved panel-specific palettes and user preferences. Consistency does not mean forcing all panels into an identical theme.
- Keep the design change log current. Do not report an update as reviewed solely because a message was sent; distinguish notice, completed verification, findings, and unresolved review work.
- Do not include credentials, tokens, or unrelated private data. Rediscover chats if titles/IDs change; do not invent recipients or create replacement chats without the user's instruction. If messaging is unavailable, report the pending handoff honestly.

The Design Checker chat is `01a1e7c9-e34b-7a63-9beb-e82e9a11736e` on the local host. This coordination rule does not expand panel feature scope, deployment authority, or access permissions.

### Admin updates and Design Checker

The user also explicitly authorizes **admin panel dev** to talk with the existing **Design Checker** chat after every administrator-panel update or enhancement. Notify it before changes that may overlap shared foundations, then send the completed scope, affected files/screens, verification results, screenshots where relevant, and review limits. Use the existing Design Checker chat (`01a1e7c9-e34b-7a63-9beb-e82e9a11736e`, local host); rediscover it by exact title if needed. Preserve the requested feature scope and coordinate source ownership before parallel edits. Do not create a new chat or send credentials, tokens, or unrelated private data. If tools are unavailable, report the pending handoff honestly.
