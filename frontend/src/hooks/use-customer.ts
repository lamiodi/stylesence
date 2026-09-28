'use client'

/** Client-side hooks over the /api/customer endpoints (cookie session). */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { CustomerView } from '@/lib/types'

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Something went wrong')
  return data as T
}

/** Signed-in customer (null when signed out). One shared query key for the whole SPA. */
export function useCustomer() {
  return useQuery<CustomerView | null>({
    queryKey: ['customer-me'],
    queryFn: () => jsonFetch<{ customer: CustomerView | null }>('/api/customer/me').then((r) => r.customer),
    staleTime: 5 * 60_000,
  })
}

export function useCustomerLogin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { email: string; password: string }) =>
      jsonFetch<{ customer: { id: string; name: string; email: string } }>('/api/customer/login', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customer-me'] }),
  })
}

export function useCustomerRegister() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { name: string; email: string; password: string }) =>
      jsonFetch<{ customer: { id: string; name: string; email: string } }>('/api/customer/register', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customer-me'] }),
  })
}

export function useCustomerLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => jsonFetch<{ ok: true }>('/api/customer/logout', { method: 'POST' }),
    onSuccess: () => {
      // Drop the cached profile immediately (the refetch would show a stale overview).
      qc.setQueryData(['customer-me'], null)
      qc.invalidateQueries({ queryKey: ['customer-me'] })
    },
  })
}

export function useUpdateCustomerProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      name?: string
      phone?: string | null
      defaultAddress?: string | null
      defaultCity?: string | null
      defaultState?: string | null
    }) =>
      jsonFetch<{ customer: CustomerView }>('/api/customer/me', {
        method: 'PATCH',
        body: JSON.stringify(input),
      }).then((r) => r.customer),
    onSuccess: (customer) => {
      qc.setQueryData(['customer-me'], customer)
      toast.success('Saved — your details will prefill checkout.')
    },
    onError: (e: Error) => toast.error(e.message),
  })
}
