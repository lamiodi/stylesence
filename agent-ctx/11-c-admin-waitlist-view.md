# Task 11-c — Admin waitlist management view

Agent: full-stack-developer (admin waitlist view)
Task ID: 11-c
Scope: Consolidated StockAlert admin panel — GET /api/admin/waitlist (filter + summary + 500-row cap) + waitlist-manager.tsx panel + 8th admin tab (Bell icon, between Reviews and Promos). Closes worklog priority #7 from Round 10.

## Files created
- `src/app/api/admin/waitlist/route.ts` — GET, requireAdmin (401 `{error:"Unauthorized"}`); optional `?status=pending|notified` validated like the reviews route (trim/`|| null`, enum miss → 400 "Invalid status filter", empty = ALL). Rows `{id, email, createdAt, notifiedAt, productName, productSlug, productActive, variantId, size, color, stock}` via include variant→product. Order: pending (notifiedAt null) by createdAt asc FIRST, then notified by notifiedAt desc — two findMany queries merged (single orderBy can't sort the two groups by different keys); a status filter queries only its group. Cap 500; `truncated: true` added ONLY when the applicable set exceeds the cap. Summary ALWAYS full-set: two counts + distinct-email findMany → `{total, pending, notified, uniqueEmails}`.
- `src/components/admin/waitlist-manager.tsx` — 'use client' panel: header (eyebrow "Back in stock" + serif h2 + intro + Export CSV), 4 hairline summary tiles, DevPlaceholder (simulated notifications), status Tabs Waiting/Notified/All (default Waiting) with full-set counts, hairline table (sticky header, max-h scroll-elegant, hover:bg-secondary/50): Email mono mailto · Piece link → #/product/<slug> (+ espresso "Retired" tag when inactive) · Variant mono · Stock now (espresso + title/sr-only "still sold out" when 0) · Requested · Status chip (WAITING charcoal outline / NOTIFIED ✓ muted + notifiedAt date under the chip). Meta line "WAITING · 2 OF 2 REQUESTS" + truncation note. CSV = subscribers pattern (escaped cells, data:text/csv, `waitlist-YYYY-MM-DD.csv`, exports the ACTIVE filter's rows). Per-filter empty states, skeleton, PanelError+retry. Query key `['admin','waitlist',tab]`, staleTime 30s, `placeholderData: keepPreviousData` (tiles stay mounted across switches; table dims + aria-busy while refetching).

## Files modified
- `src/components/admin/admin-app.tsx` — 4-line minimal edit: `Bell` in the lucide import, `import { WaitlistManager }`, TABS entry between 'reviews' and 'promos', panel render. Title "Admin · Waitlist — Style Sence" free via the existing activeLabel effect.

## QA results (all pass)
- curl (admin jar; baseline StockAlert = 0): seeded 4 alerts directly in DB (2 pending on leather-mini-tote Charcoal One Size — the seed's only 0-stock variant — 20d/5d ago; 2 notified on the in-stock Espresso variant, notifiedAt 3d/1d ago). Default GET → 200, correct merged order, summary {4,2,2,4}, no truncated field; ?status=pending → 2 oldest-first; ?status=notified → 2 notifiedAt-desc; ?status=bogus → 400; ?status= → ALL; 401 without cookie on both paths. 501-row bulk seed: default → exactly 500 rows + truncated:true + full-set summary (total 505) with the 20d-old row still first; ?status=notified in the same state → 2 rows, no truncated flag. Bulk rows deleted immediately.
- agent-browser (fresh session, 1440×900): login → Waitlist tab + title + URL; tiles 4/2/2/4; Waiting default with correct rows + espresso stock-0 + charcoal WAITING chips (computed styles verified); Notified → most-recent-first with dates; All → merged order; CSV captured (707 bytes, 4 rows); mailto + product hrefs correct; zero page/console errors. Mobile 390×844: tab reachable in scroll nav, doc + panel scrollWidth === clientWidth (table scrolls in its own container like orders-manager), 2×2 hairline tiles, tabs work.
- `bun run lint` zero findings (project-wide + my 3 files); `bunx tsc --noEmit` zero errors in project src/ (pre-existing examples/scripts/skills errors are other owners').
- Cleanup: 4 QA rows deleted (count back to 0), browser closed, curl jar logged out + deleted, temp files removed. dev.log clean.

## Notes for other agents
- `GET /api/admin/waitlist` summary is full-set even under ?status= — panel tab counts + tiles rely on that.
- Invalid `?status` mirrors the reviews route: 400 "Invalid status filter"; empty value = ALL.
- If a future feature needs waitlist invalidation after restocks, invalidate `['admin','waitlist']` from the products PATCH flow (not done — out of my ownership; panel refetches on mount/30s stale).
- Summary strip uses `grid gap-px bg-line` (not divide-x) so the 2×2 mobile wrap keeps clean hairlines — reuse that pattern for wrapping tile strips.
