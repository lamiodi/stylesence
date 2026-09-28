'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * ——— Recently viewed (localStorage persisted) ———
 * Max 8 pieces, most-recent first, deduped by slug.
 * Hydration-safe: components gate rendering behind useMounted()
 * (identical pattern to the wishlist store).
 */
export interface RecentItem {
  slug: string
  name: string
  price: number
  primaryImage: string | null
  secondaryImage?: string | null
  viewedAt: number
}

interface RecentlyViewedState {
  items: RecentItem[]
  push: (item: Omit<RecentItem, 'viewedAt'>) => void
  clear: () => void
}

const MAX_ITEMS = 8

export const useRecentlyViewed = create<RecentlyViewedState>()(
  persist(
    (set, get) => ({
      items: [],
      push: (item) => {
        set({
          items: [
            { ...item, viewedAt: Date.now() },
            ...get().items.filter((i) => i.slug !== item.slug),
          ].slice(0, MAX_ITEMS),
        })
      },
      clear: () => set({ items: [] }),
    }),
    {
      name: 'ss-recently-viewed',
      partialize: (s) => ({ items: s.items }),
    },
  ),
)
