
## Design audit (done before delivery)

I'll render every page to an image and check it for:

- Text that clips or overlaps.
- Long names, e.g. "Prof. Venkataraghavan Subramaniam", which shrink to fit on up to 2 lines.
- Contrast that stays readable in print.
- QR size: at least 20 mm on the front and 40 mm on the back, with a scan test on every QR.
- A safe zone around the lanyard slot and the NFC chip area.
- Role ribbons that stay legible from 1–2 m.

You'll get a short list of what I found and what I fixed.

**Needed from you:** the official IIM Shillong logo file. There isn't one in the project, so the template uses a clearly marked logo placeholder until you send it --- [https://thumb.wikimedia.org/wikipedia/hi/thumb/7/7a/IIM_Shillong_Logo.svg/1920px-IIM_Shillong_Logo.svg.png](https://thumb.wikimedia.org/wikipedia/hi/thumb/7/7a/IIM_Shillong_Logo.svg/1920px-IIM_Shillong_Logo.svg.png) -- extract png from here, keep quality high,

## Technical details

- Migration: add `people.alt_email` (lowercased, nullable). Add a unique index across both emails, so one address can never sit on two profiles. Update the claim and visitor functions so they match on `email` OR `alt_email` (this stops the Visitor flow creating duplicates). Add an organizer-only security-definer `merge_people(keep, drop)` that moves handshakes, bookmarks, roles, check-ins and claims, then deletes the stray row, with an audit log entry. Add a `people_issues()` view/function for the issues panel. Code edits get a format check plus a uniqueness check.
- Console: `PersonEditor` gets email, alt email, phone and code fields, plus the code-change warning and merge action. The issues strip lives in `console.people.tsx`. Issue detection logic goes in pure, tested `src/lib/people-issues.ts`.
- Sample data: update the 4 card rows in this draft's sample data with the real emails. Accepting the draft does not change live data. A guarded one-time step after publish sets the emails live and merges Ashish's existing profile.
- Card files: reportlab PDF at true size with bleed, plus PNG renders. QR comes from the same artwork as `card-qr.ts`. Delivered to Files as `id-card-template.pdf` and `id-card-samples.png`.