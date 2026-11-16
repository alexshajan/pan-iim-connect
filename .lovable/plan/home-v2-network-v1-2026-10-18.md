# Home v2 + Network v1

## 1. Home: what's wrong today

- The big campus photo takes up most of the first screen and tells the guest nothing.
- The cards are in one flat column, so a notice, the countdown, meals and quick links all look equally important.
- "Quick help" repeats the bottom tabs (Campus, Guide, Me).
- The live-day view has no "happening now" list of parallel rooms. That was in the plan but was never built.
- Food & services always sits in the same spot, even before the conference, when it doesn't matter yet.
- There's no way into Network and no key deadlines.
- Nothing moves except the strip, so the page feels the same at 9am and at 4pm.

## 2. New hero: the "Day Dial" (about 40% of the screen)

A compact panel on a pine-green background with a paper-stock texture. It changes with the phase:

- **Before:** a split-flap countdown (days, hours, minutes flip like a station board), a weather chip, and "Your pass P26-xxxx" as a small ticket stub tucked into the corner (tap to open Me).
- **Live:** a horizontal time ruler for today (08:00 to 20:00) with a moving "now" needle. Session blocks show as small ticks, and your own or starred sessions are dots. Below it is one line: "Next: Track 3 · L-Hall · in 12 min".
- **After:** a certificate seal stamp and "3 days, 42 sessions, you met 18 people".
- The top bar stays: "Pan-IIM WMC 2026" and the Updates button with an unread dot.
- The moving strip stays directly under the hero, unchanged.

## 3. Card order (priority, grouped)

```text
HERO (Day Dial)
STRIP (kept)
A  Act now      urgent notice -> My next ticket (presenting / starred)
B  Right now    live parallel rooms carousel (live phase) |
                travel + pass/slot readiness (before phase)
C  Meet         Network teaser: "5 people in your track", bookmarked
                authors presenting today
D  On campus    meal now/next + featured services (shown live phase,
                collapsed to one row before)
E  Deadlines    dated checklist (before phase, data from organizers)
F  Updates      latest 2 notices
```

- Remove "Quick help". The bottom tabs already cover it.
- Signed out: hero, strip, public live rooms, campus, and a sign-in prompt in place of A and C.
- The organizer phase preview switch stays.

## 4. Microinteractions

- Split-flap digit flips, and the now-needle moves smoothly every 30 seconds.
- Cards rise in one after another. The live rooms carousel snaps card by card, and a live session has a pulsing stamp.
- "My next" turns to the warning colour within 15 minutes of start, with a small shake once.
- Pull-to-refresh shows a little pine-cone spinner.
- Everything respects the phone's reduced-motion setting.

## 5. Network v1: "The Common Room"

Direction: an academic visiting-card catalogue, more like a library card index than LinkedIn. Cream index cards with a typeset name, institute, a track colour tab on top, and research keywords as stamped tags.

**Why use it on your own:** find the people working on your topic, bookmark papers and see when they're presented, and prepare before you meet someone.
**Why it gets better as more people join:** "Shared interests" shows how many people overlap with your keywords, "Presenting today" covers the authors you follow, and your circle grows from your QR or NFC taps.

Screens:

- **/network** has a search bar plus filter chips (Track, Institute, Role: Presenter / Chair / Keynote, Bookmarked, "Overlaps with me"). It has three shelves: Suggested for you (keyword overlap), Presenting today, and Everyone (A to Z index cards).
- **Person sheet (/network/$code)** shows the name, role ribbon, affiliation, keywords, short bio, and papers at this conference with their slot ("Open in agenda"). It also has LinkedIn and email, but only if the person agreed. Actions: Bookmark, Add to met, Save contact.
- **Papers tab** lists all papers by track, with bookmarking. Bookmarked papers get a star in Agenda.
- **My profile edit** (in Me): keywords (pick up to 8), a one-line bio, a LinkedIn link, and the "list me" setting. Until that's switched on, only your name shows.
- **Entry points:** a Home card (C), a Me card, and author names in Agenda that link to their person sheet. The bottom tabs stay at 5.
- Test (placeholder) people are marked "TEST".

## Decisions I've assumed (tell me if any are wrong)

- People are hidden from the directory by default and appear only after they switch on "list me". Track chairs and keynotes can be listed by organizers.
- Email is never shown unless the person consents. LinkedIn is the main way to connect.
- There's no in-app messaging in v1.

## Technical details

- Remove the `hero-campus.jpg` import and the file. New `src/components/home/DayDial.tsx`, `FlipDigits.tsx` and `LiveRooms.tsx`. Pure `src/lib/day-dial.ts` (needle position, tick layout, next item) with bun tests.
- Additive migration: `people.keywords text[]`, `people.bio text`, and `person_bookmarks(owner_person_id, target_person_id | submission_id)` with GRANTs and owner-only RLS. A security-definer `directory_people()` returns only consented fields, and `keyword_overlap` is computed in a pure tested helper `src/lib/network.ts`.
- Routes: `network.tsx` (layout with Outlet), `network.index.tsx`, `network.$code.tsx`, `network.papers.tsx`. Each gets its own head() metadata.
- Agenda: a star badge on sessions with bookmarked papers or authors.