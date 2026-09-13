'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { PROMO_STACK_MAX } from '@/lib/promo'

/** ——— Promo state (localStorage persisted, codes only; server validates authoritatively) ———
 * Round 12: up to two codes — one money-saving + one shipping, both stackable. */
interface PromoState {
  codes: string[]
  /** Replace the whole stack (cap enforced). */
  setCodes: (codes: string[]) => void
  /** Add one code if there is room. */
  addCode: (code: string) => void
  removeCode: (code: string) => void
  clear: () => void
}

export const usePromoStore = create<PromoState>()(
  persist(
    (set, get) => ({
      codes: [],
      setCodes: (codes) => set({ codes: codes.slice(0, PROMO_STACK_MAX) }),
      addCode: (code) => {
        if (get().codes.includes(code)) return
        if (get().codes.length >= PROMO_STACK_MAX) return
        set({ codes: [...get().codes, code] })
      },
      removeCode: (code) => set({ codes: get().codes.filter((c) => c !== code) }),
      clear: () => set({ codes: [] }),
    }),
    {
      name: 'ss-promo',
      version: 2,
      partialize: (s) => ({ codes: s.codes }),
      // v1 persisted { code: string | null } → v2 { codes: string[] }.
      migrate: (persisted, version) => {
        if (version < 2) {
          const p = persisted as { code?: string | null } | null | undefined
          const code = p && typeof p === 'object' && 'code' in p ? p.code : null
          return { codes: code ? [code] : [] }
        }
        return persisted as { codes: string[] }
      },
    },
  ),
)
