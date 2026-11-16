# Physical, polished Home and computer layout

## 1. Cards lose subtext
"Get ready" cards show the title only. No icon chips either (they read as template UI).

## 2. Computer navigation in our phone language
Instead of plain text links, carry the skeuomorphic dock up to the top bar on computers:
- The same pressed-key tray from the phone dock, sitting in the centre of the logo bar (logo left, bell + pass chip right).
- The green "key" slides between tabs, like on the phone; tabs show the custom house/calendar/person glyphs plus the label.
- The tray shrinks with the bar on scroll, the same way the logo does.
- Phone keeps the bottom dock unchanged.

## 3. Whitespace on computers
Content is capped at a phone-width column inside a wide screen. Fix by layout, not by stretching:
- Home becomes a two-column board on computers: left column (countdown, your slot / claim pass, updates, nudges), right column (Get ready tiles stacked as a 2x2, weather, pass when signed in). Max width around 1100px, so nothing floats in the middle of a void.
- Calendar: day stream on the left, the session detail stays open in a side panel instead of a pop-up drawer.
- Sign-in already two-panel; tighten the vertical gap above it.
- Phone spacing: reduce section gaps (mt-9 headings to about mt-6) and card padding slightly so screens feel full, not sparse.

## 4. Home cards that feel alive and physical
Replace icon + text tiles with object-like cards, each with its own small illustrated moment made from our brand pieces (loom motif, 8 state lozenges), not stock icons:
- Schedule: a mini tear-off calendar block showing "27" with two pages fanned behind; pages lift on hover/press.
- Your profile: a tilted lanyard pass corner peeking from the card edge; straightens on hover.
- Browse papers: a short stack of paper sheets with a folded corner; top sheet slides on hover.
- Book a hotel: a room key tag on a ring that swings gently on hover.
Shared physical rules for every card across modules:
- Paper surface: warm off-white, hairline edge, soft two-layer shadow (contact + ambient), faint grain.
- Press: sinks 1-2px and shadow tightens (spring, 120-180ms); hover lifts 2px only on devices that hover.
- Staggered rise on first load, nothing animates again on revisit.
- Respect reduced motion.

## 5. Same treatment across modules (tackled after Home, one at a time)
- Calendar session rows: paper-strip cards with a coloured track seam on the left edge instead of pills.
- Papers: index-card style rows.
- Stays: photo cards with a ticket-stub price/contact footer.
- Me: pass as the physical object at the top, settings as a grouped paper sheet.
- Buttons: one primary (green, pressed-key depth), one secondary (paper with edge), one quiet text link. No pastel pills anywhere.

## Order of work
1. Subtext removal + card physics rules (shared styles).
2. Computer top tray.
3. Home two-column board + spacing tightening.
4. Four illustrated Home cards.
5. Screenshots at phone and computer widths, signed out and signed in.
Then Calendar side panel and the other modules in later passes.

## Technical notes
- Card objects built as small inline SVG/CSS pieces in a `HomeTiles` component using loom palette tokens; no image files.
- Tray reuses `TabDock` measuring logic in a horizontal top variant, `md:` only.
- Home board uses CSS grid at `lg:`; AppShell main gets a `wide` layout for Home.
- Guided by the saved impeccable, taste and ui-ux-pro-max skills (restraint, one motion vocabulary, no icon-chip tiles).
