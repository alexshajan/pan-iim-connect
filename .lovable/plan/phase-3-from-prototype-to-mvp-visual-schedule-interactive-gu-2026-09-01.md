# Phase 3 — From prototype to MVP: visual schedule, interactive guide, experiential layer

Current state: five guest routes (Now, Agenda, Map, Guide, Me), session detail, updates, auth, and an organizer console — all rendered as vertical card lists. Data exists for sessions, papers, tracks, venues, map pins, content blocks, announcements, participants, bookmarks, help requests.

The gap to MVP is threefold: (1) parallel sessions are unreadable as a flat list, (2) the guide is static prose that ignores who you are and when you arrive, (3) nothing yet makes the app feel like an event companion rather than a website.

---

## 1. Visualising parallel paper presentations

Replace the flat agenda list with three switchable views (segmented control, remembered per user):

**Grid view (default on landscape / tablet)** — a time-by-room grid: rooms as columns, time down the left, each session a coloured block sized to its duration. Track colour fills the block, live sessions pulse, starred sessions get a filled marker. Horizontal scroll with a sticky room header and a sticky "now" line that moves through the day.

**Timeline view (default on phone)** — vertical time rail on the left; at each slot, parallel sessions appear as a horizontally swipeable row of compact cards, with a dot indicator showing "3 rooms running now". Conflict badge when two starred sessions overlap.

**List view** — the current chronological list, kept for scanning and search.

Supporting pieces:
- **Slot sheet**: tapping a time slot opens a bottom sheet comparing every parallel session in that slot side by side, with paper titles and authors, so a delegate decides where to walk.
- **Conflict resolver**: when starred sessions clash, a banner in My Agenda shows the clash and lets you swap or split (attend paper 2 of Session A, then Session B).
- **Track legend** as coloured pills, tappable to filter.
- **Paper-level search** across titles, authors, institutions and keywords — currently only sessions are searchable.
- **"Walk time" hint** between back-to-back sessions in different buildings.

## 2. Making the Guide actually interactive

Convert static content blocks into small decision tools:

- **Travel planner**: pick origin city, arrival date and budget style; it produces a ranked door-to-campus itinerary (flight/train → Guwahati → sumo/taxi/heli) with cost band, duration, and a "last safe departure" warning for evening arrivals in the hills.
- **Cost estimator**: shared vs private cab, group size split, live-ish price ranges maintained by organizers.
- **Arrival checklist**: personalised, dated tasks — ILP/ID notes, weather-appropriate clothing for December Shillong, cash/ATM advice, SIM/connectivity, campus check-in point and time.
- **Day-trip planner**: pick a free half-day or the post-conference day; it suggests feasible Meghalaya itineraries (Mawlynnong, Dawki, Cherrapunji, living root bridges) with drive time, cost, and difficulty, plus a "book a shared vehicle" interest form so co-travellers can pool.
- **Eat & services finder**: filter campus and nearby food by open-now, veg/non-veg/Jain, price and distance, each linked to its map pin.
- **Weather and daylight strip** for conference days so people dress and plan travel correctly.
- **Contacts become actions**: one-tap call/WhatsApp, categorised by problem (medical, transport, accommodation, AV, registration), with an escalation path.

## 3. Experiential and value-adding features

Ranked by value per unit of build effort.

**In MVP**
- **Personal "My Day" itinerary card**: your next thing, where it is, how long it takes to walk, plus your presentation slot highlighted with a countdown and a pre-flight checklist for presenters.
- **Presenter kit**: slot, room, chair name, AV specifics, time limits, slide upload deadline, discussant details.
- **Live status layer**: organizers can mark a session delayed / room-changed / cancelled and every delegate viewing it sees it immediately; a subtle "updated 2 min ago" stamp builds trust.
- **Notifications**: web push for schedule changes affecting your starred sessions, your own presentation reminder, and urgent announcements. Quiet hours respected.
- **Offline mode**: schedule, map, contacts and guide cached — campus connectivity in Umsawli is unreliable.
- **QR badge**: each delegate gets a QR in Me for check-in and quick profile exchange.

**Networking (consent-gated, ships right after core MVP)**
- Opt-in profile with research interests, institution, and a one-line "ask me about".
- Browse and filter delegates by interest/track; shortlist people to meet; the app suggests where your paths cross (same session, same meal slot).
- Mutual-interest reveal: contact details or LinkedIn only exchanged when both sides opt in.

**Experiential extras (post-MVP, cheap and high delight)**
- Session feedback and paper ratings, one tap, aggregated for organizers.
- Live Q&A queue with upvotes for keynotes.
- Photo wall / moments feed, moderated.
- Meghalaya passport: light gamified stamps for attending tracks, visiting venues, meeting new people — a nudge, not a game.
- Post-conference digest: sessions you attended, papers you starred, people you met, with a downloadable contact card set.

## 4. Organizer console gaps before MVP

- Drag-free but fast schedule editing (time/room/status) with an audit trail and automatic notification to affected delegates.
- Bulk import for papers and presenters, not just the roster.
- Room-occupancy view to spot clashes and empty halls.
- Announcement composer with audience targeting (all / track / residence / presenters).
- Help-desk queue with assignment and resolution states.
- Live dashboard: check-ins, most-starred sessions, open help requests.

## 5. Technical notes

- Grid/timeline views are pure presentation over the existing `sessions` + `papers` queries; a `sessionsByDayAndRoom` selector plus a shared time-scale helper is all the new data logic needed.
- New tables: `presenter_profiles` (consent flag, interests), `connections` (mutual opt-in), `session_feedback`, `push_subscriptions`, `travel_options` (organizer-editable costs), `day_trips`, `checklist_items`. Each with GRANTs plus RLS on the same pattern as existing tables.
- Notifications: web push via a service worker, subscription stored per user, sends triggered from a server function on schedule change; offline caching in the same service worker.
- Weather via a server function proxying a free forecast API, cached hourly.
- Two open security-linter warnings (signed-in users can execute the `has_role` / `is_organizer` definer functions) get resolved as part of this phase.

## 6. Suggested build order

1. Agenda grid + timeline + slot sheet + conflict resolver + paper search
2. My Day, presenter kit, live status layer
3. Interactive guide tools (travel planner, checklist, day trips, food finder, contacts)
4. Organizer console upgrades (schedule edit + audit, targeted announcements, help queue, dashboard)
5. Notifications + offline caching + QR badge
6. Consent-gated networking
7. Feedback, Q&A, passport, post-conference digest
