# Task 11-b — Customer password reset flow

Agent: full-stack-developer (password reset)
Task ID: 11-b
Scope: End-to-end customer password reset — reset-token helpers in auth.ts, two new API routes (request + confirm), forgot/reset modes on the #/account page, with a clearly-labelled dev placeholder standing in for email delivery.

## Files created
- `src/app/api/customer/password-reset/request/route.ts` — POST {email}. Rate-limits FIRST (shares the customer login budget → 429 "Too many attempts — try again in a few minutes."), then ALWAYS 200 `{ok:true}` (anti-enumeration). Known email: stores resetTokenHash (sha256) + resetTokenAt, console-logs the established simulated-email trace, returns `devResetUrl: '/#/account?mode=reset&token=<plain>'` (dev-preview affordance only — see code comment). Unknown email: `{ok:true}` with NO devResetUrl + recordCustomerLoginFailure (probing burns the budget; known emails never do).
- `src/app/api/customer/password-reset/confirm/route.ts` — POST {token, password}. findFirst by hashed token → 400 "invalid or has already been used" / 400 "expired" (RESET_TOKEN_TTL_MS = 1h). Success: $transaction(deleteMany ALL CustomerSession + update passwordHash/clear token) → clearCustomerLoginFailures → 200 `{ok:true}` + console trace "password updated for <email> — N session(s) invalidated".

## Files modified
- `src/lib/auth.ts` — appended one section: `RESET_TOKEN_TTL_MS`, `hashResetToken` (sha256 hex — fast hash OK because the token is 192-bit random, comment explains), `generateResetToken` (randomBytes(24) hex = 48 chars). Plus a comment documenting the lead's decision that reset requests REUSE the customer login rate-limit map (one 5-per-5-min budget per email — desired anti-enumeration behaviour).
- `src/components/pages/account-page.tsx` — `?mode=forgot` ("Reset your password" + Send-a-reset-link card → success block with Check icon / "If an account exists for <email>…" / 1-hour note / Back to sign in + DevPlaceholder "email is simulated (development preview)" containing the devResetUrl Link) and `?mode=reset&token=…` ("Choose a new password" + new/confirm password fields, autoComplete="new-password", client match + min-8 errors → success block "all devices were signed out" + Continue to sign in; server 400 shows the error inline + "Request a new link" → ?mode=forgot; missing token → "This link is incomplete." guidance). "Forgot your password?" small uppercase link added under the sign-in password field (min-h-11). Titles: "Reset password — Style Sence" / "Choose a new password — Style Sence". Forgot/reset views render regardless of sign-in state (reset links must work wherever opened) and skip the customer skeleton gate (they don't need the profile query). Reset success invalidates ['customer-me'].

## Untouched (per ownership)
validators.ts, schema.prisma, page.tsx (remount key `account:${mode}` already remounts on every designed flow transition — token-only URL edits within mode=reset do NOT remount; optional lead improvement: include token in the key), use-customer.ts, all admin/product files.

## QA (all pass)
- curl: request known email 200 + devResetUrl + dev.log trace; unknown email ×5 → 200 `{ok:true}` no devResetUrl, 6th → 429; invalid email 400; missing/empty body 400; known email ×8 all 200 (no budget burn); confirm valid token 200; both old session cookies → me null + orders 401; old password login 401; new password login 200 + profile fields intact; reused token 400; tampered token 400; short password 400; missing token 400; short token 400; back-dated token (bun -e) → 400 expired; dev.log "2 session(s) invalidated" trace.
- agent-browser (desktop 1440×900, fresh session): register → overview → sign out → "Forgot your password?" → forgot view (title ✔) → submit email → success block + DevPlaceholder → click "Open the simulated reset email" → new-password form (title ✔) → client mismatch error → submit → success block → "Continue to sign in" → sign in with NEW password → overview renders. Tampered-token deep link → inline server error + "Request a new link" → navigates to ?mode=forgot. ?mode=reset without token → guidance view. ZERO page errors, ZERO console errors throughout. Mobile 390px: forgot view 0px overflow; sign-in view 0px overflow; forgot link 44px touch target.
- lint: 0 findings project-wide. tsc: 0 errors in src/. dev.log clean.
- Cleanup: both QA customers deleted (cascades), 3 empty QA-window carts removed, 0 customers/sessions/wishlist/resetToken rows remain. In-memory rate-limit entries (ghost.probe@ ×5, qa.reset@ ×1) expire within 5 min / vanish on restart (established pattern).

## Notes for other agents
- `devResetUrl` in the request response is dev-preview ONLY — must not exist in production (comment in the route says so).
- Reset confirm deletes ALL CustomerSession rows for the customer — any feature holding a customer session must expect this.
- Reset requests + customer logins share ONE rate-limit budget per email (5/5min) — a rate-limited login email is also rate-limited for resets, by design.
