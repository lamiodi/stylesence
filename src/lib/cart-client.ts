'use client'

/** Client-side cart hooks over the /api/cart endpoints. */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { CartState, CustomMeasurements } from '@/lib/types'
import { useUi } from '@/lib/store/wishlist'

/** Round 13 made-to-order add payload — custom measurements + tailoring notes ride along. */
export type AddToCartInput = {
  variantId: string
  qty: number
  sizeMode?: 'standard' | 'custom'
  customMeasurements?: CustomMeasurements
  notes?: string
}

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Something went wrong')
  return data as T
}

export function useCart() {
  return useQuery<CartState>({
    queryKey: ['cart'],
    queryFn: () => jsonFetch<{ cart: CartState }>('/api/cart').then((r) => r.cart),
    staleTime: 30_000,
  })
}

export function useAddToCart() {
  const qc = useQueryClient()
  const setCartOpen = useUi((s) => s.setCartOpen)
  return useMutation({
    mutationFn: (input: AddToCartInput) =>
      jsonFetch<{ cart: CartState }>('/api/cart', {
        method: 'POST',
        body: JSON.stringify(input),
      }).then((r) => r.cart),
    onSuccess: (cart) => {
      qc.setQueryData(['cart'], cart)
      setCartOpen(true)
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

/**
 * "Add the look to bag" — adds several pieces (qty 1 each) sequentially so the
 * server-side cart merge can't race itself. Pieces carry their names so a
 * mid-flow failure (e.g. a size just sold out) can be reported per piece;
 * failures never abort the rest of the look.
 */
export function useAddLookToCart() {
  const qc = useQueryClient()
  const setCartOpen = useUi((s) => s.setCartOpen)
  return useMutation({
    mutationFn: async (pieces: Array<{ variantId: string; name: string }>) => {
      let cart: CartState | null = null
      const failed: string[] = []
      for (const piece of pieces) {
        try {
          const res = await jsonFetch<{ cart: CartState }>('/api/cart', {
            method: 'POST',
            body: JSON.stringify({ variantId: piece.variantId, qty: 1 }),
          })
          cart = res.cart
        } catch {
          failed.push(piece.name)
        }
      }
      if (!cart) throw new Error('None of the look\u2019s pieces could be added \u2014 they may have just sold out.')
      return { cart, failed }
    },
    onSuccess: ({ cart, failed }, pieces) => {
      qc.setQueryData(['cart'], cart)
      setCartOpen(true)
      if (failed.length === 0) {
        toast.success(`The look is in your bag \u2014 ${pieces.length} piece${pieces.length === 1 ? '' : 's'}.`)
      } else {
        toast(
          `Added ${pieces.length - failed.length} of ${pieces.length} pieces \u2014 ${failed.join(', ')} ${failed.length === 1 ? 'was' : 'were'} unavailable.`,
        )
      }
    },
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useUpdateCartItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { itemId: string; qty: number }) =>
      jsonFetch<{ cart: CartState }>('/api/cart', {
        method: 'PATCH',
        body: JSON.stringify(input),
      }).then((r) => r.cart),
    onSuccess: (cart) => qc.setQueryData(['cart'], cart),
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useRemoveCartItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (itemId: string) =>
      jsonFetch<{ cart: CartState }>(`/api/cart?itemId=${encodeURIComponent(itemId)}`, {
        method: 'DELETE',
      }).then((r) => r.cart),
    onSuccess: (cart) => qc.setQueryData(['cart'], cart),
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useClearCart() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      jsonFetch<{ cart: CartState }>('/api/cart?clear=1', { method: 'DELETE' }).then((r) => r.cart),
    onSuccess: (cart) => qc.setQueryData(['cart'], cart),
    onError: (e: Error) => toast.error(e.message),
  })
}
