# Auth & Onboarding v1: password + email code

## What the delegate experiences
1. **Sign up**: email + password. We email a 6-digit code (no link-only emails). Enter the code and the account is confirmed.
2. **Sign in**: email + password. Alternatively, "Email me a code" signs in without a password.
3. **Forgot password**: we email a 6-digit code, then they choose a new password.
4. **Onboarding (first sign-in only, 3 short steps)**
   - **Match**: we look up their email in the organizer registry.
     - Found: "Welcome, Dr. X". Their pass, role and papers are shown, ready to confirm.
     - Not found: they get a **Visitor pass**, plus a "I'm actually a presenter / chair / reviewer / other" option. That opens a short claim form (role, submission ID if any, note), which goes to the organizer review queue.
   - **Profile**: phone (optional), up to 8 research keywords, one-line bio, LinkedIn, and a "List me in Network" switch (off by default).
   - **Consents**: photos, WhatsApp updates, calls. Then they land on their pass in Me.
5. **Organizers**: role claims show up in Console → Review. Approving one links the account to the right person record and role. Rejecting it keeps the Visitor pass.

## Emails
All six sign-in emails get rewritten to show the code in large type. Confirm signup, sign-in code and reset password also keep a fallback button. The look stays as today (pine green on paper).

## Technical details
- Turn on email/password sign-in. Use `signUp` + `verifyOtp({type:'signup'})`, `signInWithPassword`, `signInWithOtp({shouldCreateUser:false})` + `verifyOtp({type:'email'})`, `resetPasswordForEmail` + `verifyOtp({type:'recovery'})` + `updateUser`.
- Templates: pass `data.token` into signup, magic-link and recovery (the reauthentication email already uses it). These are sign-in emails, so the transactional registry stays unchanged.
- Migration: `profiles.onboarded_at`, `profiles.phone`. Add `pass_kind` ('delegate' | 'visitor') to the output of `claim_my_person()`. Role claims go into `review_items` with `kind='role_claim'` (owner-insert RLS for the claimant; organizers read and resolve). Add a security-definer `resolve_role_claim(_item, _approve, _person)`.
- New route `/onboarding` (client-gated). `/auth` sends users who haven't onboarded there, and everyone else to `/me`.
- Me/DelegatePass: show a "Visitor" ribbon when there's no linked person record, plus a "Pending review" chip while a claim is open.
- Tests: claim-status helper and onboarding redirect rule, kept pure in `src/lib/onboarding.ts`.

## Out of scope
Phone SMS codes (later, when an SMS provider is ready).

## Part 2: Livelier Guide (starting with Arrival)
- **Step-by-step planner**: one question per screen with tappable chips. A progress bar slides forward and you can swipe back.
- **Animated results**: plan cards fan out like tickets, and fares count up to their value. The route draws itself as a line (city to Guwahati to Shillong to campus). Tap a leg to see its details.
- **Live tweaking**: changing the mode or budget reshuffles the cards in place, with no reload.
- **Touch feel**: a press-down effect, quick slide-up sheets for booking links and haptic ticks on Android. Everything goes still when the phone's reduce-motion setting is on.
- The same patterns then carry over to Tourism and the chat suggestions.

Technical: CSS/View Transitions plus small FLIP helpers, no heavy animation library. Planner logic stays unchanged.
