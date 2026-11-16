# Phase 1 — Core data layer + organizer console

Build everything the registration sheet supports today, plus clearly-labelled test placeholders for the gaps (paper titles, accommodation, sessions), so the rest of the app has real shapes to build on. Placeholders are removable in one click later.

## What gets built

**1. People and registrations (real data, 584 rows)**

- One person record per unique email (case/space-normalised), with name, phone (+91 added where missing), organisation, address, category (Academics & Faculty, Research Scholars, etc.).
- A short, unguessable delegate code per person (e.g. `WMC-7K2Q`) — the future key for QR badge, NFC card, WhatsApp handshake and certificates.
- Registration/payment rows kept as-is (raw sheet row preserved) and linked to the person.
- Submissions created from `Submission ID` and `Submission ID 2`; each linked to the payer, and to the presenting author when the sheet names someone different. A person can hold many submissions; a submission can list many people.
- Possible duplicates (same name + organisation, different email; or same phone) flagged for review, never auto-merged.

**2. Placeholders for a test group (clearly marked)**

- A "Test cohort" of ~15 people picked from the sheet (or added test accounts, including you). -- let's do dummy accounts, placeholder name/data
- For them only: invented paper titles/abstracts/tracks, a room assignment, and links to existing demo sessions.
- Every placeholder row carries a `placeholder` flag and a batch tag. Console banner shows them; one "Remove all placeholders" action deletes them without touching real data.

**3. Import pipeline (reusable)**

- Upload XLSX/CSV in the console → column mapping → preview with issues (missing email, bad phone, duplicate submission, unknown category) → commit.
- Re-uploading the fuller dataset later updates existing people by email and submissions by ID instead of creating copies. Each import is logged so it can be reviewed or rolled back.

**4. Sign-in claim**

- When a registrant signs in, their account is attached to their person record by email; Me shows their delegate code, submissions and (for test cohort) room and slot.

**5. Organizer console, modular**

- Shell with a left rail: Overview · People · Submissions · Imports · Review queue · Placeholders · (existing) Schedule, Dining, Announcements, Help.
- People: searchable table, filters by category/payment/claimed, side sheet to edit details, roles, consent flags, notes.
- Submissions: ID, linked authors, presenter, payment status; add/remove author links.
- Review queue: duplicate suspects and data problems, with merge/ignore.
- Overview: counts (registrants, submissions, claimed accounts, issues).
- Every edit is recorded with who/when.
