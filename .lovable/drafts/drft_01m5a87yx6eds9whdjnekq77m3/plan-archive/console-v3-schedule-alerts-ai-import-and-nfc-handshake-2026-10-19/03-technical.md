## Technical details
- Add `schedule` and `alerts` screens to `console-access.ts` for admin and editor, with tests. Room and desk volunteers get read-only access to `schedule`.
- The schedule board uses pointer-based drag with 5-minute snapping. Clash detection lives in a pure, tested `src/lib/schedule-clash.ts`. Writes go through organizer RLS on `sessions` / `session_papers`, and each write is recorded in the audit log.
- Alerts reuse the existing announcements data. Add additive columns: `kind`, `audience`, `session_id`, `starts_at`, `ends_at` and `withdrawn_at`. Home and Agenda read active alerts that match the user's audience.
- AI import: a `createServerFn` sends the uploaded file to Lovable AI (Gemini, vision) with a structured-output schema. Matching runs in a pure, tested `src/lib/schedule-import.ts`. **Apply** calls a security-definer `apply_schedule_import(batch jsonb)` that tags rows with `import_batch` so `undo_schedule_import` can roll the batch back.
- Handshake: a new `/c/$code` route. `card_status(code)` reports whether the card is active (the person has a check-in). `record_handshake(code, medium)` is security-definer, idempotent, and writes both rows of the connection for the two people. The return path is kept in sessionStorage across the sign-in flow.
- Sample data: add sample alerts, one sample import file, and a few handshakes to this draft.
- Not in this pass: presenter self-upload of slides, WhatsApp alert delivery, offline check-in.
