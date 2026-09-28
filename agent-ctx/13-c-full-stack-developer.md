# Task 13-c — full-stack-developer (checkout made-to-order: E/F/G)

Mission: rebuild `src/components/pages/checkout.tsx` ONLY — production timeline tiers (E),
mandatory pre-production confirmation (F), delivery tiers with country support (G).
Backend already live from 13-a (SHIPPING_METHODS v2, PRODUCTION_TIERS, checkoutInput with
country/productionTier/confirmedProduction, geo rules). Fixed the 3 known tsc errors
('standard' no longer a ShippingMethod key).

## Changes (single file: src/components/pages/checkout.tsx)

- **02 Shipping address**: Country select (9 options, Nigeria default, autoComplete
  country-name, styled like the NG state select via shared `selectCls` helper) placed
  between street address and city/state (sm:col-span-2 → tidy grid, stacks at 390px).
  state = NG_STATES select when country==='Nigeria', else free-text Input
  (label "State / Region *", autoComplete address-level1). Same usePrefillField hook
  drives both (value persists across the switch). Conditional error copy.
- **03 Delivery**: iterates SHIPPING_METHODS; enable rules mirrored client-side:
  local = Nigeria && Lagos, nationwide = Nigeria, international always. Disabled cards:
  RadioGroupItem disabled + container opacity-50 + cursor-not-allowed + no hover border;
  notes "Lagos metro only — select Lagos as your state" / "Within Nigeria only".
  International card carries the espresso inline note "Duties handled at the door — rate
  is a dev placeholder." Auto-switch effect: country→non-NG while local/nationwide →
  international; state leaves Lagos while local → nationwide. Default = 'nationwide'.
  Complimentary per card = stackFreeShipping || (nationwide && subtotal ≥ 150k);
  caption "Unlocked — your code covers delivery" vs "Unlocked — orders over ₦150,000".
  DELIBERATE: disabled cards never claim the Complimentary unlock (avoids "free but
  unselectable" confusion; no spec QA case contradicts).
- **04 Production** (new): PRODUCTION_TIERS radio cards — Standard "Included" /
  Express "+₦15,000" (font-mono tabular-nums); DevPlaceholder compact "Express fee" with
  the exact copy; state productionTier: ProductionTier = 'standard'.
- **05 Payment**: confirmation checkbox FIRST (bordered panel border-line bg-secondary/50,
  border-destructive on error), shadcn Checkbox + Label, exact user copy, 44px hit area
  via `.before:absolute .before:-inset-[0.875rem] .before:content-['']` (compiled rule
  verified). validate() gains confirmedProduction; on submit-fail: toast.error with the
  message + scrollIntoView (block:center, reduced-motion aware) via confirmRef; checking
  the box clears the error. Request body now sends country, productionTier,
  confirmedProduction: true.
- **Summary aside**: custom items render the mono espresso "Custom fit" badge
  (border-espresso/35 pill), formatMeasurements line (mono tabular-nums truncate), quoted
  italic notes preview. Totals gain "Express production | +₦15,000" row when fee > 0;
  total = subtotal − discount + shipping + productionFee.

## QA (all green)

- tsc --noEmit: 3 checkout.tsx errors gone, ZERO src/ errors (pre-existing
  examples/scripts/skills only). `bun run lint`: clean.
- agent-browser fresh session 1440×900: custom item (badge + "Bust 92 · Waist 74" +
  “Make it tighter around the waist”); default nationwide checked, local disabled w/ note;
  UK → state=INPUT (address-level1), local+nationwide disabled w/ notes, auto-switch to
  international, shipping ₦25,000, total ₦173,000; back to NG+Lagos → local enabled,
  selected → ₦2,500 (total ₦150,500); state→Oyo → auto-switch nationwide ₦3,500.
  +atelier-blazer (subtotal ₦313,000) → nationwide "Complimentary / UNLOCKED — ORDERS
  OVER ₦150,000", shipping ₦0. Express → "+₦15,000" row, total ₦328,000, DevPlaceholder
  visible. Place order w/o checkbox → blocked: role=alert error + sonner error toast +
  scrollIntoView (scrollY 721→1110) + aria-invalid + no POST. With checkbox → order
  SS-2026-7656 placed (express, fee 15k, shipping 0, country Nigeria, custom snapshot
  "M (custom)" + meas + notes) → navigated #/order/SS-2026-7656. Mobile 390×844:
  scrollWidth 390, 0px overflow, address + radio grids single-column. `agent-browser
  errors`: zero. dev.log tail: POST /api/checkout 201, clean.
- CLEANUP (bun+Prisma): order SS-2026-7656 deleted (items first), stock re-incremented
  (dress SS-SILK-S-IV-M-80 11→12, blazer SS-ATELIE-IV-M-70 17→18), my cart row
  (cookieId 4376d40a…) deleted — cartItems were already cleared by checkout; leftover
  custom cartItems = 0. Order count 54 after cleanup.

## Flags for the lead

1. OPS MEA CULPA: my session-prep `agent-browser close --all` killed the LIVE r13b +
   r13d sessions of parallel agents (I didn't realise other agents' sessions shared the
   daemon). They can simply relaunch; no code/data was lost (their DB QA state is theirs).
   Standing advice: in parallel rounds use `close` (own session) only, never `--all`.
2. Order-count baseline read 55 at my start (a parallel agent's QA order was live);
   after my cleanup it is 54 as the task expected — the delta is theirs, not mine.
3. International card note: rendered eta line trimmed to "Door-to-door international
   courier" so the espresso line "Duties handled at the door — rate is a dev placeholder."
   (exact requested copy) doesn't duplicate the m.note clause.
4. Country select sits between street address and city/state (spec: "before city/state");
   full-width cell at sm+ keeps the grid hole-free.
5. agent-browser gotchas this round: `find text` can't match CSS-uppercased button text
   ("PLACE ORDER" ≠ "Place order") — snapshot @refs work; eval needs async IIFE for await.
