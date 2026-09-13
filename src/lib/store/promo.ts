'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** ——— Promo state (localStorage persisted, code only; server validates authoritatively) ——— */
interface PromoState {
  code: string | null
  setCode: (code: string | null) => void
  clear: () => void
}

export const usePromoStore = create<PromoState>()(
  persist(
    (set) => ({
      code: null,
      setCode: (code) => set({ code }),
      clear: () => set({ code: null }),
    }),
    { name: 'ss-promo' },
  ),
)
