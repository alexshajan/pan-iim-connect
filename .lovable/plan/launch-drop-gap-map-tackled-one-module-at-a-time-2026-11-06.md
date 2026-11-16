# Launch-drop gap map, tackled one module at a time

Guests get: sign in, Home, Calendar with their slot, Papers, Stays, Me. Each piece below is one full pass on one journey (design, motion, empty/error/loading states, desktop, copy, checked in the browser) rather than many small fixes spread across the app. Order follows what a guest hits first from the email.

## Piece 1. First contact: email link to signed in

The journey a guest takes from today's email. Highest stakes.

- Sign-in page as a standalone landing: what the conference is, dates, venue, why sign in (your slot). Works on the institute domain with no other context.
- Code entry: auto-advance boxes, paste the whole code, resend timer, clear "check spam / use registered email" help, wrong-email recovery (alt email, contact the desk).
- Not-on-list path: visitor pass explained in one line, not a dead end.
- After sign-in: land exactly where the link pointed (slot view), with a short first-run welcome, not a blank Home.
- Desktop: two-panel layout (brand side + form side).
- Check: sign in end to end on phone and PC sizes, wrong code, expired code.

## Piece 2. Home as a launchpad

- Desktop top navigation in the logo bar; bottom dock phone-only.
- Signed-out, signed-in presenter, signed-in non-presenter, visitor: each gets a designed Home, no empty columns.
- "Get ready" cards carry real info (your slot time and room, papers count, stays count) instead of single words.
- Countdown + weather sticker reviewed on device; updates box and nudge cards consistent.
- One motion vocabulary: press, lift, arrow slide, staggered entry.

## Piece 3. Calendar and "my slot"

- Presenter finds their slot in one tap from anywhere (Home card, Calendar jump, email link).
- Parallel sessions: browsing siblings in the same time slot without losing place.
- Session drawer: paper list, room with campus pin, add to plan, add to phone calendar, share.
- Desktop: day stream with a side detail panel instead of a drawer.
- Empty states (no plan yet), offline (cached schedule, "last updated"), PDF export check.
- Online presenters: what they see (joining info placeholder, mode shown clearly).

## Piece 4. Papers browser

- Search by title, author, institution, track; results grouped and fast on 750 papers.
- Paper detail: authors, session, time, room, mode, star to plan.
- Desktop: list + detail side by side.
- Check nothing private shows (contact, payment).

## Piece 5. Stays

- Premium listing feel review: photos, distance to campus, call/WhatsApp/map/book actions.
- Filters (distance, price band if known), desktop grid.
- Missing photo and missing contact states.

## Piece 6. Me

- Pass, profile edit, consent switches, password, notifications, calendar sync, sign out in a clear order.
- Data correction: guest can flag wrong name/institution/paper detail to the desk.
- Desktop two-column.

## Piece 7. Reliability and verification readiness (runs alongside, finished before the institute review)

- Lock schedule and paper reads to signed-in guests at the data level, not only the screen.
- Error screens: friendly messages, no technical details leaked; offline shell.
- Content security policy and frame protection headers; rate limits on code requests.
- Demo organizer accounts kept hidden; confirm none can be found from public screens.
- Speed: first load size, route preloading, image sizes on Stays.
- Security scan run and findings cleared.

## Piece 8. Organizer side for launch week

- Console Overview / Data health / People on current data, visual.
- Bulk "your slot" email send with preview, test send and progress.
- Fix-the-data loop: guest flags from Piece 6 land in console.

## Blocked or waiting

- Background push when app is closed (needs a push sender).
- WhatsApp alerts (WhatsApp Business setup).
- 6-digit codes (backend setting).
- Paper 1547 placement, unpaid/unscheduled papers, Rukilesh email (your decision).
- Institute subdomain (IT DNS access).

## How each piece runs

1. Walk the journey in the browser at phone and PC sizes, list every rough edge.
2. Fix in one pass, including copy and motion.
3. Re-walk with screenshots, add tests for any rule changed.
4. Tick it off in the roadmap, then move to the next piece.

let's execute pieces 1,2,3.