'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** ——— Wishlist (localStorage persisted) ——— */
export interface WishItem {
  slug: string
  name: string
  price: number
  primaryImage: string | null
  addedAt: number
}

interface WishlistState {
  items: WishItem[]
  has: (slug: string) => boolean
  toggle: (item: WishItem) => boolean
  remove: (slug: string) => void
  clear: () => void
}

export const useWishlist = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],
      has: (slug) => get().items.some((i) => i.slug === slug),
      toggle: (item) => {
        const exists = get().items.some((i) => i.slug === item.slug)
        set({
          items: exists ? get().items.filter((i) => i.slug !== item.slug) : [item, ...get().items],
        })
        return !exists
      },
      remove: (slug) => set({ items: get().items.filter((i) => i.slug !== slug) }),
      clear: () => set({ items: [] }),
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
