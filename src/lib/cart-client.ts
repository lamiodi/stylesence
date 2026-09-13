'use client'

/** Client-side cart hooks over the /api/cart endpoints. */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { CartState } from '@/lib/types'
import { useUi } from '@/lib/store/wishlist'

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
    mutationFn: (input: { variantId: string; qty: number }) =>
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
