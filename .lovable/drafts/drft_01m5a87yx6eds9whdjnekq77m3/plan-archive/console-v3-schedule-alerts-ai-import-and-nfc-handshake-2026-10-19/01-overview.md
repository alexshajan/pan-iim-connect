# Console v3 — Schedule, Alerts, AI import, and NFC handshake

Four pieces in one pass, built in this order so each can be tried as it lands.

## 1. Schedule board (`/console/schedule`)
A calendar-style board for the whole timetable, made for parallel tracks.
- **Day tabs** for 27, 28 and 29 Nov. Time runs down the left side; each venue gets its own column. A **By track** toggle switches the columns to tracks.
- **Session blocks** are coloured by track. Each shows title, chair, number of papers and status (On time, Delayed +15, Moved, Cancelled).
- **Edit in place**: drag a block to change its time or room, or drag its bottom edge to change its length. Click a block to open a side panel where you can edit details, chair, papers (add, remove, reorder) and status.
- **Clash flags**: two sessions booked in the same room at once, or a chair or presenter needed in two rooms at the same time. Flagged blocks get a red outline, and a clash list sits above the board.
- **Undo** the last change. Every edit goes into the Activity log.
- **Publish changes**: if you move a session that has already been published, you get the option to send an alert at the same time ("Session moved to NAB 104").

## 2. Alerts (`/console/alerts`)
This replaces the alert tool on the old admin page.
- **Types**: Info, Schedule change, Urgent/weather, Food & logistics.
- **Audience**: Everyone, Presenters, Track chairs, Volunteers, or the people in one session.
- Choose **Send now** or **Schedule**, and set an optional end time. Urgent alerts stay pinned at the top of Home and Agenda until they end.
- A history list where any alert can be withdrawn.

## 3. AI schedule import (`/console/schedule/import`)
- Upload a PDF, image, Excel or CSV timetable.
- The AI reads it into sessions: date, time, venue, track, title, chair and papers.
- Each row is matched against your existing data (venues, tracks, submissions by code or title, people by name). A label shows how good each match is: green (exact), amber (close, please confirm) or red (new).
- A preview shows what will be added, changed or left alone. You can fix any row, then press **Apply**. The import is saved as a batch you can undo.

## 4. NFC/QR: profile link vs handshake link
- **`/id/CODE`**: the profile link. It is safe to share anywhere and only lets people view the profile. It has an "Add to my network" button.
- **`/c/CODE`**: the handshake link. It gets written onto the NFC card and shown as the pass QR.
  - **Signed-in viewer**: a one-tap "Met Prof. X — Connect" button, which stops accidental taps from adding people. Both people are then added to each other's "People I've met", with the method recorded (NFC or QR). A success screen shows shared interests and papers, plus a quick note box.
  - **Signed-out viewer**: the profile, a contact card download, and "Sign in to connect". After signing in, they come back and the connection finishes.
  - **Card not activated yet** (the person hasn't been checked in): only the profile shows, without the handshake.
- Changes to Me: the pass QR now uses the handshake link, and "Share profile" uses the profile link.

## Base lifecycle gaps closed in this pass
- Checking someone in at the desk activates their card for handshakes.
- After first sign-in, people are sent to onboarding if their profile isn't finished. If they tapped a handshake link before signing in, they return to it afterwards.
- Visitors see their pass and a "Claim presenter role" button. Claims go to the Review queue.
- The old admin page shows a "Moved to console" link for Schedule and Alerts.
