# Task 9-b — Customer accounts (email + password)

Agent: full-stack-developer (customer accounts)
Task ID: 9-b
Scope: Customer accounts end-to-end — Prisma models, cookie sessions (no NextAuth), 8 API routes, #/account page (sign-in/register/overview), header account button, checkout prefill, wishlist localStorage↔account sync.

## Files created
- `prisma/schema.prisma` — added `Customer`, `CustomerSession` (30-day TTL, cascade), `WishlistItem` (bare `slug` + `position`, `@@unique([customerId, slug])`, cascade) + back-relations. `bun run db:push` + dev-server restart done.
- `src/lib/auth.ts` — new customer section: `CUSTOMER_COOKIE='ss_customer'`, `customerCookieOptions()` (httpOnly/lax/path/30d), `createCustomerSession`, `deleteCustomerSession`, `getCustomerFromCookies` (expiry check + lazy cleanup), separate customer rate-limit Map (5 fails/5 min).
- `src/lib/validators.ts` — `customerRegisterInput` (name 2–80, lowercased email, password 8–72), `customerLoginInput`, `customerPatchInput` (clearable text: empty string → null, absent key = untouched), `wishlistSlugsInput` (max 60, non-empty slugs).
- `src/lib/customer-wishlist.ts` — server wishlist helpers: `dedupeSlugs`, `findOffendingWishlistSlug` (exist+active check), `replaceWishlist` (atomic `$transaction` deleteMany+createMany position=index), `hydrateWishlistItems` (slug lookup — no FK — active only, images take 2).
- `src/lib/api-helpers.ts` — `toCustomerProfile` (safe fields; never passwordHash).
- `src/app/api/customer/register/route.ts` — 201 + cookie; 409 “An account with this email already exists.” (incl. P2002 race guard).
- `src/app/api/customer/login/route.ts` — 429 “Too many attempts — try again in a few minutes.”; generic 401 “Incorrect email or password.”; clears failures on success.
- `src/app/api/customer/logout/route.ts` — always 200, deletes session + clears cookie.
- `src/app/api/customer/me/route.ts` — GET 200 `{customer|null}`; PATCH 401 unauth / partial update / “Nothing to update” 400 / safe fields back.
- `src/app/api/customer/orders/route.ts` — session-gated, orders by `email` (lowercased by construction), newest-first, exact field shape of `GET /api/orders?email=`.
- `src/app/api/customer/wishlist/route.ts` — GET hydrated items (position order); PUT validates slugs (400 `Unknown product slug: X`), atomic replace, returns hydrated in submitted order.
- `src/app/api/customer/wishlist/merge/route.ts` — union submitted-first + existing, deduped, cap 60, persists, returns hydrated items.
- `src/hooks/use-customer.ts` — `useCustomer` (query `['customer-me']`, staleTime 5 min), login/register/logout/update mutations (logout drops cache instantly).
- `src/lib/wishlist-sync.tsx` — `<WishlistSync />` mounted once in page.tsx: merge-on-sign-in (also on refresh-with-session), debounced 800ms full-list PUT while signed in (fire-and-forget, console-only failures), sign-out leaves the store as-is.
- `src/components/pages/account-page.tsx` — the whole #/account page (see worklog for detail).

## Files modified
- `src/lib/store/wishlist.ts` — `WishItem` gains optional `secondaryImage`; `setItems` action (preserves `addedAt` per slug); `toggle` accepts `WishItemInput` (backwards compatible — PDP/card call sites unchanged).
- `src/lib/types.ts` — `CustomerView`, `CustomerOrderSummary`, `WishlistItemView`.
- `src/app/page.tsx` — `case 'account'` (key `account:${mode}`) + `<WishlistSync />` mount.
- `src/components/site/header.tsx` — User icon button (44px, `aria-label="Account — signed in as <name>"`, espresso dot when signed in; no name text).
- `src/components/pages/checkout.tsx` — `usePrefillField` (state-based touched flag — no setState-in-effect, no ref-in-render): prefills email/name/phone/address/city/state only where empty/untouched; “Signed in as …” note with #/account link near the email field; guest checkout untouched.
- `src/components/pages/wishlist-page.tsx` — passes `item.secondaryImage` to cards (hover crossfade for restored wishlists).
- `src/app/api/cart/route.ts` — type-only null guard (pre-existing tsc error from the 9-a hotfix; no behavior change).

## QA results (all pass)
- curl: register 201 shape / duplicate 409 / validation 400s; login wrong password 401 + 429 after 5 failures (separate map from admin); me auth+unauth; PATCH 400s (short name/phone, empty body) + success + empty-string clears + 401 unauth; orders empty + with data (real checkout order by email); wishlist GET/PUT/merge — 400 unknown slug, >60 cap, submitted order preserved, dedupe, empty clears; logout clears cookie; 401s on every protected route without cookie.
- agent-browser E2E: register via UI → overview renders (name/member-since/sign-out/profile/orders/wishlist) → profile edit + save → toast “Saved — your details will prefill checkout.” → server state verified via API → checkout fully prefilled + signed-in note → wishlist hearts while signed in → debounced PUTs visible in network log (2× 200) → sign out (header dot gone, form returns, local wishlist kept) → cleared local wishlist → signed back in → merge 200 → wishlist restored from server (2 saved). Zero page/console errors on #/account both states, dark mode clean, desktop 2-col + mobile 390px single col with zero in-main overflow.
- `bun run lint` zero findings; `bunx tsc --noEmit` zero errors in src/.
- Test data cleaned: both QA customers (+ sessions + wishlist rows), both QA orders (SS-2026-3617, SS-2026-1554), stock restored (+1 on the two silk-slip-dress variants). DB back to 0 customers / 0 wishlist rows.

## Notes for other agents
- `GET /api/customer/me` now runs on every page load (header needs the sign-in state) — keep responses tiny.
- Query keys: `['customer-me']`, `['customer-orders']`; invalidate `customer-me` after any auth mutation.
- Deviations + remaining risks are documented in the 9-b worklog entry.
