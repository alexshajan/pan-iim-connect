# Phase 2 — Apply the YCP design language

V0 works but reads like a generic web portal. This phase replaces the visual layer with a design system learned from ycp.iimranchi.ac.in, and upgrades the app shell so it feels like a designed event product rather than a data list.

## What the reference actually does

From the live page:

- **Deep forest green** as the single brand colour (logo, buttons, highlighted words), on near-white; near-black for headings. No second accent hue, no gradients.
- **Geometric grotesque type**, very tight tracking, heavy weights for headlines, generous size jumps between headline and body.
- **Floating rounded chrome**: the nav is a white pill card floating over a full-bleed photo, not a bar glued to the top.
- **Pill highlight**: a key word in the headline sits inside its own white rounded pill — the signature move.
- **Very large corner radii** (~24-32px) on cards and images, soft low-contrast shadows, no visible hairline borders everywhere.
- **Photography-led sections** with wide edge-to-edge imagery, plus a **scrolling text marquee** as a rhythm break.
- Small caps/eyebrow labels above section headings, lots of vertical breathing room.

## What changes in the app

**Tokens (src/styles.css)**
- Primary: forest green; surface: near-white; ink: near-black; one muted grey. Retire the indigo/sandstone/warm-paper palette; keep track colours but desaturate them to sit under the green.
- Radius scale up: cards 24px, pills full, images 20px.
- Shadow: single soft elevation token, no borders as the default card treatment.
- Fonts: Satoshi (display/headings) + General Sans (UI/body) loaded via `<link>` in `__root.tsx`. Tight tracking on display sizes.
- Dark mode retuned around the same green.

**Shell (AppShell.tsx)**
- Bottom tab bar becomes a floating rounded pill dock, not a full-width bar.
- Header becomes a compact floating card on scroll; page title uses the display face with the eyebrow label above it.

**Now page (index.tsx)**
- Real hero: full-bleed IIM Shillong / Meghalaya image, headline with the signature white pill around one word ("Pan-IIM at **Shillong**"), countdown and live-session card floating over it.
- Marquee ticker strip under the hero for track names / conference tagline.
- Live + next-up sessions in large rounded cards.

**Everything else**
- Session, map, guide, admin cards re-skinned to the new card treatment (soft shadow, big radius, green accent rail instead of coloured borders).
- Filter chips become solid green pills when active, plain light grey when not.
- Guide and Map pick up section imagery so they aren't pure text lists.

**Images**
- Generate 4 photographic assets: campus/hero, Meghalaya landscape (guide), campus dining/services, and a travel/road image. No stock-photo grid, no icon-only sections.

## Technical notes

- Purely presentational: tokens in `src/styles.css`, fonts via root `<link>`, components in `src/components/*` and route files. No schema, query, or auth changes.
- New shared primitives: `PillTag`, `Marquee`, `HeroCard` under `src/components/`.
- Keep all colour usage on semantic tokens; no hardcoded hex in components.

## Out of scope this phase

Networking/profiles, notifications delivery, offline PWA caching — unchanged from the approved roadmap.
