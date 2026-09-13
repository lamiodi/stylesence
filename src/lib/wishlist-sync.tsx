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
 *    debounced (800ms) full-list PUT. Fire-and-forget: failures log to the
 *    console only (no toast spam), and the local store is never rolled back.
 *  - On sign-out the local set is left as-is (it is already synced).
 */

import { useEffect, useRef } from 'react'
import { useCustomer } from '@/hooks/use-customer'
import { useWishlist } from '@/lib/store/wishlist'
import type { WishlistItemView } from '@/lib/types'

const SYNC_DEBOUNCE_MS = 800

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
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  /* ——— while signed in: mirror local changes (debounced, fire-and-forget) ——— */
  useEffect(() => {
    const unsub = useWishlist.subscribe((state, prev) => {
      if (state.items === prev.items) return
      if (!signedInRef.current) return
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        void (async () => {
          const slugs = useWishlist.getState().items.map((i) => i.slug)
          if (arraysEqual(slugs, lastSyncedRef.current)) return
          try {
            const res = await fetch('/api/customer/wishlist', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ slugs }),
            })
            if (res.ok) {
              lastSyncedRef.current = slugs
            } else {
              console.warn('[wishlist-sync] mirror failed', res.status)
            }
          } catch (e) {
            console.warn('[wishlist-sync] mirror failed', e)
          }
        })()
      }, SYNC_DEBOUNCE_MS)
    })
    return () => {
      unsub()
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])
}

/** Mounted once in the SPA shell; renders nothing. */
export function WishlistSync() {
  useWishlistSync()
  return null
}
