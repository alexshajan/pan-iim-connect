## Not in this pass

- Mutual NFC tap handshake and card activation (next pass; check-in records it will rely on are built now).
- Presenter self-upload of slides from Me (organizer upload first).
- Old `/admin` stays reachable until its pages are fully folded in.

## Sample data

Add sample check-ins, a few volunteer accounts and placeholder slide files to this draft so every screen can be tried.

## Technical details

- New roles in the role enum: `desk_volunteer`, `room_volunteer`, `help_volunteer` (keep `volunteer` as legacy = help). A single `src/lib/console-access.ts` maps role to allowed screens; sidebar and each route read it. Pure and unit-tested.
- New `check_ins` table (person_id unique per event day, checked_in_at, by_user, method qr/manual, voided_at). Insert only through a security-definer `check_in_person(code)` that verifies a desk/organizer role and is idempotent; organizer-only `void_check_in`.
- New `submission_decks` table (submission_id, file path, version, uploaded_by) plus a private storage bucket; read allowed to organizers and room volunteers via signed URLs; write organizer-only.
- `deck_grouping` setting row (room | track | day).
- Team page writes `user_roles` through an admin-only `set_user_roles()` function; audit logged.
- QR scanning in the browser with a lightweight camera library, manual code entry fallback.
- Console restyled to a neutral ERP shell reusing existing tokens; routes stay under `/console/*`.
