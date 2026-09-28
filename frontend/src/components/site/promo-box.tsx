'use client'

import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Check, X, Tag, Layers } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatNaira } from '@/lib/money'
import { PROMO_STACK_MAX, type PromoInfo, type PromoStackInfo } from '@/lib/types'
import { usePromoStore } from '@/lib/store/promo'

/**
 * Validates the persisted promo stack against a subtotal (and, when provided,
 * the customer email — enables the single-use-per-customer check early).
 * Returns `{ data: { promos, discount, freeShipping } }` when valid;
 * `isError` when any code in the stack fails.
 */
export function usePromoValidation(codes: string[], subtotal: number, email?: string) {
  // Only include plausible emails (typed '@') so keystroke edits don't spam refetches.
  const emailForCheck = email && email.includes('@') ? email.trim().toLowerCase() : undefined
  const stackKey = codes.filter(Boolean).join(',')
  return useQuery<PromoStackInfo>({
    queryKey: ['promo', stackKey, subtotal, emailForCheck ?? null],
    queryFn: async () => {
      const res = await fetch('/api/promo/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codes: stackKey ? stackKey.split(',') : [], subtotal, email: emailForCheck }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'This code is not on the books.')
      return data as PromoStackInfo
    },
    enabled: stackKey !== '' && subtotal > 0,
    retry: false,
    staleTime: 30_000,
  })
}

function chipNote(promo: PromoInfo): string {
  if (promo.freeShipping) return 'Complimentary delivery'
  if (promo.type === 'PERCENT') return `${promo.value}% off — −${formatNaira(promo.discount)}`
  return `−${formatNaira(promo.discount)}`
}

/**
 * Promo code input + applied chips. State lives in the persisted promo store;
 * the server re-validates the whole stack at checkout (authoritative). The
 * optional email participates in validation so single-use-per-customer codes
 * fail loudly here rather than at checkout.
 *
 * Round 12 — stacking: a bag carries up to two codes (one money-saving + one
 * shipping, both stackable). Applying a second code validates the combined
 * stack server-side and rejects illegal pairings with a clear error.
 */
export function PromoInput({ subtotal, email }: { subtotal: number; email?: string }) {
  const codes = usePromoStore((s) => s.codes)
  const setCodes = usePromoStore((s) => s.setCodes)
  const [input, setInput] = useState('')

  const emailForCheck = email && email.includes('@') ? email.trim().toLowerCase() : undefined
  const { data, isError } = usePromoValidation(codes, subtotal, email)

  const apply = useMutation({
    mutationFn: async (raw: string) => {
      const candidate = [...codes, raw.trim()].filter(Boolean)
      const res = await fetch('/api/promo/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codes: candidate, subtotal, email: emailForCheck }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'This code is not on the books.')
      return data as PromoStackInfo
    },
    onSuccess: (stack) => {
      const applied = stack.promos.map((p) => p.code)
      setCodes(applied)
      setInput('')
      const last = applied[applied.length - 1]
      const lastPromo = stack.promos.find((p) => p.code === last)
      toast.success(applied.length > 1 ? `${applied.join(' + ')} stacked.` : `${last} applied.`, {
        description:
          applied.length > 1
            ? `${formatNaira(stack.discount)} off${stack.freeShipping ? ' + complimentary delivery' : ''}.`
            : lastPromo?.label ?? undefined,
      })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const value = input.trim()
    if (!value) return toast.error('Enter a promo code first.')
    if (codes.length >= PROMO_STACK_MAX) return toast.error('Two codes is the limit per bag.')
    if (codes.includes(value.toUpperCase())) return toast.error('That code is already applied.')
    apply.mutate(value)
  }

  if (codes.length > 0) {
    return (
      <div role="status" aria-label={isError ? 'Promo code no longer valid' : 'Promo codes applied'}>
        <ul className="space-y-1.5">
          {codes.map((code) => {
            const info = data?.promos.find((p) => p.code === code)
            return (
              <li
                key={code}
                className={cn(
                  'flex items-center justify-between gap-3 border px-3.5 py-3',
                  isError ? 'border-destructive/50 bg-destructive/5' : 'border-line bg-secondary/60',
                )}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  {isError ? (
                    <X className="h-4 w-4 shrink-0 text-destructive" strokeWidth={1.5} aria-hidden />
                  ) : (
                    <Check className="h-4 w-4 shrink-0 text-espresso" strokeWidth={1.5} aria-hidden />
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-mono text-[0.78rem] font-medium tracking-[0.06em]">{code}</p>
                    <p
                      className={cn('truncate text-[0.68rem]', isError ? 'text-destructive' : 'text-muted-foreground')}
                    >
                      {isError
                        ? 'No longer valid for this bag — remove to continue.'
                        : info
                          ? `${chipNote(info)} — verified at checkout.`
                          : 'Applied — verified at checkout.'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCodes(codes.filter((c) => c !== code))}
                  className="flex h-7 w-7 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-destructive"
                  aria-label={`Remove promo code ${code}`}
                >
                  <X className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>
              </li>
            )
          })}
        </ul>
        {codes.length >= PROMO_STACK_MAX ? (
          <p className="mt-2 flex items-center gap-1.5 text-[0.66rem] leading-relaxed text-muted-foreground/80">
            <Layers className="h-3 w-3 shrink-0" strokeWidth={1.5} aria-hidden />
            Two codes is the limit — one saving + one shipping.
          </p>
        ) : (
          /* Room for one more — keep the apply form under the chips. */
          <PromoForm input={input} setInput={setInput} onSubmit={submit} pending={apply.isPending} hint={false} />
        )}
      </div>
    )
  }

  return <PromoForm input={input} setInput={setInput} onSubmit={submit} pending={apply.isPending} hint />
}

function PromoForm({
  input,
  setInput,
  onSubmit,
  pending,
  hint,
}: {
  input: string
  setInput: (v: string) => void
  onSubmit: (e: React.FormEvent) => void
  pending: boolean
  hint: boolean
}) {
  return (
    <form onSubmit={onSubmit} noValidate>
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
            disabled={pending}
            autoComplete="off"
            className="w-full bg-transparent py-2.5 font-mono text-[0.78rem] tracking-[0.08em] placeholder:tracking-[0.14em] placeholder:text-muted-foreground/60 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="h-[2.4rem] shrink-0 border border-line-strong px-4 text-[0.62rem] font-medium uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:border-foreground hover:text-foreground disabled:opacity-50"
        >
          {pending ? '…' : 'Apply'}
        </button>
      </div>
      <p className="mt-2 text-[0.66rem] leading-relaxed text-muted-foreground/80">
        {hint ? (
          <>
            Try <span className="font-mono">SS-FRIEND</span> (10% off) — it stacks with{' '}
            <span className="font-mono">SENCE-SHIP</span> for complimentary delivery.
          </>
        ) : (
          <>Add a second stackable code — pair a saving with a shipping code.</>
        )}
      </p>
    </form>
  )
}
