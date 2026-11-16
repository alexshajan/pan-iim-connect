
## Other things that play into Phase 1

- **Consent fields now**: networking visibility, photo, WhatsApp, calls — stored per person, default off, editable by organizers until registration form adds them.
- **Roles beyond payer/presenter**: co-author, reviewer, track chair, keynote, volunteer, organizer — a person can hold several. Needed for certificates and console permissions.
- **Volunteer access**: volunteers see People read-only (no phone/address) and the Help queue; editors/admins edit.
- **Privacy**: phone and address readable only by organizers and the person themselves; never on public pages.
- **Exports**: People/Submissions to CSV for the secretariat.
- **Ask organizers**: whether submission IDs are unique across tracks; source for co-author lists; fuller export date.

## Technical details

- Staged additive migration (applies when the draft is accepted): `people`, `person_roles`, `registrations` (raw jsonb + batch id), `submissions`, `submission_people` (role: payer/presenter/author), `import_batches`, `review_items`, `audit_log`, `accommodations` (placeholder-capable); `is_placeholder` + `placeholder_batch` columns on people-linked tables; `people.user_id` set by a claim function on sign-in.
- Existing `participants` stays readable during transition; Me switches to `people`.
- RLS: organizer read/write via `is_organizer`; volunteer limited read via a column-safe view; person reads own row via `user_id`. Explicit GRANTs.
- Import parsing in a server function (XLSX via SheetJS), upsert keyed on normalised email / submission ID, idempotent; delegate codes from a non-ambiguous alphabet.
- Initial 584-row load and test cohort run as data steps after accept — I'll confirm before writing them.
- Tests for email normalisation, phone formatting, submission splitting and duplicate detection.
- Since tables only exist after accept, console screens are built now and verified end-to-end after accepting.