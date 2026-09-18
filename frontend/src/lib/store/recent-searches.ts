'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * ——— Recent searches (localStorage persisted) ———
 * Max 6 terms, most-recent first, deduped case-insensitively. Powers the
 * "Recent" chip row in the header search drawer. Hydration-safe: the drawer
 * gates the row behind useMounted() (identical pattern to the wishlist and
 * recently-viewed stores).
 */
interface RecentSearchesState {
  terms: string[]
  record: (term: string) => void
  clear: () => void
}

const MAX_TERMS = 6

export const useRecentSearches = create<RecentSearchesState>()(
  persist(
    (set, get) => ({
      terms: [],
      record: (term) => {
        const cleaned = term.trim()
        if (!cleaned) return
        set({
          terms: [
            cleaned,
            ...get().terms.filter((t) => t.toLowerCase() !== cleaned.toLowerCase()),
          ].slice(0, MAX_TERMS),
        })
      },
      clear: () => set({ terms: [] }),
    }),
    {
      name: 'ss-recent-searches',
      partialize: (s) => ({ terms: s.terms }),
    },
  ),
)
