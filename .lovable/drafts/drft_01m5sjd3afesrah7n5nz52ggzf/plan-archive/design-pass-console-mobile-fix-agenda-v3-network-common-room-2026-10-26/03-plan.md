
## 3. Network v2: a mini social space for the conference

References: Bumble Bizz / Lunchclub (intent matching), Poparazzi and BeReal (playful presence), Swarm check-ins and badges, Linear/Vercel microinteraction craft, Emil Kowalski motion rules.

Tabs inside Network: **For you · People · Papers · Met**

- **For you feed** (default): swipeable stack of suggested people with a reason line ("shared: ESG, fintech"), "Presenting in 40 min, NAB 2", "Same institute". Actions: Wave, Bookmark, Skip. Pull-to-refresh with a pine-cone spinner.
- **Wave**: a light "I'd like to meet" signal. Both waving = "It's a match, say hi at the tea break" card with confetti of tiny paper stubs. No messaging yet (kept for later).
- **Handshake moment**: after a tap/scan, a full-screen card-flip showing both visiting cards snapping together, a haptic pulse and a sound-free "click". Counter climbs on your pass.
- **Met wall**: a corkboard of collected cards, grouped by day; tap to see where you met and shared topics. Export as contacts stays.
- **Presence chips**: "At the Auditorium now" only for people who opted in (off by default).
- **Collectible stamps** (easter-egg layer): first handshake, 10 handshakes, met someone from every IIM, met a keynote, visited the Campus Lake pin, night owl (opened after 11pm). Shown on Me pass; a hidden stamp for shaking your phone on the Met wall.
- **Icebreaker prompt** on each profile drawn from shared keywords ("Ask about their paper on...").
- Motion: transform/opacity only, spring presses, shared-element card to profile, respects reduced motion; custom line icons for wave, handshake and stamps.

Privacy stays as is: only opted-in people appear; "met" only through the handshake; waves visible only to the receiver; presence is opt-in.

## Technical details

- Agenda: refactor `agenda.tsx` + `MyAgenda.tsx` into a sticky `AgendaHeader`, reuse free-slot logic in `my-agenda.ts`; add `.ics` builder (pure, tested); coach mark state in localStorage.
- Network: new tables `network_waves` (from, to, created_at; RLS sender insert, receiver/sender read) and `user_stamps` (awarded via security-definer function on handshake/visit triggers); `presence_optin` on profiles. Matching for "For you" extends pure `network.ts` (tested: reasons, match detection).
- Stamps rules pure in `src/lib/stamps.ts` with tests.
- Every new screen checked by screenshot at 360/390px; record decisions in AGENTS.md.