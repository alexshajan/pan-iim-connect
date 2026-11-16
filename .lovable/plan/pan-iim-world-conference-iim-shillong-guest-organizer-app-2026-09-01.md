# Pan-IIM World Conference — IIM Shillong: Guest & Organizer App

A mobile-first web app (installable, works on any phone, no app store) for ~1000 guests and presenters, plus an organizer console behind it. Phase 1 covers the guest core and admin basics; networking comes in a later phase but the data model is laid so it drops in cleanly.

## How people use it

Public by default — anyone with the link sees schedule, venues, maps, travel and city info. Signing in (email OTP, matched against the roster organizers upload) unlocks the personal layer: your sessions, your room, your presentation slot, your bookmarks, your notifications.

Bottom tab bar, five destinations, thumb-reachable:

```text
 Now        Agenda      Map        Guide       Me
 live +     full        campus +   travel,     personal
 next up    schedule    venues     food, city  agenda + info
```

## Guest features (Phase 1)

**Now** — the landing screen. What is happening right this minute, what starts next, where it is, plus any live announcement banner from organizers. If you are signed in it prioritizes your sessions and shows your next commitment with a walking estimate to the venue.

**Agenda** — the full conference schedule, filterable by day, track, venue, and session type. Paper presentations are first-class: parallel tracks shown per venue/time-slot, each with title, authors, affiliation, abstract, chair/discussant. Anyone can star sessions; signed-in users get them synced across devices and reminder notifications. Schedule changes are flagged visibly ("Moved to Auditorium B", "Delayed 20 min").

**Map** — Google Maps-guided campus navigation. Pinned layers for academic blocks, session venues, hostels/residences, dining, medical, help desks, parking, shuttle stops. Tap a pin for photos, directions from your current location, and what's happening there now. Also covers off-campus venues (banquet, city hotels). Works in a degraded but useful "static campus map + list" mode when signal is poor.

**Guide** — the aggregated information layer:
- Getting here: flight/train/road options and combinations (Guwahati airport → Shillong taxi/shared cab/bus, Umroi airport, Shillong city → IIM campus) with expected price ranges, durations, and booking pointers.
- On campus: eateries with hours, ATMs, printing, laundry, medical, Wi-Fi instructions.
- Meghalaya: curated things to do, day trips (Cherrapunjee, Dawki, Mawlynnong), local etiquette, weather, what to pack.
- Contacts: categorized resource persons (registration, accommodation, tech support, transport, medical, security) with tap-to-call and WhatsApp.

**Me** — your personalized conference: assigned residence and room, your presentation slot and venue, your starred sessions as a timeline, your QR badge, notification history, and a help/report form that reaches organizers.

**Pain points addressed beyond the brief** — these are the gaps worth closing for a 1000-person, multi-venue, monsoon-prone campus event:
- Offline-first caching so schedule, map and contacts survive weak campus signal.
- "Take me there" walking directions with a time estimate, so parallel-track hopping actually works.
- Live delay/room-change alerts pushed to only the people affected.
- Session capacity/"filling up" indicator for popular parallel tracks.
- Presenter checklist: your slot, your room, AV setup, upload-slides deadline, chair's name.
- Meals & shuttle timings surfaced on Now, not buried.
- Lost & found and an SOS/medical shortcut always reachable from Me.
- Language/accessibility: large-type toggle, high-contrast mode, screen-reader-clean markup.
- Feedback per session and an overall post-event survey.
- FAQ that organizers can edit, cutting repeat questions at the help desk.

## Organizer console

Web console at `/admin`, role-gated (super-admin, editor, volunteer):
- Schedule editor: create/move/cancel sessions and paper presentations; any change auto-notifies affected attendees and stamps the public schedule as "updated".
- Roster upload: CSV/XLSX import of participants with email, role, affiliation, assigned residence/room, presentation slot; validation preview before commit.
- Content editor: travel info, eateries, city guide, contacts, FAQ — no code needed.
- Map manager: add/edit pins, categories, photos.
- Notifications: compose and send to everyone, a track, a residence block, or presenters only; schedule for later; see delivery.
- Activity dashboard: sign-ins, most-viewed sessions, star counts, feedback, help requests.

## Design system

Base direction adapted from ycp.iimranchi.ac.in — clean card surfaces, generous white space, soft shadows, restrained motion, academic-but-modern. Applied as a real token system, not a theme skin:

- Palette: deep institutional indigo-navy primary, warm sandstone accent nodding to Shillong's hills, near-white paper background, one clear semantic set for live/upcoming/changed/cancelled states. Full dark mode.
- Type: a humanist serif for section headers and session titles (editorial, not corporate), a clean grotesque for UI and body. Tight, deliberate scale — no generic Inter-everywhere look.
- Cards: the primary unit. Consistent radius, one-level elevation, a left accent rail to encode session state. Compact and expanded variants.
- Motion: short, physical transitions — sheet slide-ups, list stagger on load, tap depression. Nothing decorative, nothing looping.
- Layout: mobile-first single column with sticky day/filter chips; desktop admin gets a sidebar shell reusing the same tokens.
- Deliberately avoided: purple gradients, three-column feature grids, emoji icons, hero stock photography, "Get started" copy.

Everything is built on semantic tokens in `src/styles.css` so palette or type can be swapped later without touching components.

## Technical approach

- TanStack Start with file-based routes; public routes top-level, `_authenticated/*` for personal features, `_authenticated/_admin/*` for the console.
- Lovable Cloud for database, auth (email OTP), file storage (speaker photos, map images, roster uploads), and role storage in a separate `user_roles` table with a `has_role` security-definer function.
- Schema: events/sessions, tracks, venues, papers, presenters, participants, residences, bookmarks, notifications, content blocks (travel/food/city/contacts/FAQ), map pins, feedback, activity log. Public read via narrow anon policies; writes admin-only.
- Google Maps via the Maps connector for campus navigation and directions; static fallback map bundled for offline.
- Route loaders + TanStack Query for data; server functions for admin mutations and roster import.
- PWA manifest and service-worker caching for offline schedule/map/contacts.
- Per-route SEO metadata so the public schedule and city guide are shareable and indexable.

## Build order

1. Design system, tokens, app shell, tab navigation, card primitives.
2. Cloud enablement, schema, seed with realistic conference data.
3. Now, Agenda (with paper sessions and filters), session detail.
4. Map with Google Maps + pins; Guide sections.
5. Auth, Me, personalization, bookmarks, notifications.
6. Admin console: schedule editor, roster import, content editor, notifications, activity.
7. Offline caching, accessibility pass, polish.
