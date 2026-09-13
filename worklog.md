# Style Sence by SKR — Development Worklog

> Shared coordination document. All agents MUST read this before working and MUST append a section after finishing a Task ID.

---

## Project Status (2026-01 initial assessment)

- Scaffold is fresh: default `src/app/page.tsx`, no e-commerce code, no worklog, `upload/` blueprint file missing.
- Dev server runs on port 3000 (Next.js 16.1.3 Turbopack, `bun run dev`, logs at `/home/z/my-project/dev.log`).
- Full shadcn/ui set present in `src/components/ui`. Prisma 6 + SQLite configured (`db/custom.db`), old demo User/Post models to be replaced.
- **Build-from-scratch phase.** Brand: *Style Sence by SKR* — modern womenswear e-commerce, editorial ivory/charcoal design language, hash-routed SPA served from `/`, admin at `#/admin` (dev login `owner@stylesence.example` / `stylesence-dev-2026`), currency ₦ (Naira), honour `prefers-reduced-motion`, unresolved commercial details = clearly-labelled dev placeholders.

## Architecture (agreed)

- Single user-visible route `/` → client-side **hash router** (`#/`, `#/shop`, `#/product/:slug`, `#/cart`, `#/checkout`, `#/order/:orderNumber`, `#/wishlist`, `#/journal`, `#/journal/:slug`, `#/about`, `#/admin`).
- REST APIs under `/api/**` (App Router route handlers, JSON, zod-validated). Cart identity = httpOnly cookie `ss_cart` (uuid). Admin session = httpOnly cookie `ss_admin` (token → AdminSession row).
- TanStack Query for server state; Zustand (persist) for wishlist; framer-motion gated by `useReducedMotion`; sonner for toasts; recharts for admin charts.
- Money = integer whole Naira. `formatNaira(n)` → `₦148,000`.

## Design tokens (ivory / charcoal, NO blue/indigo)

- `--background` warm ivory `oklch(0.973 0.009 88)` (#F6F1E9), `--foreground` charcoal `oklch(0.235 0.008 70)` (#26231F).
- `--primary` = charcoal (buttons invert to ivory text). Accent/espresso `oklch(0.38 0.03 60)`. Hairline borders `charcoal/12%`.
- Dark mode (`.dark`, next-themes class, default light): background deep warm charcoal `oklch(0.245 0.008 70)`, foreground ivory.
- Fonts: **Fraunces** (display serif, `--font-display`) + **Geist Sans** (body). Uppercase tracking-[0.2em] sans for eyebrows/labels, serif for headlines.
- Motion: subtle 300–500ms ease fades/slides; marquee + hero ken-burns MUST be disabled under `@media (prefers-reduced-motion: reduce)`.
- Dev placeholders: dashed-border boxes labelled "DEV PLACEHOLDER — …".

## Prisma models

AdminUser, AdminSession, Category, Product, ProductImage, ProductVariant, Review (status PENDING/APPROVED/REJECTED), Cart (cookieId) + CartItem, Order + OrderItem, NewsletterSubscriber, JournalPost. Prices integer Naira; `details` newline-separated bullets.

## API contract (v1 — all agents follow exactly)

All JSON. Errors: `{ "error": "message" }` + status. Success wraps payload in named keys (e.g. `{ products, total, page, perPage, facets }`).

**Storefront**
- `GET /api/categories` → `{ categories: [{ id, slug, name, tagline, imageUrl, productCount }] }`
- `GET /api/products?category=&q=&size=&color=&minPrice=&maxPrice=&sort=featured|newest|price-asc|price-desc|rating&page=1&perPage=12` → `{ products: [{ id, slug, name, subtitle, price, compareAtPrice, primaryImage, colors:[{name,hex}], sizes:[string], rating, reviewCount, isNew }], total, page, perPage, facets: { colors:[{name,hex,count}], sizes:[{size,count}], priceRange:{min,max} } }`
- `GET /api/products/[slug]` → `{ product: { …card fields, description, material, care, details:[string], category:{slug,name}, images:[{url,alt}], variants:[{id,size,color,colorHex,stock,sku}], rating, reviewCount, reviews:[{id,author,rating,title,body,createdAt}], related:[{slug,name,price,primaryImage}] } }` (404 unknown/inactive)
- `POST /api/products/[slug]/reviews` `{author,email,rating(1-5),title,body}` → `{ review, status:"PENDING" }`
- Cart (`ss_cart` cookie, lazy-create):
  - `GET /api/cart` → `{ cart: { items:[{ id, qty, variant:{id,size,color,colorHex,stock}, product:{slug,name,price,primaryImage} }], subtotal, itemCount } }`
  - `POST /api/cart` `{variantId, qty}` → same cart shape
  - `PATCH /api/cart` `{itemId, qty}` (0 removes) → cart
  - `DELETE /api/cart?itemId=` / `?clear=1` → cart
- `POST /api/checkout` `{email,fullName,phone,address,city,state,notes?,shippingMethod:"standard"|"express"}` → validates stock, decrements, creates order (status `PAID` — dev placeholder payment), clears cart → `{ order:{ orderNumber, total } }`
- `GET /api/orders/[orderNumber]` → `{ order: { orderNumber, status, email, fullName, address, city, state, country, phone, shippingMethod, shipping, subtotal, total, createdAt, items:[{productName,productSlug,size,color,imageUrl,unitPrice,qty}] } }`
- `POST /api/newsletter` `{email}` → `{ ok:true }` (dedupe, zod email)
- `GET /api/journal` → `{ posts:[{slug,title,excerpt,category,coverImage,publishedAt,readTime}] }`
- `GET /api/journal/[slug]` → `{ post:{ …, body } }` (paragraphs separated by `\n\n`, `## ` headings)

**Admin** (cookie `ss_admin`; everything except login returns 401 `{error:"Unauthorized"}`)
- `POST /api/admin/login` `{email,password}` → sets cookie; `{ admin:{name,email,role} }`; 401 on bad creds; naive rate limit
- `POST /api/admin/logout` → `{ ok:true }`
- `GET /api/admin/me` → `{ admin }` | 401
- `GET /api/admin/stats` → `{ revenue:{total,last30}, orders:{total, byStatus:{PAID,PROCESSING,SHIPPED,DELIVERED,CANCELLED}, last30Series:[{date:"YYYY-MM-DD",revenue,orders}], recent:[{orderNumber,fullName,email,total,status,createdAt,itemCount}] }, products:{total,active,lowStock:[{productName,variant:{size,color},stock}]}, reviews:{pending,approved,avgRating}, subscribers, customers }`
- `GET /api/admin/products` (all incl inactive, w/ variants+images+summed stock) → `{ products }`
- `POST /api/admin/products` full payload incl. `variants:[{size,color,colorHex,stock}]`, `images:[{url,alt}]`, `details` string → `{ product }`
- `PATCH /api/admin/products/[id]` partial (name, subtitle, price, compareAtPrice, isActive, isFeatured, categoryId, description, material, care, details, variantStocks:[{id,stock}]) → `{ product }`
- `DELETE /api/admin/products/[id]` → `{ ok:true }`
- `GET /api/admin/orders` → `{ orders:[{…order, items:[…]}] }` newest first
- `PATCH /api/admin/orders/[id]` `{status}` (validate enum) → `{ order }`
- `GET /api/admin/reviews?status=` → `{ reviews:[{…, productName, productSlug}] }`
- `PATCH /api/admin/reviews/[id]` `{status}` → `{ review }`; `DELETE` → `{ ok:true }`
- `GET /api/admin/subscribers` → `{ subscribers:[{id,email,source,createdAt}] }`
- `GET /api/admin/customers` → `{ customers:[{email,name,orderCount,lifetimeValue,lastOrderAt}] }` (derived from orders)

## File ownership (avoid conflicts)

- Task 2 agent: `src/app/api/**`, `src/lib/auth.ts`, `src/lib/cart.ts`, `src/lib/api-helpers.ts`, `src/lib/validators.ts` ONLY.
- Task 3 (lead): `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css`, `src/components/site/**`, `src/components/pages/**`, `src/components/admin/admin-app.tsx` (+ stubs), `src/lib/money.ts`, `src/lib/store/**`, `src/hooks/**`.
- Task 4 agent: `src/components/admin/dashboard.tsx`, `products-manager.tsx`, `orders-manager.tsx`, `reviews-manager.tsx`, `subscribers-manager.tsx`, `customers-manager.tsx` (overwrite stubs) ONLY.
- Shared: `prisma/schema.prisma`, `scripts/seed.ts` (lead owns).

## Task log

---
Task ID: 0
Agent: lead (Z.ai Code)
Task: Project assessment, architecture + contracts, initial worklog

Work Log:
- Verified scaffold (fresh Next.js 16, dev server up, shadcn/ui complete, Prisma SQLite configured).
- Blueprint file absent from `upload/` — designing from context brief.
- Defined hash-router SPA architecture, API contract v1, ivory/charcoal tokens, file ownership.

Stage Summary:
- Project started from scratch; coordination doc created. Next: schema → seed → images → backend (Task 2) → storefront (Task 3) → admin pages (Task 4) → QA.

---
Task ID: 2
Agent: full-stack-developer (backend)
Task: Backend API routes for Style Sence

Work Log:
- Read worklog contract v1 + prisma/schema.prisma; confirmed seed state (5 categories, 14 products, 125 variants, 26 reviews, 48 orders, 3 posts, admin owner@stylesence.example) and seed's `salt:hash` scrypt format.
- Wrote `src/lib/api-helpers.ts`: ok/fail/parseJson/readValidated (zod → 400 `{error}` with human messages incl. "Missing required field: x"), SIZE_ORDER/sizeRank/orderSizes, round1, slugify, isNewProduct, plus shared admin shape mappers toAdminProduct / toAdminOrder / toAdminReview.
- Wrote `src/lib/auth.ts`: scrypt hashPassword/verifyPassword (timingSafeEqual), createAdminSession (token = uuid+uuid, 7-day expiry), getAdminFromCookies/requireAdmin (lazy expiry cleanup), adminCookieOptions, in-memory login rate limit (5 failures / email / 5 min → 429).
- Wrote `src/lib/validators.ts` (zod v4): reviewInput, checkoutInput, newsletterInput, cartAddInput/cartPatchInput, loginInput, orderPatchInput, reviewPatchInput, productInput, productPatchInput (compareAtPrice null clears; variantStocks [{id,stock}]; empty strings normalise to null/undefined).
- Wrote `src/lib/cart.ts`: ss_cart cookie (httpOnly, lax, 30d), getCartFromCookie / getOrCreateCart (upsert by cookieId), buildCartPayload (contract shape, items oldest-first, subtotal = Σ price×qty, itemCount = Σ qty), setCartCookie.
- Storefront routes: categories, products (category/q/size/color/minPrice/maxPrice/sort/page/perPage; facets from base scope = category+q only; card shape with primaryImage/colors/sizes/rating/reviewCount/isNew; featured→isFeatured desc,createdAt desc; rating→nulls last then reviewCount), products/[slug] (404 unknown/inactive; details split by \n; variants size-then-color; APPROVED reviews newest-first; related = 4 same-category fallback any, {slug,name,price,primaryImage}), products/[slug]/reviews POST (201, status PENDING), cart GET/POST/PATCH/DELETE (stock caps with "Only X left in stock", merge capped, qty 0 removes, ?itemId / ?clear=1), checkout POST (re-check stock, atomic decrement via updateMany where stock>=qty in $transaction, SS-2026-XXXX unique retry, shipping 3500/7500, PAID, item snapshots, clears cart, 201 {order:{orderNumber,total}}), orders/[orderNumber] GET, newsletter POST (upsert dedupe), journal + journal/[slug] (published only).
- Admin routes: login (rate limit + cookie), logout (deletes session row), me, stats (revenue total/last30, byStatus zero-filled, 30-day series oldest→newest UTC with CANCELLED excluded from revenue but counted in orders, recent 8 with itemCount, lowStock ≤3 limit 12, review counts + avgRating 1dp, subscribers, distinct customer emails), products GET/POST (auto-slug from name w/ random suffix on collision, SKUs `SS-XXXX-color-size` unique, images positioned, details string stored) + [id] PATCH (partial, variantStocks validated against product, slug-clash guard, compareAtPrice null clears) / DELETE (cascade), orders GET + [id] PATCH (enum-validated status), reviews GET (?status= validated) + [id] PATCH/DELETE, subscribers GET, customers GET (grouped by email, name = most recent, LTV = non-CANCELLED, sorted desc).
- Fixed one bug found during verification: nullableText patch fields rejected absent keys ("Missing required field: subtitle") — inner schema now `.nullable().optional()`. Also fixed AdminProductSource typing for tsc.
- Curl-verified EVERY endpoint group (see Stage Summary); read dev.log after failures — no stack traces, all clean. `bun run lint` → 0 errors in owned files (1 pre-existing warning in lead's scripts/generate-images.ts). `bunx tsc --noEmit` → clean for all owned files.

Stage Summary:
- 24 endpoints delivered under /api: categories, products (list/detail/reviews), cart (GET/POST/PATCH/DELETE), checkout, orders/[orderNumber], newsletter, journal (list/detail), admin login/logout/me/stats/products(+[id])/orders(+[id])/reviews(+[id])/subscribers/customers.
- Curl verification PASSED for: categories (5, productCount ok); products list w/ filters+sort+pagination+facets (base-scope facets confirmed via category & q probes, perPage clamp 48, unknown category → empty + null priceRange); silk-slip-dress detail (2 APPROVED reviews only, related exactly {slug,name,price,primaryImage}); review POST 201 + 400 validation paths; full cart flow with cookie jar (lazy create, add, stock error, merge capped at stock, oldest-first order, PATCH 1/0, DELETE itemId/clear, foreign item 404); checkout standard (₦296,000+₦3,500=₦299,500) and express (₦148,000+₦7,500=₦155,500), stock atomically decremented then restored, cart cleared, order GET by orderNumber; newsletter dedupe (lowercased); journal list + single; admin login (401 bad creds, 429 after 5 failures, cookie set), me, stats (49→50 orders, series 30 entries, series sums == revenue.last30), products list/create (auto slug `verification-test-cardigan`, SKUs `SS-SUIR-ivory-s`, variant ordering, 201)/PATCH (isActive toggle hides from storefront + 404s detail, compareAtPrice null clears, variantStocks updates + foreign-variant 400, slug clash 400)/DELETE (cascades, repeat 404); orders PATCH status → SHIPPED + invalid enum 400; reviews filter/PATCH APPROVED (storefront reviewCount 2→3, rating 4.5→4.7)/DELETE; subscribers; customers (LTV desc, test customer correct); logout invalidates session (me/stats → 401).
- Deviations from contract: none in response shapes. Two internal notes: (1) CartItem/OrderItem have no createdAt column, so "oldest first" uses cuid `id asc` (cuids are timestamp-prefixed → preserves insertion order); (2) admin product `reviewCount` counts ALL reviews (any status) since it's the moderation/management view — storefront reviewCount stays APPROVED-only per contract. admin product `details` is returned as the raw newline string (matches PATCH input format), split into an array only on the storefront detail endpoint per contract.
- Data note for later agents: verification left 2 extra PAID/SHIPPED orders (SS-2026-5335 by verify@example.com, SS-2026-5051 by express.test@example.com) and 1 extra subscriber (news.reader@example.com) — realistic dev data, all stock levels restored to seed values. Cart `POST /api/cart` returns 200 (contract specifies shape only, not status).

---
Task ID: 4
Agent: full-stack-developer (admin console)
Task: Admin console feature panels

Work Log:
- Read worklog contract + admin-app.tsx shell, globals.css tokens (eyebrow/scroll-elegant/border-line/espresso utilities, chart vars), money.ts, validators.ts (product PATCH semantics: compareAtPrice null clears, categoryId '' preprocesses to null, description required on POST) and curl-verified live API shapes (note: admin products use `stock` for the summed variant stock, not `stockSum`; orders include `notes`).
- Built `src/components/admin/dashboard.tsx`: 6 KPI hairline cards (Revenue 30d, Orders 30d from series sum, AOV, pending reviews, low-stock count, subscribers) with eyebrow labels + serif/mono values; recharts ComposedChart (Area = revenue w/ espresso gradient fill, Line = orders/day, dual Y axes, custom hairline tooltip, var(--chart-*) colors); orders-by-status horizontal micro-bars (olive DELIVERED, clay CANCELLED); recent orders table with clickable rows (window.location.hash → orders tab); low-stock radar (≤3 espresso) + reviews summary card with quick links.
- Built `src/components/admin/products-manager.tsx`: catalogue table (thumb, name+category+slug, price/compareAt mono, stock sum espresso ≤5, review count, Active/Featured Switches with optimistic PATCH + rollback + toasts, edit/delete actions, sticky header, max-h scroll-elegant); search + category client filters w/ "X of Y" meta; New piece Dialog (all fields, images textarea one-URL-per-line, repeatable variant editor defaulting XS–XL × Ivory #EDE7DC stock 10, add/remove rows); Edit Dialog prefilled + per-variant stock via `variantStocks` (dialog remounts via key on open — no setState-in-effect); delete AlertDialog (cascade warning) + create/edit/delete mutations invalidating admin/products/stats/categories/shop/product/home keys.
- Built `src/components/admin/orders-manager.tsx`: search (number/email/name) + status Select filters; table with mono order numbers, stacked customer, items summary, totals; inline status Select per row (optimistic PATCH, CANCELLED destructive styling, DELIVERED olive) + toast; View Dialog (derived live from cache) showing full item rows (image, product link, colour/size/qty/unit, line totals), customer + shipping address blocks, shipping method/fee, notes, subtotal/shipping/total dl.
- Built `src/components/admin/reviews-manager.tsx`: Tabs (Pending/Approved/Rejected/All) with live counts; editorial cards (espresso stars, serif titles, author/date, product link); Approve/Reject on PENDING + Delete (AlertDialog) for all; invalidates reviews/stats/products/product/shop.
- Built `src/components/admin/subscribers-manager.tsx`: count header, hairline table (email mailto, source chip, joined date), client-side data:text/csv export (escaped cells, dated filename) + DevPlaceholder "ESP sync pending".
- Built `src/components/admin/customers-manager.tsx`: total header, top-3-clients strip (rank serif, LTV mono, relative bar), LTV-ranked table (name+email, orders, lifetime value espresso ≥₦500k, last order) + DevPlaceholder "derived from orders (dev data)".
- `bun run lint` → 0 errors/warnings in the six files (removed unused eslint-disable directives); `bunx tsc --noEmit` → clean for admin files (remaining errors are pre-existing in examples//scripts//skills/ of other owners).
- Browser-verified with agent-browser (login → each tab): dashboard KPIs/chart/bars/table render (VLM visual check — no blue/indigo, no overlap, mobile 390px stacks cleanly); products — toggled Leather Mini Tote Active off→on (switch + API consistent, reverted), edited Charcoal variant stock 0→3→0 (reverted), created "Verification Test Scarf" then deleted via AlertDialog (count 14→15→14); orders — SS-2026-5051 PAID→SHIPPED→PAID (reverted), view dialog contents verified; reviews — approved "Worth the wait" (Temi O.) → Pending 4→3, Approved 22→23, appears under Approved (kept — harmless); subscribers — CSV exported (435 bytes, correct rows); customers + top-clients strip render. agent-browser errors/console clean; dev.log clean.

Stage Summary:
- All six admin panels delivered as 'use client' components inside the existing shell: Dashboard (KPIs + 30-day revenue/orders chart + status distribution + recent orders + low-stock + review summary), ProductsManager (filters, optimistic toggles, full create/edit dialogs incl. variant editor + delete), OrdersManager (filters, inline status editing, detail dialog), ReviewsManager (tabbed moderation queue), SubscribersManager (roster + CSV export), CustomersManager (LTV ranking + top clients).
- Query keys: ['admin','stats'|'products'|'orders'|'reviews'|'subscribers'|'customers'] + shared ['categories']; mutations invalidate admin + affected storefront keys. Money/dates via formatNaira/formatDate/formatDateShort; no blue/indigo; hairline borders, eyebrow labels, mono/serif numerals; all interactive elements labelled, th scope="col", skeleton + error+retry states, no setState-in-effect (keyed dialog remount pattern).
- Verification: all mutations exercised end-to-end in-browser and reverted to seed values except one intentionally approved review (Pending 4→3 / Approved 22→23). Known pragmatic limits, labelled in-UI: images editable only at creation (PATCH has no images field); variant size/colour fixed after creation (PATCH only takes variantStocks); customers/subscribers derived data flagged via DevPlaceholder.

---
Task ID: 3
Agent: lead (Z.ai Code)
Task: Design system, SPA shell, storefront frontend

Work Log:
- globals.css: full ivory/charcoal token system (light + charcoal dark mode), Fraunces/Geist fonts, editorial utilities (.eyebrow, .link-underline, .container-site, .scroll-elegant, marquee + ken-burns keyframes), global prefers-reduced-motion overrides.
- layout.tsx: Fraunces display font + brand metadata + sonner Toaster; favicon.svg added.
- lib: types.ts (API contract mirror), money.ts (₦ formatting), router.tsx (hash router w/ Link/navigate/useRoute), store/wishlist.ts (zustand persist + ui store), cart-client.ts (TanStack Query cart hooks).
- site components: announcement bar (marquee), header (sticky, search overlay, cart/wishlist badges, mobile Sheet nav, theme toggle, category menubar), footer (newsletter, link columns, payment marks, dev placeholders, safe-area bottom), cart Sheet, product card (hover zoom, wishlist heart, color dots, New/Archive tags), Reveal (reduced-motion aware), DevPlaceholder, Price, ProductImage (tonal fallback while images stream), RatingStars, QuantityStepper.
- pages: Home (hero ken-burns, new arrivals, categories, editorial split, bestsellers, inverted atelier band, journal teaser), Shop (URL-driven filters: category/size/color/price/sort/q, facets, chips, load-more via useQueries accumulation, mobile filter Sheet, empty state), PDP (gallery + thumbs, variant selection w/ sold-out states, stock notes, accordions, size guide dialog, reviews w/ distribution bars + write-review dialog, related), Cart (free-shipping progress, qty steppers), Checkout (validated form, NG states, shipping radios, payment dev placeholder, order summary), Order confirmation (status timeline, items, totals), Wishlist (persisted), Journal list + post (## headings), About (values grid, quote band), 404.
- admin-app.tsx: login (dev credentials hint), shell w/ hash-synced tabs, logout; 6 manager stubs for Task 4.
- Generated 25 editorial images (14 products + 3 details + hero + 3 looks + atelier + 3 journal covers) via z-ai SDK script; all succeeded.
- Fixed React Compiler lint violations (set-state-in-effect) with useSyncExternalStore useMounted hook, keyed ProductInner, hashchange listeners, page-in-URL pagination.

Stage Summary:
- Full storefront + admin shell live on / (hash-routed SPA). lint clean. All 25 images in public/images. Task 2 (backend) + Task 4 (admin panels) completed by subagents and verified. Next: lead end-to-end QA with agent-browser.

---
Task ID: 5
Agent: lead (Z.ai Code)
Task: End-to-end QA with agent-browser + fixes

Work Log:
- Verified with agent-browser (desktop 1440x900 + mobile 390x844): home (VLM-confirmed polished), shop filters/sort/search/URL-state, mobile filter drawer + nav sheet, PDP variant selection → add to bag → cart Sheet, checkout → order placement (2 real orders: SS-2026-4939, SS-2026-7966) → confirmation page w/ correct totals (₦148,000 + ₦3,500 = ₦151,500), wishlist toggle + page, journal list/post, dark mode (VLM: "flawless luxury dark aesthetic"), theme toggle persistence, admin login + dashboard (VLM-confirmed), sticky footer structurally guaranteed (min-h-screen flex + mt-auto).
- FIXED BUG: cart badge showed stale count after checkout — added `qc.invalidateQueries({queryKey:['cart']})` on checkout success in checkout.tsx; re-verified with a second order (badge → "Shopping bag (0 items)").
- Confirmed zero console/page errors (agent-browser errors/console), zero 500s in dev.log, `bun run lint` fully clean.
- Reduced motion: global CSS `@media (prefers-reduced-motion: reduce)` kills marquee/ken-burns/transitions; framer-motion gated via useReducedMotion in Reveal/PageFade.
- Full-page screenshot artifacts (lazy images + whileInView) investigated and confirmed NOT user-facing (cards in DOM at opacity 1 after scroll).

Stage Summary:
- Site is end-to-end functional and polished: storefront + admin console + 25 AI-generated editorial images. All golden paths pass. Remaining polish opportunities for next phase listed below.

## Unresolved issues / risks & next-phase priorities

1. **SEO/meta per route** — SPA hash routing means one <title> updated client-side (done via useEffect); meta description is static. Low priority for a dev preview.
2. **Real payment integration** — Paystack/Flutterwave (currently clearly-labelled dev placeholder by design).
3. **Promo/coupon engine** — cart page shows dev placeholder; could implement admin-managed codes.
4. **Email sending** — newsletter + order confirmations simulated (dev placeholder).
5. **Product image upload in admin** — products form takes image URLs only; a file-upload pipeline (z-ai image-generation or blob storage) would be a nice next phase.
6. **Customer accounts** (NextAuth) — currently guest checkout only; wishlist is localStorage.
7. **Inventory reservations** — stock decrements only at checkout; concurrent buyers can race (transaction guards exist but no reservation TTL).
8. **Related products** — currently same-category fallback; could add curated "Complete the look" relations in admin.
9. **Performance** — product images un-optimized <img> (no next/image due to hash SPA + static files); fine at current catalog size, consider sharp pipeline later.
10. **Testing** — no automated tests (per instructions); QA is agent-browser driven and should be repeated after major changes.
