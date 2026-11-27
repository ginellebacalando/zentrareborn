# Zeni workflow: from a question to the right next step

Zeni, the virtual concierge, answers from Zion's published information and moves guests to the right next step. It never takes, holds, changes or confirms a booking. Every step below runs inside this application; there is no external workflow tool. Implementation details, privacy rules and configuration are in [chatbot.md](chatbot.md).

## 1. Information

| Step | Actor | What happens                                                                                                                                                               |
| ---- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Guest | Opens Zeni from the launcher (bottom right) or an "Ask about this space" button.                                                                                           |
| 2    | Zeni  | Greets in English, or in Taglish when the guest writes in Filipino or Taglish, and offers "Check a date", "Wedding packages" and "Schedule a visit".                       |
| 3    | Zeni  | Retrieves the matching published sources. If the model is configured, it phrases a short answer from those sources only; otherwise Zeni shows the published text directly. |
| 4    | Zeni  | Shows the sources, photo cards for facilities, packages or event pages, and the next steps. When nothing published answers the question, Zeni says so and offers staff.    |

## 2. Dates and booking

| Step | Actor | What happens                                                                                                                                                                            |
| ---- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Guest | Asks about a date or wants to book ("May available pa ba kayo sa Oct 9?").                                                                                                              |
| 2    | Zeni  | Without a date, shows the availability calendar card (the booking window, held or confirmed events marked booked). With a date, checks the admin calendar for that date or time window. |
| 3    | Zeni  | Reports the timestamped result. A free date is not a reservation. Booked dates come with the calendar to pick another date.                                                             |
| 4    | Guest | Chooses **Book this date**: the booking page opens with the event, package style, date, time and guest count already filled in (`/booking?…&source=zeni`).                              |
| 5    | Staff | Review the booking request in the admin panel and confirm it there. Zeni is not involved after the link.                                                                                |

## 3. Ocular visits

Zeni shares the published visiting hours (by appointment) and offers **Schedule an ocular visit**, which opens the visit page with the date being discussed preselected when it has open times (`/visit?date=…&source=zeni`). The visitor picks an open time and gets a confirmation email with a calendar invitation at once; staff see the visit on the Front desk ([docs/visits.md](visits.md)). Earlier links to `/contact?topic=visit` still open the contact form with a visit message.

## 4. Staff hand-off

"Talk to staff", complaints, special requests, reschedules and cancellations go to staff. Zeni asks for a name and an email, then asks permission before sending. With consent it creates one inquiry in the admin inbox (source `zeni_receptionist`), and the built-in automation queues the staff alert and the guest's acknowledgement email. Zeni never cancels or reschedules a booking itself.

## 5. Learning loop

Questions Zeni could not answer are logged without personal details and grouped in **Admin → Zeni → Unanswered questions**. Staff publish the missing FAQ or update the package or policy, then mark the question resolved. The "Ask Zeni" test console checks the answer without storing anything.

## Fallbacks and errors

- Model off, over its limit, slow or rejected: the published text itself, with the same sources and buttons.
- Calendar unavailable: Zeni does not guess, offers the booking form and staff.
- Server or connection errors: the message stays in the input with a retry, in the guest's language.
- Interrupted turn: "Retry previous message" reuses the original turn, so nothing is sent twice.
