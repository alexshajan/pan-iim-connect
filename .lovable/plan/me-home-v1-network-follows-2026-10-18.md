# Me + Home v1 (Network follows)

## Me (sign-in required)

1. **Digital pass**: a card that matches the physical NFC card. The front shows name, affiliation, a role ribbon (Presenter / Track Chair / Reviewer / Keynote / Delegate) and the delegate code. Tap to flip. The back shows a QR code that opens the public profile page `/id/$code`, the same link the NFC card will carry.
2. **My papers**: one card per submission with its ID, title and track. It also shows a time-and-room stamp (or "slot awaited") and buttons for "Open in agenda" and "Directions".
3. **People I've met**: Scan QR (camera, works on every phone) and Tap NFC (shown only on Android Chrome), plus adding someone by their code. Each person can get a note. You can select several people, save their contact cards, open their LinkedIn, or remove them.
4. **Logistics**: residence and room, food preference, help desk, and a switch for "List me in the directory" (on by default).
5. Signed-out visitors see a sign-in screen only.

## Home: three phases (switch on dates, Indian time)

- **Before 27 Nov**: countdown with Shillong weather, travel card (link to Guide Arrival), a pass/paper-slot reminder, organizer notices, and key deadlines.
- **27–29 Nov**: urgent notice, a "My next" ticket (your own presentation comes first if it's within 2 hours, then starred sessions), live-now sessions in parallel, the mess and campus shortcuts, and a "Scan someone" button.
- **After 29 Nov**: a certificate placeholder (coming soon), a summary of people met with export, and updates.
- Signed out: the public schedule and campus sections, plus a sign-in prompt. Organizers get a hidden preview switch to look at each phase.

## Public `/id/$code`

A consent-gated mini profile page. If the person hasn't opted in, it shows only their name. Signed-in guests get a "Save contact" button that adds them to "People I've met".

## Gaps covered

- A ribbon for people who hold several roles.
- Placeholder (test) people are labelled "TEST".
- Contact details are shared only with consent.
- NFC card procurement stays separate.

## Technical details

- Additive migration: `people.directory_opt_in` boolean default false, `people.linkedin_url`, and table `person_connections(owner_person_id, other_person_id, note, source qr|nfc|code, created_at)` with GRANTs and RLS that limit access to the owner. A security-definer `public_profile(code)` function returns only consented fields.
- QR codes use `qrcode`, scanning uses `jsQR` via `getUserMedia`, and NFC uses `NDEFReader` with feature detection.
- The phase logic is a pure helper `src/lib/phase.ts` with bun tests (date boundaries). The contact-card builder is also tested.
- Route files: `me.tsx` (rework), `index.tsx` (rework), and new `id.$code.tsx`.

## Next: Network

A directory at `/network`, built on the same opt-in data.