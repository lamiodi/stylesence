# Fix Plan — Pre-Launch Audit Remediation (2026-09-29)

Companion to `PRE-LAUNCH-AUDIT-2026-09-29.md`. Phases are ordered so each one is
independently shippable and verifiable. [CODE] = agent implements; [OWNER] = dashboard
actions only you can perform.

---

## Phase 1 — Payment lifecycle (fixes Blockers 3 + P1/P2/P3)  [CODE]

**1a. Retry-payment endpoint** — `backend/app/api/orders/[orderNumber]/pay/route.ts` (new)
- `POST`, gated the same way as the order view: requires `?email=` matching the order (PII gate already proven on this surface).
- Only acts when `status === 'PENDING_PAYMENT'` and `paymentMethod` is `paystack`/`stripe`; re-initializes the gateway with the stored `order.total` (server-side amount, same as checkout), updates `paymentReference` to the new reference, returns `{ payment: { url } }`.
- Verify-route's reference-match guard and the webhook's `findFirst({ paymentReference })` fallback keep working unchanged with the refreshed reference.
- Failed init → same graceful response as checkout (order stays saved).

**1b. "Complete payment" button** — `frontend/src/components/pages/order-confirmation.tsx`
- Shown when `status === PENDING_PAYMENT && paymentMethod !== 'confirmed'` and the viewer is email-verified: calls 1a, redirects to the hosted page. Replaces "WhatsApp the studio" as the primary path for cancelled/failed sessions.

**1c. PENDING_PAYMENT reaper** — `backend/scripts/reap-pending-orders.ts` (new) + `backend/instrumentation.ts` (new)
- Cancels + restocks `PENDING_PAYMENT` orders older than `PENDING_TTL_DAYS` (default 3) in one transaction (restock mirrors the admin-cancel logic); decrements burned `usageCount` for the order's promo codes (fixes P3).
- Runs daily via `setInterval` in `instrumentation.ts` (valid: backend is a long-running Render node service, not serverless), guarded by env flag so dev never runs it.
- Log-only dry-run mode first; verify one forced-old test order in prod before enabling live cancel.

**Verify:** local build + `node scripts/check-shipping.cjs` parity test → push (auto-deploys) → prod test: abandon a Paystack test session → button appears → retry pays → order settles via webhook; force one order old → reaper cancels + restocks.

## Phase 2 — Security hardening (Warnings 1, cookie, rate limits)  [CODE]

- **2a.** `frontend/next.config.ts` `headers()`: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera=(), microphone=(), geolocation=()), HSTS. CSP ships as `Content-Security-Policy-Report-Only` first (Next.js needs tuned nonce/unsafe-inline allowances; enforce after a week of clean reports).
- **2b.** `backend/lib/cart.ts`: add `secure: process.env.NODE_ENV === 'production'` to `setCartCookie` (matches the admin/customer cookies).
- **2c.** Rate-limit public POSTs — port the existing in-memory limiter pattern (per-IP, e.g. 5/min) onto reviews, newsletter, stock-alerts routes.

## Phase 3 — Ship current work + dead-file purge (Blocker 4 + Register)  [CODE]

- **3a.** Commit the 6 modified UI files (finished mobile-card/PDP polish) — deployed tree then matches audited tree.
- **3b.** Delete the 29 dead shadcn components + `toast/toaster` + `use-toast` + `use-mobile` → build green.
- **3c.** Remove the 38 unused deps from `frontend/package.json` → fresh install → build green (order matters: components before deps).
- **3d.** `git rm`: root scaffold configs (`Caddyfile`, root `tsconfig/next.config/tailwind/postcss/eslint/components.json`, `.probe-*`, `bun.lock`), `.zscripts/` (incl. tracked `dev.pid`), `examples/`, `mini-services/`, `download/`, `agent-ctx/` (zip-archive first), `backend/db/custom.db`, `backend/vercel.json`, `frontend/public/logo.svg`, `images/editorial/`, `IMAGESS/` (after archiving masters off-repo).
- **3e.** Media verification gate: query DB for any `url LIKE '/videos/%'` or local `/images/products/the-%` before removing the 159 MB videos + 12 MB photos; if clean, `git rm` them too.
- **3f.** Local-only cleanup: delete stray root `.next/` (192 MB) + root `next-env.d.ts`.

**Verify:** frontend `next build` + backend `next build` both green; smoke-test shop → PDP → cart → checkout locally on port 3100.

## Phase 4 — Credentials & live keys (Blockers 1 + 2)  [OWNER — I provide exact click-paths]

1. **Supabase DB rotation** (do together with Render update, one sitting — brief API downtime between them is fine pre-launch): Supabase dashboard → Database → reset database password → compose new pooled connection string with `?sslmode=require` → paste into Render `DATABASE_URL` → redeploy → `/api/health` green.
2. **Cloudinary rotation**: dashboard → Settings → API Keys → generate new → update `CLOUDINARY_URL` on Render → redeploy → test admin upload.
3. **Paystack go-live**: complete business verification → live keys issued.
4. **Webhook in LIVE dashboard**: Settings → API Keys & Webhooks → `https://stylesence.onrender.com/api/webhooks/paystack`.
5. **Swap `PAYSTACK_SECRET_KEY` to `sk_live_…`** on Render (after Phases 1–3 deployed).
6. Confirm `SITE_URL` on Vercel = current canonical (www-primary) + Resend domain live.
7. **Live smoke test**: ₦ real card order → webhook log shows 200 → order PAID + email → admin → refund via dashboard.

---

### Effort / sequencing summary

| Phase | Owner | Effort | Blocks live keys? |
|---|---|---|---|
| 1 Payment lifecycle | CODE | ~half session | Yes (Blocker 3) |
| 2 Hardening | CODE | ~1 hour | No |
| 3 Ship + purge | CODE | ~1 hour | Yes (Blocker 4) |
| 4 Creds + live keys | OWNER | ~30 min dashboard time | Yes (Blockers 1+2) |

Phases 1–3 can run as one code session; Phase 4 is yours, sequenced last, right before launch traffic.
