# Bring the live app up to date with the latest draft's data

## What's missing live (checked today)

| Area | Draft has | Live has |
|---|---|---|
| Final registered presenters (from PAN-IIM_APP.xlsx) | 692 papers with mode, contact name/email | 501 older submissions, none with contact details |
| Authors linked to papers (order, presenter flag, affiliation) | ~1,500 links | 0 |
| Authors as people (incl. "email missing" flag, on-campus/online) | ~1,440 people | 594 (older registration import) |
| Presenter / author roles | derived from links | none |
| Tracks | 10 official tracks | 5 demo tracks |
| Programme scaffold (3 days, 2x3 slots, 22 rooms) | yes | empty |
| Sample check-ins, help requests, alerts, sessions | yes | partial (3 alerts, 0 check-ins) |

Already live and not touched: demo accounts, team cards (VAL1/VIN1/BAS1), guide content, existing connections.

## Steps

1. Load the draft's sample file section by section into the live database, skipping anything already present (matched by email, submission ID, track name, delegate code). Nothing existing is deleted or overwritten.
2. Merge rather than duplicate: older live submissions with the same submission ID get the new title/mode/contact; people with the same email keep their delegate code and sign-in link.
3. Rebuild presenter/author roles and refresh each person's on-campus/online status.
4. Re-check counts against the draft and spot-check in the published app: Network papers, Console > Submissions, Console > People completeness, Agenda.
5. Report anything that couldn't load (e.g. conflicting emails) as a short list.

## Notes
- Sample check-ins/help requests/alerts are test data; they'll be flagged as placeholders so "Remove all placeholders" clears them.
- Programme times remain "to be confirmed" until you send the final grid.

## Technical details
- Source: `db/seed.sql` (lines 22–89 demo section, 90–3774 final presenters, 3775–3778 scaffold). Run via data-insert tool in chunks; `ON CONFLICT` guards; submissions upserted by `submission_code`, people by lower(email); submission_people resolved by code/email joins.
- After load: `refresh_attendance_modes()`, verify with `data_completeness()`.
- Unique indexes required for `ON CONFLICT (name)/(day)/(room_no)` are verified first; add via migration if absent.
