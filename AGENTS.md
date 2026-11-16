<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project rules
- People registry (people, submissions, registrations, imports) is the identity spine; `participants` is legacy and read only as fallback. Why: one record per email with a delegate code keys badges, WhatsApp and certificates.
- Test data lives in the same tables flagged `is_placeholder` + `placeholder_batch`, created/removed only via DB functions. Why: lets real data replace it with a one-click cleanup.
- Registration sheets are parsed in the browser (`src/lib/registry.ts`, pure + tested) and written under organizer RLS. Why: no privileged server path needed for imports.
- Organizer registry lives at `/console/*`; older tools stay at `/admin` until folded in.
- Campus map draws real OpenStreetMap roads from `src/lib/campus-geo.ts` (generated, do not hand-edit) and routes walks over them in `src/lib/campus-route.ts` (pure, tested). Why: accurate paths with no map API key, works offline.
- Guide planners (`src/lib/guide.ts`, pure + tested) compute every route, fare, itinerary and cost; the AI assistant (`/api/guide-chat`) only calls them as tools over organizer data. Why: no invented prices or places.
- Guide chats are per-user threads in the database at `/guide/chat/$threadId`; content (legs, places, cabs, prompts) is public-read, organizer-write and edited at `/console/guide`.
- The `entities` alias in `vite.config.ts` must stay exact-match regexes; a prefix alias breaks parse5 (`entities/decode`) and stalls the dev dependency optimizer.
- Network directory reads only through security-definer `directory_people()` (signed-in, opted-in, consented email); matching logic is pure in `src/lib/network.ts`. Why: no client path to non-consenting people.
- Unlisted sign-ups get a `people` row with role `visitor` via `start_visitor_pass()`; upgrades go through `role_claims` + organizer-only `resolve_role_claim()`. Why: one identity spine, no self-granted roles.
- Console screens per role are defined only in `src/lib/console-access.ts` (pure, tested); role changes, check-ins and deck listing go through security-definer DB functions. Why: one place to add roles, no self-granted access.
- `/id/:code` is the view-only profile link; `/c/:code` is the handshake link on NFC cards and pass QRs, and only `record_handshake()` (security-definer, needs the other card checked in) writes the two-way connection. Why: sharing a profile must never create a "met" entry.
- Alert visibility (active window, withdrawn, audience) is decided only in `src/lib/alerts.ts` (pure, tested). Why: Home, Agenda and Updates must agree on who sees what.
- Console role context lives in `src/components/console/access.ts`, not the route file. Why: split route chunks otherwise get separate context copies and lose edit rights.
- Schedule clash detection and timetable-import matching are pure in `src/lib/schedule-clash.ts` and `src/lib/schedule-import.ts`; the AI only extracts rows and organizers apply them under RLS. Why: no AI-written schedule changes without review.
- Card QR artwork and NFC/QR links are built only in `src/lib/card-qr.ts` (pure, tested; dots stay rounded squares because round dots failed scan tests). Team roles (volunteer/organizer/committee) skip the check-in gate via `card_is_team()`. Why: vendor files and the app must match exactly.
- A person may have one `alt_email`; a DB trigger keeps every main/second email unique across profiles, and duplicates are merged only via organizer-only `merge_people()`. Issue detection is pure in `src/lib/people-issues.ts` (tested). Why: the desk can fix wrong-email sign-ins without making guests sign out.
- ID card PDFs and vendor sheets are built in the browser at `/console/cards` from pure helpers in `src/lib/id-cards.ts` (tested); template + field layout stay on the organizer device. Why: no file storage or server path needed for print runs.
- Delegate codes are normalized by `normalizeCode()` in `src/lib/phase.ts` (short "VAL1" → "WMC-VAL1") before any lookup; scans try the two-way handshake first and fall back to a one-way save. Why: taps must never fail on code format.
- Paper presentation mode lives on `submissions` (`presentation_mode` + `mode_status`); change it only via `set_presentation_mode()` so authors' `attendance_mode` stays derived (on campus if any linked paper is offline). Programme days/slots/rooms are scaffold tables, wired to submissions via `slot_id`/`room_id`. Why: one source for who is physically present.
- Console completeness numbers come from organizer-only `data_completeness()`. Why: counts over 1,400+ people exceed client row limits.
- Network social signals (waves, matches, "For you" reasons, icebreakers) are pure in `src/lib/network-social.ts` (tested); waves are written only via security-definer `send_wave()` (directory-listed targets only) and read via `my_waves()`. Stamps are computed in `src/lib/stamps.ts` from existing data plus device flags, with no table. Why: playful layer with no new path to non-consenting people.
- Guest-visible sections are switched only through `src/lib/modules.ts` flags (stored in `console_settings` key `modules`, public-read) and checked in `AppShell`; pages hide links to off sections with `useModules()`. Why: phased launch without deleting code.
- The Calendar is one day stream built by pure `src/lib/calendar.ts` (tested): common sessions inline, parallel rooms collapsed with the guest's pick up front. Why: one view for phones instead of separate My/Full/grid views.
- Guests read papers only through the `public_papers` view (titles, author names, standard institutions); `submissions` stays organizer/own-only. Why: it holds contact, payment and meeting details.
- `GuestDock` + Updates sheet mount once in `__root.tsx` (stay up during loads).
- Paper placement lives in `submissions.session_id/session_order`; venue-less sessions use `sessions.room`. Why: legacy `papers` unused.
- Volunteer alerts go to `alert_requests`, published only via organizer-only `decide_alert_request()`. Why: `announcements` is public-read.
- My Plan = own slots + `sessions.in_everyone_plan` + stars; `moved_at` set by DB trigger. Why: organizer-controlled shared items.
- Profile links live in `people.profile_links`, written only via `set_my_profile_links()`; platform/URL logic is pure in `src/lib/profile-links.ts` and "find my profile" search runs server-side in `src/lib/profile-search.functions.ts` (web search + AI ranking, user must confirm). Why: nothing attaches to a profile without the person choosing it.
- Guest corrections to card name, presenting author or second email go through `request_detail_change()` and are applied only by organizer-only `decide_detail_change()`; display rules are pure in `src/lib/detail-requests.ts` (tested). Why: nothing on a card changes without organizer review.

- Paper bylines, citations and author profile links go through `src/lib/apa7.ts` (pure, tested) and `AuthorLine`; codes come from signed-in-only `paper_author_links()`. Why: one APA 7 format everywhere, no public name-to-code map.
- Card design per person = `personPreset()` in `src/lib/id-cards.ts`: printed title picks the template, except category "PURVA Guest" forces the PURVA card. Logo/art layers come from generated `src/lib/card-layers.ts`; saved studio versions stay on the organizer device. Why: a title and its branding can differ (PURVA keynote).
- Smart Slotter (`src/lib/slotter.ts`, pure + tested) keeps paper moves as a device-local draft; only organizer-only `apply_slotter_moves()` publishes them and it refuses locked sessions. Why: organizers can experiment without guests seeing half-done changes.
- WhatsApp: all Meta calls go through the connector gateway in `src/lib/whatsapp.server.ts` (server-only); the signed receiver `/api/public/whatsapp/webhook` stores every delivery in `whatsapp_webhook_events` before processing, and delivery-state/number/window rules are pure in `src/lib/whatsapp.ts` (tested). Broadcasts re-check `consent_whatsapp` on the server. Why: receipts are never lost and no one is messaged without opting in.
