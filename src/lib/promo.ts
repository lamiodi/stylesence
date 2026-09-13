import { db } from '@/lib/db'

/**
 * Shared promo-code evaluation used by /api/promo/validate and /api/checkout.
 * Money is integer Naira throughout.
 *
 * Stacking (Round 12): a bag may carry up to TWO codes — one money-saving
 * (PERCENT or AMOUNT) + one shipping (SHIPPING) — and only when BOTH are
 * flagged `stackable` in the admin console. Everything else behaves as before.
 */

export interface AppliedPromo {
  code: string
  label: string | null
  type: string
  value: number
  minSubtotal: number
  /** Money-off contribution against the subtotal (0 for SHIPPING codes). */
  discount: number
  freeShipping: boolean
  stackable: boolean
}

export type PromoStackEval =
  | { ok: true; promos: AppliedPromo[]; discount: number; freeShipping: boolean }
  | { ok: false; status: number; error: string }

/** Max codes a single bag may carry. */
export const PROMO_STACK_MAX = 2

export function computeDiscount(type: string, value: number, subtotal: number): number {
  if (type === 'PERCENT') {
    return Math.min(subtotal, Math.floor((subtotal * value) / 100))
  }
  if (type === 'AMOUNT') {
    return Math.min(subtotal, value)
  }
  return 0 // SHIPPING → discount applies to the shipping fee, not the subtotal
}

/** Money-saving class (PERCENT/AMOUNT) vs shipping class (SHIPPING). */
function typeClass(type: string): 'money' | 'shipping' {
  return type === 'SHIPPING' ? 'shipping' : 'money'
}

/**
 * Evaluate the whole applied stack (1–2 codes) against a subtotal.
 * Each code's own rules still apply (active, window, usage cap, min subtotal,
 * single-use per customer). Additionally, a 2-code stack requires both codes
 * to be stackable and to sit in different type classes.
 */
export async function evaluatePromoStack(
  rawCodes: string[],
  subtotal: number,
  email?: string,
): Promise<PromoStackEval> {
  // Normalise: trim, uppercase, drop empties + duplicates (order preserved).
  const codes: string[] = []
  for (const raw of rawCodes) {
    const code = raw.trim().toUpperCase()
    if (code && !codes.includes(code)) codes.push(code)
  }
  if (codes.length === 0) return { ok: false, status: 400, error: 'Enter a promo code.' }
  if (codes.length > PROMO_STACK_MAX) {
    return { ok: false, status: 400, error: `Two codes is the house limit per bag — ${codes.length} were submitted.` }
  }

  const rows = await db.promoCode.findMany({ where: { code: { in: codes } } })
  const byCode = new Map(rows.map((r) => [r.code, r]))

  // Per-code baseline rules (same messages the single-code flow always gave).
  for (const code of codes) {
    const promo = byCode.get(code)
    if (!promo) return { ok: false, status: 404, error: 'This code is not on the books.' }
    if (!promo.isActive) return { ok: false, status: 400, error: `${code} is no longer active.` }
    if (promo.expiresAt && promo.expiresAt.getTime() < Date.now()) {
      return { ok: false, status: 400, error: `${code} has expired.` }
    }
    if (promo.maxUsage !== null && promo.usageCount >= promo.maxUsage) {
      return { ok: false, status: 400, error: `${code} has fully redeemed.` }
    }
    if (subtotal < promo.minSubtotal) {
      return {
        ok: false,
        status: 400,
        error: `${code} applies from ₦${promo.minSubtotal.toLocaleString('en-NG')} — add ₦${(promo.minSubtotal - subtotal).toLocaleString('en-NG')} more.`,
      }
    }
  }

  // Stack rules — only when two codes are present.
  if (codes.length === 2) {
    const [a, b] = codes.map((c) => byCode.get(c)!)
    if (!a.stackable || !b.stackable) {
      const loner = !a.stackable ? a.code : b.code
      return {
        ok: false,
        status: 400,
        error: `${loner} prefers to travel alone — it cannot be combined with another code.`,
      }
    }
    if (typeClass(a.type) === typeClass(b.type)) {
      return {
        ok: false,
        status: 400,
        error:
          typeClass(a.type) === 'money'
            ? 'These two codes overlap — a bag holds one money-saving code (pair it with a shipping code instead).'
            : 'These two codes overlap — a bag holds one shipping code (pair it with a money-saving code instead).',
      }
    }
  }

  // Single-use per customer: one redemption per email across past, non-cancelled
  // orders — checked against the primary field AND the stacked promoCodes list.
  if (email && codes.some((c) => byCode.get(c)?.singleUsePerCustomer)) {
    const history = await db.order.findMany({
      where: { email, status: { not: 'CANCELLED' } },
      select: { promoCode: true, promoCodes: true },
    })
    const used = new Set<string>()
    for (const o of history) {
      if (o.promoCode) used.add(o.promoCode)
      if (o.promoCodes) for (const c of o.promoCodes.split(',')) used.add(c.trim())
    }
    for (const code of codes) {
      if (byCode.get(code)?.singleUsePerCustomer && used.has(code)) {
        return {
          ok: false,
          status: 400,
          error: `${code} is one per customer — it was already used on a past order.`,
        }
      }
    }
  }

  const promos: AppliedPromo[] = codes.map((code) => {
    const p = byCode.get(code)!
    return {
      code: p.code,
      label: p.label,
      type: p.type,
      value: p.value,
      minSubtotal: p.minSubtotal,
      discount: computeDiscount(p.type, p.value, subtotal),
      freeShipping: p.type === 'SHIPPING',
      stackable: p.stackable,
    }
  })

  return {
    ok: true,
    promos,
    discount: promos.reduce((sum, p) => sum + p.discount, 0),
    freeShipping: promos.some((p) => p.freeShipping),
  }
}
