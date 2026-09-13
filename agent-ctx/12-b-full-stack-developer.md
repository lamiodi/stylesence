# Task 12-b — full-stack-developer (wishlist reliability)

## Task
Make the wishlist account mirror reliable (worklog unresolved-issue #3): retry with backoff, refocus/online reconciliation, correct lastSyncedRef staleness semantics, leak-free listeners. Hard constraint: ONLY `src/lib/wishlist-sync.tsx`.

## What changed (wishlist-sync.tsx only)
- Mirror effect rewritten around a single-flight run loop:
  - `runMirror()` — re-reads slugs before EVERY attempt; PUT; success → `lastSyncedRef = slugs` + exit; failure → `console.warn` + backoff (`MIRROR_BACKOFF_MS = [2_000, 8_000]`); max `MIRROR_MAX_ATTEMPTS = 3` total, then exits leaving `lastSyncedRef` stale.
  - `requestMirror()` funnel — requests arriving mid-run set `rerunRequested`; the run's `finally` exit re-check gives them a turn (equality check makes it a no-op once converged → cannot self-loop; idle stale divergence never self-retries).
  - `reconcileNow()` on `visibilitychange` (visible only) + `online` (window) — signed-in AND local ≠ lastSyncedRef → immediate PUT, bypassing/superseding the 800ms debounce timer.
  - Cleanup: unsub + clear timer + remove both listeners + `unmounted` flag (stops retries and exit re-checks). `timerRef` useRef → effect-local `timer`.
  - Loop-top guard `unmounted || !signedInRef.current` stops retries on unmount/sign-out mid-run.
- Sign-in merge effect, `arraysEqual`, `applyMergedItems`, constants naming, comment style: untouched/preserved. `lastSyncedRef` still advances only on success. No rollback, no toasts, no UI changes, no new deps, no API changes.

## QA evidence
- `bunx tsc --noEmit`: 0 errors in src/ (only pre-existing examples/scripts/skills, other owners). `bun run lint`: 0 findings.
- Browser (session r12b): registered qa.wishlist@stylesence.example → add → debounced PUT 200 → DB row confirmed.
  - Retry cycle 1 (route-abort on the PUT): remove → exactly 3 warns, real CDP timestamps Δ 2102ms / 7998ms; DB stayed stale, local `[]` (no rollback); unroute + offline on/off (real `online` event) → reconcile PUT 200 → DB `[]`.
  - Retry cycle 2: re-add under abort → 3 more warns (6 total), Δ 2000ms / 8001ms; unroute + tab new → tab back (real `visibilitychange`) → reconcile PUT 200 → DB `["silk-slip-dress"]`.
  - Sign out → sign in → login + merge 200 → "Wishlist (1 saved)" persisted (merge flow unbroken; refresh-with-session merge also 200).
  - `agent-browser errors`: zero across all visited pages.
- Cleanup: session closed; bun script deleted Customer + 1 CustomerSession + 1 WishlistItem → customers = 0. dev.log clean; dev server left healthy.

## Flags
- Pre-existing PDP quirk (other agents own PDP this round): heart aria-label/aria-pressed doesn't live-update (product-detail.tsx selects stable functions from the store); action is correct, visual-only staleness on remount.
- 400-class deterministic failures are retried like network errors (per spec's plain "failed PUT retries"); refocus reconcile re-spends attempts if divergence persists.
- Two transient sandbox fork crunches (Errno 11) during QA — retried fine, no code impact.
