'use client'

import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Check, X, Tag } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatNaira } from '@/lib/money'
import { usePromoStore } from '@/lib/store/promo'
import type { PromoInfo } from '@/lib/types'

/**
 * Validates the persisted promo code against a subtotal (and, when provided,
 * the customer email — enables the single-use-per-customer check early).
 * Returns `{ data: { promo } }` when valid; `isError` when not.
 */
export function usePromoValidation(code: string | null, subtotal: number, email?: string) {
  // Only include plausible emails (typed '@') so keystroke edits don't spam refetches.
  const emailForCheck = email && email.includes('@') ? email.trim().toLowerCase() : undefined
  return useQuery<{ promo: PromoInfo }>({
    queryKey: ['promo', code, subtotal, emailForCheck ?? null],
    queryFn: async () => {
      const res = await fetch('/api/promo/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, subtotal, email: emailForCheck }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'This code is not on the books.')
      return data as { promo: PromoInfo }
    },
    enabled: !!code && subtotal > 0,
    retry: false,
    staleTime: 30_000,
  })
}

/**
 * Promo code input + applied chip. State lives in the persisted promo store;
 * the server re-validates at checkout (authoritative). The optional email
 * participates in validation so single-use-per-customer codes fail loudly here
 * rather than at checkout.
 */
export function PromoInput({ subtotal, email }: { subtotal: number; email?: string }) {
  const code = usePromoStore((s) => s.code)
  const setCode = usePromoStore((s) => s.setCode)
  const [input, setInput] = useState('')

  const emailForCheck = email && email.includes('@') ? email.trim().toLowerCase() : undefined
  const { isError } = usePromoValidation(code, subtotal, email)

  const apply = useMutation({
    mutationFn: async (raw: string) => {
      const res = await fetch('/api/promo/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: raw.trim(), subtotal, email: emailForCheck }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'This code is not on the books.')
      return data.promo as PromoInfo
    },
    onSuccess: (promo) => {
      setCode(promo.code)
      setInput('')
      toast.success(`${promo.code} applied.`, {
        description: promo.label ?? undefined,
      })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const value = input.trim()
    if (!value) return toast.error('Enter a promo code first.')
    apply.mutate(value)
  }

  if (code) {
    return (
      <div
        className={cn(
          'flex items-center justify-between gap-3 border px-3.5 py-3',
          isError ? 'border-destructive/50 bg-destructive/5' : 'border-line bg-secondary/60',
        )}
        role="status"
        aria-label={isError ? 'Promo code no longer valid' : 'Promo code applied'}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          {isError ? (
            <X className="h-4 w-4 shrink-0 text-destructive" strokeWidth={1.5} aria-hidden />
          ) : (
            <Check className="h-4 w-4 shrink-0 text-espresso" strokeWidth={1.5} aria-hidden />
          )}
          <div className="min-w-0">
            <p className="truncate font-mono text-[0.78rem] font-medium tracking-[0.06em]">{code}</p>
            <p className={cn('truncate text-[0.68rem]', isError ? 'text-destructive' : 'text-muted-foreground')}>
              {isError ? 'No longer valid for this bag — remove to continue.' : 'Applied — verified at checkout.'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setCode(null)}
          className="flex h-7 w-7 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-destructive"
          aria-label={`Remove promo code ${code}`}
        >
          <X className="h-3.5 w-3.5" strokeWidth={1.5} />
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2 border border-line-strong px-3 transition-colors focus-within:border-foreground">
          <Tag className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden />
          <label htmlFor="promo-code" className="sr-only">
            Promo code
          </label>
          <input
            id="promo-code"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            placeholder="PROMO CODE"
            disabled={apply.isPending}
            autoComplete="off"
            className="w-full bg-transparent py-2.5 font-mono text-[0.78rem] tracking-[0.08em] placeholder:tracking-[0.14em] placeholder:text-muted-foreground/60 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={apply.isPending}
          className="h-[2.4rem] shrink-0 border border-line-strong px-4 text-[0.62rem] font-medium uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:border-foreground hover:text-foreground disabled:opacity-50"
        >
          {apply.isPending ? '…' : 'Apply'}
        </button>
      </div>
      <p className="mt-2 text-[0.66rem] leading-relaxed text-muted-foreground/80">
        Try <span className="font-mono">SS-FRIEND</span> — friends of the house take 10% off.
      </p>
    </form>
  )
}
