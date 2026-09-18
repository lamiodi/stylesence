'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** ——— Wishlist (localStorage persisted; mirrored to the account when signed in) ——— */
export interface WishItem {
  slug: string
  name: string
  price: number
  primaryImage: string | null
  secondaryImage?: string | null
  addedAt: number
}

/** Item shape accepted by `toggle`/`setItems` (e.g. a server-hydrated wishlist). */
export type WishItemInput = Omit<WishItem, 'addedAt'> & { addedAt?: number }

interface WishlistState {
  items: WishItem[]
  has: (slug: string) => boolean
  toggle: (item: WishItemInput) => boolean
  remove: (slug: string) => void
  clear: () => void
  /** Replace the whole set (account sync) — preserves `addedAt` for slugs already present. */
  setItems: (items: WishItemInput[]) => void
}

export const useWishlist = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],
      has: (slug) => get().items.some((i) => i.slug === slug),
      toggle: (item) => {
        const exists = get().items.some((i) => i.slug === item.slug)
        set({
          items: exists
            ? get().items.filter((i) => i.slug !== item.slug)
            : [{ ...item, addedAt: item.addedAt ?? Date.now() }, ...get().items],
        })
        return !exists
      },
      remove: (slug) => set({ items: get().items.filter((i) => i.slug !== slug) }),
      clear: () => set({ items: [] }),
      setItems: (items) =>
        set({
          items: items.map((item) => {
            const prev = get().items.find((i) => i.slug === item.slug)
            return { secondaryImage: null, ...item, addedAt: item.addedAt ?? prev?.addedAt ?? Date.now() }
          }),
        }),
    }),
    {
      name: 'ss-wishlist',
      partialize: (s) => ({ items: s.items }),
    },
  ),
)

/** ——— UI state (cart sheet) ——— */
interface UiState {
  cartOpen: boolean
  setCartOpen: (open: boolean) => void
}

export const useUi = create<UiState>()((set) => ({
  cartOpen: false,
  setCartOpen: (open) => set({ cartOpen: open }),
}))
