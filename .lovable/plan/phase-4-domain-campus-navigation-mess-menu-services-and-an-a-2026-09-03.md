# Phase 4 — Domain, campus navigation, mess menu, services, and an app-feel audit

## 1. Connect paniim.planos.in

planos.in is registered outside Lovable, so this is a "bring your own DNS" connect. Once you approve, I'll open the domain connect card in chat: it shows the exact DNS records (host/name, type, value) to paste into GoDaddy's DNS manager for the `paniim` host. I won't hand-write record values here — the card is the only authoritative source, and it also verifies propagation for you.

GoDaddy notes: add the record under planos.in → DNS → Records, with Name = `paniim` (not the full domain). Leave TTL default. The project must be published for the domain to serve traffic.

## 2. Campus map and navigation — recommendation

Google My Maps works, but as a *data source it isn't reliable* and as an *embed it degrades on iOS*:

- My Maps embeds are iframes; on iOS Safari they load slower, ignore the app's dark/light styling, and "Directions" inside the iframe often bounces the user into a browser tab rather than the Google Maps or Apple Maps app.
- Pins in My Maps aren't queryable from the app. You can't filter by category, show walk-times, or search them in-app.
- A shared My Maps layer can silently break if the map's sharing setting changes or the owner's account changes.

Recommended approach (small change from today's design, which already has a `map_pins` table):

1. Keep the pin data in the app database. You can build the pins visually in Google My Maps as an authoring tool, export KML/CSV, and import it in the admin console — best of both worlds.
2. Every pin gets a lat/lng plus category (venue, mess, eatery, gym, medical, hostel, gate, parking, shuttle).
3. Navigation buttons use a universal deep link: on iOS open Apple Maps, on Android/desktop open Google Maps, both with the pin's coordinates. This launches the native app with turn-by-turn — no iframe, no account needed, works offline-ish.
4. Keep a lightweight static campus map image with our own tappable pin overlay for the in-app "where am I" view, instead of the current OpenStreetMap iframe. It renders instantly and matches the design system.
5. Optional "Take me there" from any session card, mess card, or service card — one tap from the thing you're looking at to walking directions. -- 

Alternatives considered: Mapbox/MapLibre (prettiest, needs a key and adds weight), raw Google Maps embed (same iframe issues), plain static image only (no directions). The deep-link + own-data approach is the most robust and the most native-feeling.

## 3. Mess menu module

- New `mess_menus` data: day, meal (breakfast / lunch / snacks / dinner), serving window, venue, highlight item, full item list, veg/non-veg/jain tags.
- Home page gets a "Now serving / Up next" card: shows the current meal's highlight item, the serving window with a countdown ("Dinner 7:30–9:30, ends in 40m"), and a directions button to the mess.
- A full menu page: three-day tabs, meal-by-meal cards, dietary tags, and a note field for special meals (gala dinner, cultural night).
- Admin: edit menus per day/meal, mark a meal cancelled or moved.

## 4. Campus services cards

- New `services` data: name, description, category, icon, action label, action URL or phone, hours, optional venue pin.
- Renders as a compact card grid on the Guide's "On campus" tab plus a short row of the top three on the home page.
- First entries: Munchies (munchies.planos.in → "Order food"), laundry, gym, medical room, ATM/bank, printing/stationery, shuttle desk, help desk.
- External links open in a new tab; phone actions dial; venue-linked services show a directions button.

## 5. Audit — making it feel like an app, not a web portal

Structural

- Bottom dock currently shows five tabs; the Guide is becoming a hub. Regroup as Now / Agenda / Campus / Guide / Me, with Campus holding map, mess, services.
- Add a persistent header search that spans sessions, papers, people, places, and menu items.

Feel

- Page transitions: slide/fade between tabs, and native-style bottom sheets instead of full page loads for session and pin details.
- Skeleton loaders instead of "Loading…" text everywhere.
- Pull-to-refresh on Now and Agenda.
- Haptic-style press feedback (scale on tap) already exists on some elements — apply consistently.
- Safe-area padding for iPhone home indicator and notch.
- Sticky day/filter bar that condenses on scroll.

Reliability

- Install as PWA: manifest, icons, offline shell, cached schedule and map pins so the app works in patchy campus network.
- Empty and error states with a retry action rather than a bare sentence.

Small wins

- Time-aware home page ordering (pre-conference countdown → live now → next up → tonight's dinner).
- "Add to calendar" on session detail.
- Share sheet for sessions and pins.
- Larger tap targets and consistent 44px minimum on all icon buttons.

## Technical notes

- New tables `mess_menus` and `campus_services` with public read policies, organizer write policies, and explicit GRANTs; admin CRUD screens added to `/admin`.
- `map_pins` gains `category` refinements and an admin CSV/KML import; `src/lib/maps.ts` adds a platform-aware `directionsUrl(lat, lng, label)` helper used by sessions, mess, services, and pins.
- New route `campus.tsx` (map + mess + services) with `mess.tsx` detail; `map.tsx` folds into it with a redirect kept for the old path.
- Home page adds a `NextMealCard` and `ServicesStrip`.
- PWA via manifest + service worker with a stale-while-revalidate cache for schedule, pins, menus.
- Head metadata added/updated on every new route.

## Build order

1. Domain connect card.
2. Mess menu + services data, admin editing, home cards.
3. Campus tab: static map with own pin overlay, deep-link directions everywhere.
4. App-feel pass: sheets, skeletons, transitions, safe areas, search.
5. PWA/offline.