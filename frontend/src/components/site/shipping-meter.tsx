'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatNaira } from '@/lib/money'

/**
 * Complimentary nationwide delivery unlocks at this merchandise subtotal.
 * Mirrors the server-side rule in /api/checkout (kept in sync deliberately —
 * the checkout route owns the authoritative copy for order totals; the
 * threshold applies to the nationwide method only).
 */
export const FREE_SHIPPING_THRESHOLD = 150_000

/**
 * Editorial progress meter toward complimentary nationwide delivery.
 * `compact` tightens the padding for the cart sheet drawer.
 * `unlockedByPromo` short-circuits the meter when a shipping promo code
 * (e.g. SENCE-SHIP) already waives the fee.
 */
export function FreeShippingMeter({
  subtotal,
  compact = false,
  unlockedByPromo = false,
}: {
  subtotal: number
  compact?: boolean
  unlockedByPromo?: boolean
}) {
  const remaining = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal)
  const pct = Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100)
  const unlocked = remaining === 0 || unlockedByPromo

  if (unlocked) {
    return (
      <div
        role="status"
        className={cn(
          'flex items-center gap-2 border border-line bg-secondary/60',
          compact ? 'px-3.5 py-2.5' : 'px-4 py-3',
        )}
      >
        <Check className="h-3.5 w-3.5 shrink-0 text-espresso" strokeWidth={2} aria-hidden />
        <p className="text-[0.74rem] leading-snug text-espresso">
          {unlockedByPromo
            ? 'Complimentary nationwide delivery unlocked — your code covers it.'
            : 'Complimentary nationwide delivery unlocked — our thanks.'}
        </p>
      </div>
    )
  }

  return (
    <div role="status" className={cn('border border-line bg-secondary/60', compact ? 'px-3.5 py-2.5' : 'px-4 py-3')}>
      <p className="text-[0.74rem] leading-snug text-muted-foreground">
        You are{' '}
        <span className="font-mono font-medium text-foreground tabular-nums">{formatNaira(remaining)}</span> away from
        complimentary nationwide delivery.
      </p>
      <div
        className="mt-2 h-1 overflow-hidden bg-secondary"
        role="progressbar"
        aria-label="Progress toward complimentary nationwide delivery"
        aria-valuemin={0}
        aria-valuemax={FREE_SHIPPING_THRESHOLD}
        aria-valuenow={Math.min(subtotal, FREE_SHIPPING_THRESHOLD)}
      >
        <div
          className="h-full bg-espresso transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
