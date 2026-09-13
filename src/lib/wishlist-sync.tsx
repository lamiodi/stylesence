'use client'

/**
 * Wishlist account sync — localStorage ↔ signed-in account.
 *
 * The zustand store stays the single source of truth for the UI; this module
 * (mounted once, via <WishlistSync /> in page.tsx) keeps the server in step:
 *
 *  - On sign-in detection (the customer query transitions to a customer, which
 *    also covers a page refresh with a live session) it POSTs the local slugs
 *    to /api/customer/wishlist/merge — the server unions them with the account's
 *    set — and adopts the hydrated payload as the new local truth.
 *  - While signed in, local wishlist changes mirror to the server via a
 *    debounced (800ms) full-list PUT. A failed PUT is retried up to 3
 *    attempts total with backoff (2s, 8s). If every attempt fails,
 *    lastSyncedRef deliberately stays stale, so the next local change, the
 *    tab becoming visible again (visibilitychange) or the network returning
 *    (online) re-attempts the mirror immediately — bypassing the debounce.
 *    Failures log to the console only (no toast spam), and the local store
 *    is never rolled back: the mirror catches up, the UI never waits.
 *  - On sign-out the local set is left as-is (it is already synced).
 */

import { useEffect, useRef } from 'react'
import { useCustomer } from '@/hooks/use-customer'
import { useWishlist } from '@/lib/store/wishlist'
import type { WishlistItemView } from '@/lib/types'

const SYNC_DEBOUNCE_MS = 800
/** Mirror retries: 3 attempts total, backing off 2s after the first failure, 8s after the second. */
const MIRROR_MAX_ATTEMPTS = 3
const MIRROR_BACKOFF_MS = [2_000, 8_000]

/** Backoff sleep for the mirror retry loop. */
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

function arraysEqual(a: readonly string[], b: readonly string[] | null): boolean {
  if (b === null || a.length !== b.length) return false
  return a.every((v, i) => v === b[i])
}

/** Adopt the merged server payload — server order first, then anything added
 *  locally while the merge request was in flight (their turn to mirror back). */
function applyMergedItems(serverItems: WishlistItemView[]) {
  const store = useWishlist.getState()
  const serverSlugs = new Set(serverItems.map((i) => i.slug))
  const extras = store.items.filter((i) => !serverSlugs.has(i.slug))
  store.setItems([...serverItems, ...extras])
}

function useWishlistSync(): void {
  const { data: customer } = useCustomer()
  const customerId = customer?.id ?? null

  const signedInRef = useRef<string | null>(null)
  const lastSyncedRef = useRef<string[] | null>(null)

  /* ——— sign-in detection → merge ——— */
  useEffect(() => {
    const previous = signedInRef.current
    signedInRef.current = customerId

    if (!customerId) {
      // Signed out: the local set is already synced — leave the store untouched.
      lastSyncedRef.current = null
      return
    }
    if (previous === customerId) return

    const requestCustomer = customerId
    void (async () => {
      try {
        const slugs = useWishlist.getState().items.map((i) => i.slug)
        const res = await fetch('/api/customer/wishlist/merge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slugs }),
        })
        if (!res.ok) {
          console.warn('[wishlist-sync] merge failed', res.status)
          return
        }
        const data = (await res.json()) as { items: WishlistItemView[] }
        // Stale only if the signed-in customer changed while the request was in flight.
        if (signedInRef.current !== requestCustomer) return
        lastSyncedRef.current = data.items.map((i) => i.slug)
        applyMergedItems(data.items)
      } catch (e) {
        console.warn('[wishlist-sync] merge failed', e)
      }
    })()
  }, [customerId])

  /* ——— while signed in: mirror local changes (debounced → retried with backoff,
     reconciled immediately on tab refocus / network return) ——— */
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    let running = false // a mirror run is in flight
    let rerunRequested = false // a request arrived mid-run — re-checked when it ends
    let unmounted = false // stops retries and exit re-checks after unmount

    /** One mirror run: PUT the current slugs, retrying with backoff on failure.
     *  The store is re-read before every attempt, so local changes made during
     *  a retry cycle are carried by the next attempt. lastSyncedRef only
     *  advances on a success — a fully-failed run leaves it stale for the next
     *  trigger (local change, refocus, back online) to pick up. */
    const runMirror = async (): Promise<void> => {
      running = true
      try {
        for (let attempt = 1; ; attempt++) {
          if (unmounted || !signedInRef.current) return
          const slugs = useWishlist.getState().items.map((i) => i.slug)
          if (arraysEqual(slugs, lastSyncedRef.current)) return // already in step
          try {
            const res = await fetch('/api/customer/wishlist', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ slugs }),
            })
            if (res.ok) {
              lastSyncedRef.current = slugs
              return
            }
            console.warn('[wishlist-sync] mirror failed', res.status)
          } catch (e) {
            console.warn('[wishlist-sync] mirror failed', e)
          }
          if (attempt >= MIRROR_MAX_ATTEMPTS) return
          await sleep(MIRROR_BACKOFF_MS[attempt - 1])
        }
      } finally {
        running = false
        // A request that arrived while this run was active takes its turn now —
        // the run's own divergence check makes it a no-op once converged, so
        // this can never loop by itself.
        if (!unmounted && rerunRequested) {
          rerunRequested = false
          void runMirror()
        }
      }
    }

    /** Request a mirror run. While one is active, fold the request into its
     *  exit re-check instead of starting a second concurrent PUT. */
    const requestMirror = () => {
      if (running) {
        rerunRequested = true
        return
      }
      void runMirror()
    }

    /* Local change while signed in → mirror (debounced). */
    const unsub = useWishlist.subscribe((state, prev) => {
      if (state.items === prev.items) return
      if (!signedInRef.current) return
      if (timer) clearTimeout(timer)
      timer = setTimeout(requestMirror, SYNC_DEBOUNCE_MS)
    })

    /* Tab visible again / network regained while signed in AND diverged →
       mirror immediately (bypasses the debounce; a pending debounce timer is
       superseded by this attempt). */
    const reconcileNow = () => {
      if (!signedInRef.current) return
      const slugs = useWishlist.getState().items.map((i) => i.slug)
      if (arraysEqual(slugs, lastSyncedRef.current)) return
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      requestMirror()
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') reconcileNow()
    }
    const onOnline = () => reconcileNow()

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('online', onOnline)

    return () => {
      unmounted = true
      unsub()
      if (timer) clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('online', onOnline)
    }
  }, [])
}

/** Mounted once in the SPA shell; renders nothing. */
export function WishlistSync() {
  useWishlistSync()
  return null
}
