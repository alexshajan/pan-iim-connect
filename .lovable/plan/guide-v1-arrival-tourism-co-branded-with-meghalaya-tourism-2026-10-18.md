# Guide v1 — Arrival + Tourism, co-branded with Meghalaya Tourism

Conference: 27–29 November 2026. Until 26 Nov, Arrival leads; from 27 Nov, Tourism leads and Arrival moves to an "Archive" link (still reachable for return-trip help).

## How guests experience it

```text
 Guide
 ┌──────────────────────────────────────┐
 │ [IIM Shillong]  x  [Meghalaya Tourism]│
 │ Ask anything about getting here or    │
 │ exploring Meghalaya                    │
 │ ┌──────────────────────────────────┐  │
 │ │ "Cheapest way from Delhi on 26th…"│  │  <- suggestions type themselves
 │ └──────────────────────────────────┘  │     in and rotate (Lovable-style)
 │  [Plan my arrival]  [Plan a day trip] │  <- two tool entry cards
 │  [Cab contacts]     [Weather & pack]  │
 └──────────────────────────────────────┘
```

**Assistant (chat-first)** — one assistant that can use Arrival and Tourism tools. Answers show as cards inside the chat (route plan, cost breakdown, itinerary timeline, cab contacts, map pin), not walls of text. Chats saved to the guest's account, with a list of past chats (e.g. "Arrival from Pune", "Sunday Cherrapunjee"). Signed-out guests can browse tools but sign in to chat.

**A. Arrival (form route)** — 3 short steps: arriving from (city), date and preferred modes (air / train / road), optional budget. Result: 2–3 ranked plans, each a leg-by-leg strip:

- Main leg (flight/train to Guwahati or Shillong/Umroi): typical fare range + duration from our data, with one-tap prefilled search on MakeMyTrip / IRCTC / Google Flights.
- Last mile (Guwahati → Shillong, Police Bazar → campus, airport → campus): our curated fares — cab, shared taxi, bus, helicopter where relevant.
- Total estimated range, travel time, "last safe departure" warning (hill road after dark), checklist (ID, cash, offline map).

**B. Tourism (form route)** — date(s) and time window, group size, activity type (nature, culture, food, shopping, adventure), physical effort (easy/moderate/hard), within Shillong or beyond, budget. Result: 1–3 feasible itineraries as a timeline with stops, drive times, entry fees, food stops, estimated cost per person, and "return by" time. Only uses places from our vetted catalogue — the AI arranges and explains, never invents places or prices.

**Cab contacts (both)** — directory of drivers with route, fare ask, vehicle, languages, tap-to-call / WhatsApp. Clear note: listed as a resource, not endorsed by the institute. "Report a problem" per driver.

## Gaps found and how v1 closes them

1. Data freshness: every fare/place carries a "last verified" date; stale items flagged.
2. Daylight and roads: Meghalaya dark by ~5 pm in November; itineraries enforce return-by times and warn on monsoon-damaged/closed routes (organizer toggle).
3. Permits/fees: Dawki boating, Mawlynnong entry, parking fees included in costs.
4. Cash/network: flags places with no ATM or no signal.
5. Accessibility: effort level and step-free notes on places.
6. Safety: tourist helpline, police, hospital always in Tourism.
7. Group splitting: cost per person and number of cabs for group size.
8. Return trip: Arrival archive still offers "Plan my departure" after the 29th.
9. Hallucination risk: assistant tools return only database rows; if no data, it says so and points to the help desk.
10. Data collection: organizers need an easy way to enter fares, places and drivers — included below.
11. Cab pooling: placeholder card "Coming soon" only (later phase, as you said).

## Organizer console additions (`/console/guide`)

- Routes & fares: legs, modes, fare range, duration, notes, last verified.
- Places catalogue: Meghalaya spots with area, activity tags, effort, hours, fees, drive time from Shillong, photos, closures.
- Cab drivers: contact, routes, fare asks, active/hidden.
- Suggested prompts: edit the rotating suggestions.
- Bulk import from spreadsheet for all three, matching how registration imports already work.
- Seeded with clearly-marked sample data until your local-guide data arrives.

## Co-branding

Header lockup with uploaded Meghalaya Tourism logo, a short "In partnership with" line, and a warm accent pulled from their brand used only within Guide. Waiting on your logo files. 

## Build order

1. Database tables + sample data (flagged as placeholder) + console editors and import.
2. Arrival form and plan builder (pure, tested logic for ranking and cost totals).
3. Tourism form and itinerary builder (AI arranges from vetted places; time/daylight checks in code).
4. Assistant chat with tools, saved chats, rotating suggestions, result cards.
5. Cab directory, date-based switch (Arrival → archive on 27 Nov), co-brand header.
6. Phone-sized check end to end.

## Technical details

- Tables: `travel_legs`, `tourism_places`, `cab_drivers`, `guide_prompts`, `guide_threads`, `guide_messages` (user-scoped RLS for chats; public read + organizer write for content; `is_placeholder` flags per project rule).
- Arrival ranking and Tourism feasibility (opening hours, drive times, daylight cutoff, budget) are pure functions in `src/lib/` with vitest tests; the AI only selects/orders and writes prose.
- Assistant: AI SDK streaming via a TanStack server route, default gateway model, tools `planArrival`, `planItinerary`, `searchPlaces`, `listCabs`, `getVenueLocation`, `getWeather`; threaded routes `/guide/chat/$threadId`.
- Deep links built from origin/destination/date (no paid fare API).
- Weather from a free forecast feed (Open-Meteo, no key).
- Phase-switch based on India-time date helper already in the app.