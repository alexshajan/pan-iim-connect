## What fills "My Agenda" (by role)
- **Presenter / team presenter**: their paper slots, plus sessions where co-authors present.
- **Track chair**: sessions they chair, and their whole track as a group.
- **Keynote / guest speaker**: their talk, green-room time and plenaries.
- **In-house / guest prof, reviewer**: sessions they chair or review, plus starred sessions.
- **Volunteer**: shifts and posts (placeholder until organizers share a roster).
- **Attendee only**: starred sessions plus common items. If nothing is starred, they get a prompt that opens the Programme.

Common items (opening, keynotes, meals, closing) show for everyone.

## Modules affected
| Part | Change |
|---|---|
| Agenda page | New top switch; the current view picker moves under Programme; the old "mine only" filter is removed |
| My Agenda view (new) | Role-aware list of the day: "next up" ticket, walking gaps, clashes |
| Programme view | Reuses today's timeline, room grid and list, adds a Search sub-tab |
| Session pop-up | Upgrades the existing slot sheet: abstract, people links, your role, actions, deep link |
| Session detail page | Kept for sharing; opens the same content |
| Clash banner | Moves into My Agenda → Clashes |
| Bookmarks | Unchanged; also feed My Agenda |
| Home "next session" | Reads the same My Agenda list so both stay in sync |

## Beyond buttons: layout and feel
- **Sticky top bar:** the switch, dates and filters stay pinned while you scroll. Filters fold into a single "Filters (2)" pill to save space on small phones.
- **Search:** one search box covering both sides. It searches by keyword, author, institute, room or track, with recent searches and suggestions like "Track 3 today". Results are grouped into Sessions, Papers and People.
- **Live cues:** a "Now" line on the timeline, a pulsing Live stamp, and badges for "starts in 10 min", "room changed" or "cancelled" on cards.
- **Swipe gestures:** swipe left or right to change day, swipe a card to star it, and pull down to refresh.
- **Clash help:** when two starred items overlap, both cards get a marker, and "Pick one" opens them side by side.
- **Walking gaps:** "4 min walk" appears between My Agenda cards and turns amber when the gap is too short.
- **Smart empty states:** "Nothing starred yet. See today's keynotes" or "No sessions match. Clear filters".
- **Remembered state:** the last side, day and filters are kept, and the address can be shared ("open Track 3 on 28 Nov").
- **Offline:** the last loaded programme stays readable, with an "Updated 5 min ago" stamp.
- **Accessibility:** large tap targets, track colour always paired with a text label, and reduced-motion support.
- **Later (experiential):** a "My day" share card, a session check-in tap, and a quick rating after a session.

## Data needed
- **Now (exists):** sessions, rooms, tracks, papers, stars, people and their roles, links from papers to presenters.
- **Placeholders until organizers send them:** session chairs as linked people (today it's only text), volunteer shifts, green-room times, per-paper speaking times.

## Build order
1. Shared logic that builds "my items" and free slots from roles, papers and stars (tested).
2. The switch and sub-tabs on the Agenda page.
3. My Agenda: 3-day Overview first, then Day view with swipe and date pills.
4. Upgraded session pop-up.
5. Programme Search sub-tab, then Home linkage.

## Technical details
- Pure `src/lib/my-agenda.ts` (`myAgendaItems(...)`, `freeSlots(items, dayBounds)`) with bun tests per role rule and free-slot rule.
- Tab state in URL search params (`?side=mine&view=overview&day=2026-11-28`) via route `validateSearch`, so links open a specific side, view and day.
- New `MyAgendaOverview.tsx`, `MyAgendaDay.tsx` and `ProgrammeView.tsx` in `src/components/schedule/`; `SlotSheet.tsx` is extended rather than replaced.
- Swipe via pointer events with a threshold, ignored inside horizontally scrolling room rows; reduced motion disables the slide animation.
- Reads go through the existing people/submissions registry (no new tables in this step). Chair linking and shifts would come later as a small additive change.
