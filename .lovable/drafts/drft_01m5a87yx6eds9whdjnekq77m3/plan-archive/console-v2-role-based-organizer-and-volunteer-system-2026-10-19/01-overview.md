# Console v2 — role-based organizer and volunteer system

One console at `/console` with a conventional ERP layout: left sidebar, top bar with global search, dense tables, side panels for editing. What each person sees depends on their role, so new roles and screens can be added later without rebuilding anything.

## Roles

| Role | Who | Can do |
|---|---|---|
| Admin | Conference office | Everything, plus assign roles to other people |
| Editor | Faculty organizers, secretariat | Manage people, submissions, schedule, guide, announcements, decks |
| Desk volunteer | Registration desk | Check people in, look up passes, show sign-in QR |
| Room volunteer | Session rooms | Open the room's slide decks, report room issues |
| Help volunteer | Help desk | Work the help queue, look up people (no phone/address) |

A person can hold several roles. Admins assign them from a Team page; nobody can give themselves a role.

## Screens (sidebar groups)

**Overview** — counts (registered, signed in, checked in today, open issues), today's alerts, recent edits.

**Registry** — People, Submissions, Imports, Review queue (duplicates, role claims). Existing screens, restyled into the ERP layout.

**Event ops** — Schedule, Rooms and venues, Announcements, Dining (folded in from the old `/admin` pages).

**On-site** (new)
- *Check-in desk*: scan a pass QR with the phone/laptop camera, or type a name/code. Shows photo-less identity card (name, organisation, role, papers), one big "Check in" button, warnings (already checked in, visitor pass, unpaid). Not-signed-up people get a large QR to the sign-in page. Live counter by hour.
- *Deck drive*: folders grouped by Room, Track or Day (organizer picks the default). Each folder lists that room's sessions in time order with their slides; one tap opens or downloads the file. Room volunteers land straight on today's view.
- *Help queue*: incoming requests, assign, resolve.

**Content** — Guide data, Placeholders (test data).

**Admin** — Team and roles, Activity log, Settings (deck grouping, check-in rules).

## Key user flows

1. **Assign a volunteer**: Admin → Team → search person → tick roles → saved and logged. Their console shows only their screens on next load.
2. **Check someone in**: Desk volunteer opens Check-in → scans QR → card appears → Check in → green confirmation, counter updates. Scanning again shows "Already checked in at 9:12 by Riya" instead of a duplicate.
3. **Upload slides**: Editor (and later the presenter from Me) uploads a file to a submission; it appears in that room's folder automatically, newest version on top.
4. **Run a room**: Room volunteer on the room PC → Deck drive → Room 104 → Today → next session's deck opens.
5. **Fix a mistake**: Admin can undo a check-in; every check-in, upload and role change is in the activity log.
