# Roadmap
- [x] Password + email-code sign-in, code-first auth emails
- [x] Onboarding: pass match / visitor pass, role claims, profile, consents
- [x] Arrival guide: animated, tappable plans
- [ ] Carry the same motion to Tourism and chat suggestions
- [ ] Phone SMS codes (waiting on an SMS provider)
- [x] Console schedule board, alerts, AI timetable import
- [x] Card handshake link vs profile link
- [ ] Presenter self-upload of slides
- [ ] WhatsApp alert delivery (waiting on WhatsApp Business setup)
- [ ] Network: presence chips ("At the Auditorium now", opt-in) — needs a sharing switch in Me first
- [ ] Network: shared-element card → profile transition

## Later stage (agreed Nov 2026 — tick off in order)
- [x] Google + Microsoft single sign-on (add next to password/email-code; managed sign-in, no keys needed)
- [ ] Redesign sign-in screens and flow; make the sign-in page a landing page that explains the conference (app may sit on the institute domain, so it must stand alone for visitors)
- [ ] Home hero elements — revisit after the countdown board (live/after preview cards were removed on purpose)
- [ ] Online presenter flow: what remote presenters see and can do after phase 1
- [ ] Security pass: roles, RLS, public routes (calendar feed), shared demo accounts removed before guests sign in
- [ ] Bulk "your slot" email sending + calendar sync decision (subscribe link vs Google connector)
- [ ] Institution names: full name-by-name review (GLA University, JSS Science & Tech University Mysuru pending)

## Nov 6 pass
- [x] Logo bar on every guest page, bell opens one Updates sheet (no separate page)
- [x] Bottom bar stays on screen while pages load
- [x] Slim countdown strip; new-update box and dismissible setup cards on Home
- [x] Installable app (home-screen icon) + notification prompt
- [ ] Background push (alerts when the app is closed): needs push keys + a sender that fires on new alerts
- [ ] Separator/all-caps clean-up of console screens not yet reviewed by eye (Overview, Data health, People)
- [ ] Console Overview / Data health / People: move to current data structure, more visual
- [ ] Replace the 64px icon source with a proper high-res app icon from organizers

## Nov 6 asks (second batch)
- [x] Google + Microsoft sign-in buttons
- [x] Sign-in redesign: email code first, Google/Microsoft, password as a switch
- [ ] 6-digit codes: app now accepts 6 to 8; sending 6 needs the backend code-length setting (no tool for it)
- [ ] Background push sender
- [ ] Console Overview / Data health / People on current data
- [x] Spreadsheet-style schedule editor view
- [x] Alert sender: search/filter sessions by code, papers, area/track
- [x] Volunteer alerts with POC approval (email notice + approval screen + "already handled" done; WhatsApp waits on WhatsApp Business, push waits on background push)
- [ ] PC layout polish (Home done: two columns, pass in a side column; other pages pending)
- [x] Swipeable, auto-advancing alert/prompt cards
- [x] Drop card subtext ("Schedule" not "Programme / Three days...")
- [x] Home: assigned slot + paper details as the top card (moved from Me)
- [x] ID card as a hideable module in console
- [x] Moved/rescheduled sessions marked
- [x] Calendar: In person / Online / All + track filter
- [x] Every page: dock, back, logo goes Home
- [x] My Plan empty by default except own slot, organizer "everyone" sessions, stars
- [ ] De-slop copy on each screen touched

## Launch drop (Calendar + slot + papers + stays)
- [x] Calendar needs sign-in; friendly prompt returns guests to Calendar
- [x] Separate "Browse papers" switch (on); rest of Network stays hidden
- [x] Browser security headers on every page
- [ ] Clear pre-launch "Moved" tags (needs a data write; not possible from my tools this turn)
- [ ] Remove/lock shared demo organizer accounts before the email goes out
- [ ] Institute subdomain: add as custom domain once IT shares DNS access

## Module passes (Nov 7)
- [x] Piece 1: sign-in landing, code boxes with paste/auto-submit, resend timer, wrong-email + visitor help, two-panel on computers
- [x] Piece 2: computer top navigation (dock is phone-only), centered countdown + weather sticker, Get ready cards with icons and details
- [x] Piece 3: slot email opens the presenter's slot directly; day tabs off mono font
- [ ] Pieces 4 to 8 (Papers, Stays, Me, verification readiness, organizer launch week)
- [x] Home tiles as physical objects (no icons/subtext), computer top tray in dock style, Home two-column on computers, tighter section gaps
- [ ] Same physical treatment for Calendar rows (side panel on computers), Papers, Stays, Me, buttons

## Nov 10: All Paid v2 + presenter accuracy
- [x] Apply All Paid v2 additions/changes (Venkataramanaiah one card for 3 papers; Borde both papers online; Sunil Srinivasan on campus)
- [x] Load ALL ACCEPTED AUTHOR list onto papers; presenter = "Person coming" (not author 1)
- [x] Help Desk: presenter picks author / name fix / second email, pending until organizer approves
- [ ] Role standardization: wait for ID-card draft, then import its role data accurately
- [x] RAW DATA audit: add paid #754, #1509, #1078 as presenters; fill tracks for #1115/#1117
- [x] Registration category never shows on cards or in the app
- [x] Calendar keynote/panel: speaker or topic as headline, guest plates in drawer and full page
- [ ] Premium guest (VIP) profiles: needs guest people records for keynote/panel speakers
- [ ] Astryx-style tactile pass across Stays, Me and passes
- [ ] Self-service card-details flow: end-to-end test with a real presenter account

## ID card studio upgrade (after templates are final)
- [ ] Final v6 templates become presets in /console/cards (participant, volunteer, PURVA, internal, metal gold/silver)
- [ ] Studio knows metal vs normal cardholder list and role precedence
- [ ] Font picker (Plus Jakarta Sans, Montserrat) and font size controls
- [ ] Multiple QR styles

## Nov 10 console pass
- [x] Details card: optional second email + phone
- [x] Console Papers: full author list, make presenter, author opens editable profile, mode change asks first
- [x] Console People: profile shows papers, session, co-authors
- [x] #1005 reverted to online
