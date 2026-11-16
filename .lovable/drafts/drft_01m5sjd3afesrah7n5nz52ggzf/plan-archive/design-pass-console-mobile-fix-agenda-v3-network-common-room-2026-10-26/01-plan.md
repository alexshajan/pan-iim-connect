# Design pass: Console mobile fix, Agenda v3, Network "Common Room" social

Paused (not touched): online presenter flow, schedule allocation, data finalization.

## 1. Data Health on phones (first, small)

- Stat tiles become a 2-column grid at 360px; tables become stacked cards with the key number large.
- Quick Offline/Online fix buttons become full-width 44px taps.
- Audited at 360, 390 and desktop with screenshots.

## 2. Agenda v3: compact, one-thumb navigation

Keep: My Agenda / Conference Programme switch, overview, day view, clashes, free slots, stars.

- **One header, not three rows.** A single sticky bar: the My/Programme switch, and under it one date strip (27 / 28 / 29, "Today" marked). The Overview/Day/Clashes tabs fold into this: tapping the date strip = day view, a small "3 days" chip = overview, clashes show as a red count badge on the switch.
- **Phones open on Day view for today** (overview one tap away); desktop keeps the 3-day calendar.
- **"Now" line and "Jump to now" button** that floats in when the live session scrolls out of view.
- **Compact session rows**: time on the left rail, title, room and a star; tap opens the existing sheet. Fewer words, larger tap targets.
- **Free slots read as actions**: "Free 11:00 to 12:30 · 6 sessions running" opens the Programme filtered to that time.
- **Plain-language helpers** for low digital comfort: a one-time 3-step coach mark, labelled icons (never icon-only), a "Where is this?" button on every session that opens the campus map.
- **Add to calendar** (.ics) for My Agenda.
- Swipe between days stays, with a visible day slide animation.
