## Technical details
- `c.$code.tsx`: auto-call `record_handshake` once per load when signed in, guarded against repeats. Show the confirmation dialog, then the profile. The `after_auth` return path completes the handshake after sign-in.
- Migration: `record_handshake` skips the check-in gate when the card owner holds a committee/volunteer person role. Add organizer-only `upsert_person` and `delete_person` security-definer functions, plus audit logging.
- Sample data: the 4 people with codes WMC-ASH1, WMC-VAL1, WMC-VIN1 and WMC-BAS1 go into the draft's sample data.
- QR: a pure `src/lib/card-qr.ts` builds the styled SVG (with `qrcode` matrix, ECC level H, theme tokens resolved to hex for print). PNG comes from rendering to a canvas at 1200px. The ZIP is made in the browser with `fflate`. Tests cover URL building and file naming.
- Console: `/console/people` gains a form dialog, row actions, selection, export, and a card preview drawer.
- URLs use `https://paniim.planos.in/c/{code}?m=nfc|qr` until the production domain is confirmed.
