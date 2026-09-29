# Style Sence — Pre-Launch Audit Report

**Date:** 2026-09-29 · **Auditor:** Senior Full-Stack QA / Security / Performance review
**Scope:** Paystack integration, e-commerce core integrity, dead-file register, security & build hardening
**Code state at audit:** commit `c34762a` (pushed, deployed) + 6 uncommitted UI files (mobile-card / PDP polish)

---

## 1. Executive Summary & Production Readiness Score

## **Score: 7 / 10 — Strong core, not yet live-ready**

The payment and order-settlement architecture is genuinely production-grade: server-authoritative
pricing, signed webhook with constant-time comparison, an atomic exactly-once settlement guard, exact
integer amount matching, and atomic stock decrements with bidirectional cancel-restock. Money can't be
tampered with from the client, and an order can never be born PAID.

What keeps it off 8–9 is **operations and credentials, not code correctness**:

1. Leaked Supabase/Cloudinary credentials still live in git history (rotation pending — known).
2. The Paystack webhook URL is still not confirmed pasted in the dashboard — and the **live** dashboard
   will need it pasted separately when test keys are swapped.
3. The `PENDING_PAYMENT` lifecycle is incomplete: no expiry/reaper for abandoned orders, and no
   retry-payment path for a customer whose Paystack session failed or was cancelled. Stock is
   decremented at order creation, so abandoned checkouts strand inventory until an admin manually cancels.
4. No security headers on the frontend (CSP, X-Frame-Options, HSTS…).

None of these are large engineering efforts; items 1–3 are hard gates before real money flows.

---

## 2. Area 1 — Paystack Integration & Payment Flow Verification

### 2.1 What was verified (all passing)

| Check | Result | Evidence |
|---|---|---|
| Secret key server-only | ✅ | `sk_test_…` lives only in `backend/.env` + Render dashboard (`sync: false`); zero occurrences in `frontend/src`, no `NEXT_PUBLIC_*` secrets; `pay-config` endpoint exposes booleans only (`backend/app/api/checkout/pay-config/route.ts`) |
| Payment initialization | ✅ | Server-side `initiatePaystack` (`backend/lib/payments.ts:33`); amount derived from DB order total (never client); reference = `orderNumber_timestamp` (unique per init); callback URL built server-side from `getFrontendUrl()` |
| Webhook signature | ✅ | HMAC-SHA512 over raw body with `crypto.timingSafeEqual` + length check (`backend/app/api/webhooks/paystack/route.ts:22-31`) — constant-time, rejects unsigned/replayed bodies |
| Callback/verify | ✅ | `/api/checkout/verify` requires `reference === order.paymentReference`; gateway's word required — client redirect alone never settles (`backend/app/api/checkout/verify/route.ts:25`) |
| Double-settle / idempotency | ✅ | `settleGatewayPayment` uses conditional `updateMany({ status: 'PENDING_PAYMENT' })` — exactly one winner across webhook / verify / self-heal races; loser short-circuits, email sent once (`backend/lib/order-settle.ts:32-36`) |
| Amount integrity | ✅ | Exact integer match required (`amountNaira !== order.total` → `amount-mismatch`, no tolerance); all money columns are Prisma `Int` (whole naira), so kobo↔naira conversion is float-safe |
| Stock via webhook, not redirect | ✅ | Stock decremented atomically at order creation (`stock: { gte: qty }` guard in transaction, `checkout/route.ts:106-114`); status flip + email driven by webhook / verify / self-heal — redirect-independent; bank-transfer/USSD (no redirect) settle via webhook alone |
| Cancelled transactions | ✅ | Paystack cancel → callback → verify returns `paid:false` → order stays `PENDING_PAYMENT`; UI shows pending step; no false "paid" state |
| Gateway down at init | ✅ | Order saved (`PENDING_PAYMENT`), customer told studio will send payment details; no data loss (`checkout/route.ts:217-226`) |
| Webhook order resolution | ✅ | By `metadata.orderNumber`, falling back to `paymentReference` lookup |
| E2E status | ✅ | Both rails (gateway + studio-confirmed) E2E-verified 2026-09-29 against live Render deployment |

### 2.2 Gaps found

| # | Gap | Severity | Detail |
|---|---|---|---|
| P1 | **No retry-payment path** | High | A failed/cancelled Paystack session leaves the order `PENDING_PAYMENT` with no "Pay now" affordance anywhere (`order-confirmation.tsx`, `track-order.tsx`); customer must contact the studio. Cart was already cleared and stock taken. |
| P2 | **No `PENDING_PAYMENT` expiry** | High | No reaper/cron cancels abandoned orders, so stock stays locked indefinitely (mitigated only by manual admin cancel, which does restock correctly). |
| P3 | Promo usage burned at creation | Medium | `usageCount` incremented and single-use-per-customer history written at order creation — an abandoned unpaid order permanently consumes the code for that customer (only `CANCELLED` orders are excluded from the history check). Ties into P2. |
| P4 | Refund/dispute events unhandled | Low | `charge.dispute`/refund webhooks not consumed; refunds are dashboard-manual (acceptable for MVP, note for ops). |
| P5 | Verify error ≡ not-paid | Low | `verifyPaystack` returns `paid:false` on network error as well as genuine failure — indistinguishable, but self-heal + polling + webhook make this self-correcting. |
| P6 | Webhook always 200 | Low | Order-not-found / mismatch still returns 200 (no Paystack retry leverage). Harmless given the three-settlement-catcher design. |

### 2.3 Test → Live keys pre-flight checklist

1. **Rotate leaked credentials FIRST** — new Supabase `DATABASE_URL` (with `?sslmode=require`) and Cloudinary key; update Render envs. Git history still carries the old ones.
2. **Complete Paystack business go-live** (live keys are only issued after verification on the dashboard).
3. **Paste the webhook URL into the LIVE dashboard** — `https://stylesence.onrender.com/api/webhooks/paystack`. Test and live dashboards are separate; having it in test does nothing for live. (Test-dashboard paste was still pending as of 2026-09-29 too.)
4. **Swap `PAYSTACK_SECRET_KEY` on Render** to `sk_live_…` (single dashboard env edit + redeploy — no code change needed).
5. Confirm `FRONTEND_URL=https://stylesence.com` on Render — callback URLs in checkout + email links derive from it.
6. Confirm Resend production domain + `EMAIL_FROM` are live (real receipts must leave the machine).
7. Run one **real live-mode test**: ₦ minimum order with a live card → verify webhook settle (Paystack dashboard → Logs), confirmation email, admin order shows PAID → then refund via dashboard.
8. Verify enabled **channels** on live (card, bank transfer, USSD) match what the storefront advertises.
9. Optional but recommended before live: ship P1/P2 fixes (retry-payment endpoint + a daily reaper that cancels `PENDING_PAYMENT` orders older than N days and restocks).
10. Watch the first week of Paystack → Logs for webhook delivery failures.

---

## 3. Area 2 — E-Commerce Core Functional & Data Integrity

| Check | Result | Evidence / Notes |
|---|---|---|
| Price tampering | ✅ Immune | Subtotal computed from `variant.product.price` in DB (`checkout/route.ts:58`); `unitPrice` snapshotted onto order items; client sends no amounts anywhere |
| Coupons/discounts | ✅ Server-authoritative | `evaluatePromoStack`: one code/bag, integer math, discount capped at subtotal, expiry/usage-cap/min-subtotal/single-use-per-customer enforced; retired `SHIPPING` codes rejected outright (`backend/lib/promo.ts`) |
| Shipping fees | ✅ Server-authoritative | Zone flat-rate resolved from country/state server-side; method↔destination mismatch rejected (`backend/lib/shipping.ts`); express is contact-priced (fee charged as ₹0 by design); `scripts/check-shipping.cjs` regression test exists and is live |
| Taxes | ℹ️ N/A | Prices are tax-inclusive by store policy; international duties explicitly declared "paid by recipient" |
| Concurrent checkout race | ✅ Safe | Atomic `updateMany` guarded `stock >= qty` inside the transaction; second buyer gets a precise "only N left" 400; pre-flight check fails fast |
| Out-of-stock | ✅ | Add-to-cart qty capped 1–10; stock check at add + checkout; back-in-stock waitlist (`stock-alerts`) with admin notify |
| Stock on cancel | ✅ | Admin cancel restocks; un-cancel re-consumes with availability guard (`admin/orders/[id]/route.ts`) |
| Guest checkout | ✅ | Cart = httpOnly `ss_cart` cookie (uuid, pattern-validated) → Cart row; guest order lookup via order number + email |
| Session security | ✅ | scrypt passwords (timing-safe compare), DB-backed sessions (admin 7d / customer 30d), `secure` flag in prod, hashed (sha256) single-use reset tokens with 1h TTL |
| Rate limiting | ⚠️ Partial | Login + customer login + reset share a 5/5min budget; **no rate limit on public POSTs** (reviews/newsletter/stock-alerts) — reviews are born PENDING (moderated), so abuse is contained |
| PII handling | ✅ | Full customer details gated behind order-email match; unverified lookups get reduced tracking view only; customer profile endpoint never returns password hash |
| Enumeration | ⚠️ Low risk | Order numbers are 6 random digits (1M space); reduced view leaks status/totals by number — acceptable by design, would benefit from lookup rate limiting |

**Findings to fix (non-blocking):** `ss_cart` cookie lacks `secure` flag (`backend/lib/cart.ts:117-124`); promo-burn issue P3 above; admin-login timing oracle when email unknown (negligible behind rate limit).

---

## 4. Critical Blockers (Must fix before switching to Live keys)

1. **Rotate the git-history-leaked credentials** (Supabase DB URL, Cloudinary). Old values remain recoverable from history (`8ab5c55`, `cda416c`, `42869fc`). Until rotated, any repo exposure = direct DB/media compromise.
2. **Paste the Paystack webhook URL — in the LIVE dashboard** (and confirm the test one). Without it, bank-transfer/USSD payments (which never redirect) only settle via the self-heal poll — minutes late or never if the buyer closes the tab.
3. **Add a `PENDING_PAYMENT` lifecycle** — a daily reaper (cancel + restock orders pending > N days) and/or a retry-payment endpoint so a cancelled session doesn't require WhatsApp to resolve. With real money and small-batch stock, this is an operational blocker.
4. **Ship the 6 uncommitted UI files** (or explicitly shelve them) so the deployed build matches the audited tree.

---

## 5. Dead & Redundant Files Register

~105 tracked files + ~192 MB local build junk. Immediately reclaimable from git: **~34 MB**; pending verification: **~171 MB**; removable packages: **38**.
Live by design (do NOT touch): root `package.json`/`package-lock.json` (npm-workspaces orchestrator), `worklog.md`, `DEPLOYMENT.md`, `render.yaml`, `scripts/check-shipping.cjs`, `products_to_upload/` (active import pipeline), `frontend/design/` (preloader kit), `backend/app/page.tsx` (status page).

| File | Path | Status | Impact |
|---|---|---|---|
| QA probe dumps (2) | `.probe-b.json`, `.probe-h.txt` | Safe to delete | 683 B; one-off Sep-23 debug noise |
| Scaffold proxy config | `Caddyfile` | Safe to delete | 493 B; references non-existent setup |
| Stale bun lockfile | `bun.lock` | Safe to delete | 324 KB; npm is the package manager |
| Old root-app configs (7) | root `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `components.json`, `next-env.d.ts` | Safe to delete | ~5 KB; root app moved to `frontend/` long ago; root `.next/` (192 MB, untracked) is fallout from one accidental root `next dev` |
| QA screenshots (7 + README) | `download/` | Safe to delete | 1.4 MB; one-off acceptance evidence |
| Scaffold demo + placeholder | `examples/websocket/`, `mini-services/` | Safe to delete | 12 KB; imports a dep that isn't installed |
| Platform scripts (9) + **tracked PID file** | `.zscripts/` incl. `dev.pid` | Safe to delete | 53 KB; reference `/home/z/…` paths that don't exist here; a PID file should never be version-controlled |
| Agent session notes (7) | `agent-ctx/` | Archive | 56 KB; mirrored into worklog already |
| Untracked skills duplicate | `agent/` | Needs verification | 197 KB; diverged copy of `.agents/skills/` — diff before deleting |
| Unused shadcn ui set (26) | `frontend/src/components/ui/`: alert, aspect-ratio, avatar, badge, breadcrumb, calendar, card, carousel, chart, collapsible, command, context-menu, drawer, dropdown-menu, form, hover-card, input-otp, navigation-menu, pagination, popover, progress, resizable, scroll-area, sidebar, slider, toggle-group | Safe to delete (with dep trim) | 190 KB source; zero importers (verified) |
| Dead toast cluster (3) | `frontend/src/components/ui/toast.tsx`, `toaster.tsx`, `hooks/use-toast.ts` | Safe to delete | Live toast system is `sonner` (layout.tsx) |
| Dead-only consumers (3) | `ui/toggle.tsx`, `ui/tooltip.tsx`, `hooks/use-mobile.ts` | Safe to delete | Only imported by other dead files |
| Scaffold logo | `frontend/public/logo.svg` | Safe to delete | Site uses `stylesence-logo.png` |
| Old editorial mockups (5) | `frontend/public/images/editorial/` | Safe to delete | 556 KB; replaced by Cloudinary URLs |
| Hero video local copy | `frontend/public/IMG_7612 (2).MP4` | Archive | 5.6 MB; site streams the Cloudinary copy — keep as master backup off-repo |
| One-off photo sources (10) | `frontend/public/IMAGESS/` | Archive (then delete) | 25 MB; replacement run finished (map file exists) |
| Product video fallbacks (7) | `frontend/public/videos/products/` | **Needs verification** | 159 MB — query DB for any `/videos/…` media URLs before removing |
| Imported product photo fallbacks (8) | `frontend/public/images/products/the-camille-*`, `the-ariella-*` | **Needs verification** | 12 MB — same check |
| Unused deps (38) | `frontend/package.json`: z-ai-web-dev-sdk, next-auth, next-intl, @mdxeditor/editor, @dnd-kit/*, @tanstack/react-table, react-syntax-highlighter, uuid, sharp, date-fns, react-markdown, @reactuses/core, @hookform/resolvers, zod, react-resizable-panels, react-hook-form, input-otp, react-day-picker, embla-carousel-react, vaul, cmdk + 15 Radix packages backing only dead ui files; devDep `bun-types` | Safe to remove **after** deleting dead components | Tree-shaking keeps most out of the client bundle, but they bloat install/build (sharp, mdxeditor, next-auth are heavy) and invite drift |
| Old SQLite DB | `backend/db/custom.db` | Safe to delete (git rm) | 428 KB; schema has been `postgresql` for weeks; contains stale local data |
| Inert Vercel config | `backend/vercel.json` | Safe to delete | Backend lives on Render |
| Old Docker files (2) | `backend/Dockerfile`, `.dockerignore` | Archive | Render uses native node; keep only if Docker path wanted later |
| One-off output map | `backend/scripts/mockup-replacement-map.json` | Archive | Written by `replace-mockups.ts`, never read |

---

## 6. Area 4 — Security, Environment & Build Hardening

| Check | Result | Detail |
|---|---|---|
| `.gitignore` coverage | ✅ | `.env*`, `PRODUCTION-ENV.txt`, `.audit-tmp/`, build outputs all ignored; **no env file is git-tracked** (verified via `git ls-files`) |
| Hardcoded secrets in source | ✅ None | Full-tree grep for `sk_/pk_/whsec_` patterns: only doc comments explaining env var names |
| Git **history** | ❌ **Leak** | DB + Cloudinary creds committed historically then removed — recoverable until rotated (Critical Blocker 1) |
| CORS | ✅ | Backend `/api/*` emits a concrete origin (`FRONTEND_URL`) with credentials — no wildcard+credentials incoherence; browser traffic is same-origin anyway via the frontend `/api` rewrite |
| Security headers | ⚠️ Missing | Frontend has **no** CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, or HSTS (`frontend/next.config.ts` + bare `vercel.json`). Recommended: add `headers()` in next.config |
| SQLi | ✅ N/A | Prisma everywhere; zero `$queryRaw`/`$executeRaw` in the codebase; all inputs Zod-validated |
| XSS | ✅ | React escaping throughout; the only `dangerouslySetInnerHTML` uses are static JSON-LD (no user input, eslint-annotated) and the shadcn chart template; transactional emails escape customer text (`esc()` in `email.ts`) |
| Admin surface | ✅ | All admin routes behind `requireAdmin()`; upload route caps size + admin-gates; dev-credential leak from earlier audit fixed (pw rotated); generic login errors + 5/5min rate limit |
| Test endpoints | ✅ | `scripts/*` are not routed; webhook GET returns a harmless `{status:active}`; `/api/health` is intentional |
| Dummy URLs in prod | ✅ | All URLs derive from env (`FRONTEND_URL`, `SITE_URL`, `BACKEND_URL`); localhost fallbacks only fire when mail is simulated |
| Cookie hygiene | ⚠️ Minor | `ss_cart` missing `secure` flag (admin/customer session cookies have it) |

---

## 7. Warnings & Optimizations (SEO, bundle, latency)

1. **API latency / cold starts** — Render starter plan sleeps; first request after idle pays 1–4s (previously measured). Mitigate: external keep-alive ping on `/api/health` or upgrade plan before launch traffic.
2. **Bundle/deps** — removing the 38 dead packages + 32 dead components materially cuts install/build time (client bundle largely unaffected due to tree-shaking). `sharp` in frontend deps is pure waste (no `next/image` usage — plain `<img>`; consider adopting `next/image` later for LCP wins on PDP).
3. **SEO** — path-routing migration is live with real 404s + 13-entry sitemap; verify `SITE_URL` on Vercel matches the current canonical (www primary, apex 308s). Order/journal content is fetch-time — fine at current scale.
4. **Repo size** — ~196 MB of media in `frontend/public` is candidate for removal after the DB URL check (section 5); keeps clones fast and renders Vercel builds snappier.
5. **Admin console stability** — earlier audit reported tab-crashing behavior in admin; re-verify on the deployed build before launch day (not reproduced in this audit's code read; dashboard uses recharts directly).
6. **Uncommitted work** — 6 modified frontend files (mobile-card/PDP polish) are ahead of `main`; ship or shelve.
7. **PII reduced view** — order-status lookups unauthenticated by design; add light rate limiting when traffic grows.

---

## 8. Action Plan (priorified)

**Gate 1 — before live keys (blockers)**
1. Rotate Supabase + Cloudinary credentials; update Render envs; verify with `db:probe` script. 
2. Add `PENDING_PAYMENT` reaper (cancel + restock after N days) — also resolves promo-burn P3.
3. Add retry-payment: `POST /api/orders/[orderNumber]/pay` re-initializing the gateway for a pending order (status-guarded), surfaced as a "Complete payment" button on the order page.
4. Commit or shelve the 6 modified UI files.

**Gate 2 — live-key switch**
5. Paystack business go-live → paste webhook URL in LIVE dashboard → swap `sk_live` on Render.
6. Confirm `FRONTEND_URL` on Render + `SITE_URL` on Vercel + Resend production domain.
7. ₦ live smoke test: order → webhook settle → email → admin PAID → dashboard refund.

**Gate 3 — hardening & hygiene (first week)**
8. Add frontend security headers (CSP can start `Report-Only`), `secure` flag on `ss_cart`.
9. Dead-file purge (section 5): root scaffold configs, `.zscripts/`, `examples/`, `mini-services/`, `download/`, `agent-ctx/`, `backend/db/custom.db`, `backend/vercel.json`, 32 dead components, 38 deps, `bun.lock` — after DB-URL verification, the 171 MB media set.
10. Rate-limit public POSTs (reviews/newsletter/stock-alerts) — simple in-memory limiter like the login one.
11. Keep-alive or plan upgrade for Render; re-audit latency at launch traffic.

---

*Audit basis: full read of payment/checkout/auth/settlement code paths, config + env review, git-history inspection, import-graph dead-file scan, and prior E2E verifications on record (2026-09-29, both payment rails). Live HTTP probing was not possible from this sandbox (network blocked) — deployment-level checks rely on the recorded E2E results.*
