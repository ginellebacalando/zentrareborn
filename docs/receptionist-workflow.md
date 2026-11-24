# Receptionist Chatbot Orchestration Workflow

## Overview

This document describes the end‑to‑end orchestration flow for **Zeni**, the virtual receptionist of Zion. The workflow is split into two coordinated sub‑workflows:

1. **Receptionist Front‑End** – Handles client greetings, answers business‑related queries, and drives the conversion to a booking.
2. **Booking Process Bot** – Takes the confirmed intent from the receptionist and completes the scheduling, payment and confirmation steps.

Both sub‑workflows communicate via a shared message queue (or direct function call) and must respect the design‑standard, WCAG 2.2 AA, and the project’s token system.

---

## 1. Receptionist Front‑End Flow

| Step | Actor                | Action                                                                                                                  | Key Implementation Details                                                                                                   |
| ---- | -------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1️⃣   | **Client**           | Opens the website and sees the receptionist avatar button (fixed at the bottom‑right).                                  | `ChatLauncher` component with `z‑index: 999`.                                                                                |
| 2️⃣   | **Receptionist Bot** | Greets the client with a **single‑line greeting** (e.g., _“Hello, how may I help you?”_).                               | Greeting rendered in `<p className={styles.greetingText}>` only. Background colour `var(--palette-chat-canvas)` → `#FFE1AF`. |
| 3️⃣   | **Client**           | Types a business‑related question.                                                                                      | Input is sent to `services/orchestration/receptionist.ts` which queries the knowledge base.                                  |
| 4️⃣   | **Receptionist Bot** | Responds with factual information **only** from the supplied knowledge base.                                            | No fabricated answers. Uses `chatbotReceptionist.responses`.                                                                 |
| 5️⃣   | **Receptionist Bot** | Detects intent to **book** (keyword/intent model).                                                                      | If intent confidence > 0.85, transition to booking.                                                                          |
| 6️⃣   | **Receptionist Bot** | Sends a **booking prompt** and a **“Book Now”** button (styled like the FAQ button).                                    | Button component placed in `app/faq/_components/FAQClient.tsx` – links to `/booking`.                                        |
| 7️⃣   | **Client**           | Clicks **Book Now** → navigates to the Booking page.                                                                    | Placeholder page `app/booking/page.tsx`.                                                                                     |
| 8️⃣   | **Receptionist Bot** | Persists the conversation context (client ID, selected service, preferred date) in `services/orchestration/context.ts`. |
| 9️⃣   | **Receptionist Bot** | Sends a **hand‑off message** to the **Booking Process Bot** via `orchestrator.sendMessage('booking', payload)`.         |

### UI Requirements

- **Z‑index**: Ensure the launcher and greeting bubble stay above any client‑panel elements (`z-index: 999` for dock, `z-index: 10` for greeting).
- **Color token**: `--palette-chat-canvas` must be set to `#FFE1AF` (already defined in `styles/tokens.css`).
- **Greeting bubble**: Only the greeting text; no extra UI controls. Implemented by rendering only the `<p>` element.
- **Accessibility**: `aria-live="polite"`, sufficient contrast (> 4.5:1), focusable button with visible outline.

---

## 2. Booking Process Bot Flow

| Step | Actor                | Action                                                                                          | Implementation                                                                                     |
| ---- | -------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| A1   | **Booking Bot**      | Receives payload from Receptionist (service, client name, etc.).                                | `services/orchestration/bookingHandler.ts`.                                                        |
| A2   | **Booking Bot**      | Shows a booking UI (date picker, contact form).                                                 | New route `app/booking/page.tsx` – placeholder UI for now.                                         |
| A3   | **Client**           | Completes the form and confirms.                                                                | Validation via `react-hook-form` and server‑side `services/booking/create.ts`.                     |
| A4   | **Booking Bot**      | Persists the booking in the database and sends a confirmation message back to the Receptionist. | `services/booking/save.ts`.                                                                        |
| A5   | **Receptionist Bot** | Displays a **confirmation bubble** in the chat with the booked details.                         | Uses same greeting bubble component but with a different style (`--chat-surface-card` stays same). |

---

## 3. Error & Fallback Handling

- If the knowledge base does not contain an answer, the receptionist replies with a polite decline: _“I’m sorry, I don’t have that information right now. May I help you with something else?”_.
- If the booking intent detection fails, the bot gently nudges: _“Would you like to schedule a meeting with our team?”_.
- All fallback messages are **static** and stored in `config/chatbot-receptionist.ts`.

---

## 4. Verification Checklist (run `npm run verify`)

- ✅ Lint passes (`eslint`, `prettier`).
- ✅ TypeScript compiles (`tsc`).
- ✅ WCAG contrast check for `#FFE1AF` vs text colour.
- ✅ Greeting bubble contains only `<p>` with the greeting text.
- ✅ Z‑index ensures chatbot stays in front of client panel.
- ✅ “Book Now” button appears in FAQ sidebar and links to `/booking`.
- ✅ Placeholder booking page renders without 404.
- ✅ Orchestration flow logs the hand‑off event (`services/orchestration/logger.ts`).

---

## 5. Design Change Log Entry

| Date       | Change                                                                                                                                       | File(s)                                                                                                           | Owner             |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------- |
| 2026‑11‑22 | Added booking button to FAQ sidebar, updated greeting bubble colour, created receptionist workflow markdown, added placeholder booking page. | `app/faq/_components/FAQClient.tsx`, `styles/tokens.css`, `docs/receptionist-workflow.md`, `app/booking/page.tsx` | Antigravity (AGY) |

---

_End of document_
