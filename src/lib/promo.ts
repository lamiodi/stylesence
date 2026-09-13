import { db } from '@/lib/db'

/**
 * Shared promo-code evaluation used by /api/promo/validate and /api/checkout.
 * Money is integer Naira throughout.
 */

export type PromoEval =
  | {
      ok: true
      promo: {
        code: string
        label: string | null
        type: string
        value: number
        minSubtotal: number
        discount: number
        freeShipping: boolean
      }
    }
  | { ok: false; status: number; error: string }

export function computeDiscount(type: string, value: number, subtotal: number): number {
  if (type === 'PERCENT') {
    return Math.min(subtotal, Math.floor((subtotal * value) / 100))
  }
  if (type === 'AMOUNT') {
    return Math.min(subtotal, value)
  }
  return 0 // SHIPPING → discount applies to the shipping fee, not the subtotal
}

export async function evaluatePromo(rawCode: string, subtotal: number, email?: string): Promise<PromoEval> {
  const code = rawCode.trim().toUpperCase()
  if (!code) return { ok: false, status: 400, error: 'Enter a promo code.' }

  const promo = await db.promoCode.findUnique({ where: { code } })
  if (!promo) return { ok: false, status: 404, error: 'This code is not on the books.' }
  if (!promo.isActive) return { ok: false, status: 400, error: 'This code is no longer active.' }
  if (promo.expiresAt && promo.expiresAt.getTime() < Date.now()) {
    return { ok: false, status: 400, error: 'This code has expired.' }
  }
  if (promo.maxUsage !== null && promo.usageCount >= promo.maxUsage) {
    return { ok: false, status: 400, error: 'This code has fully redeemed.' }
  }
  if (subtotal < promo.minSubtotal) {
    return {
      ok: false,
      status: 400,
      error: `This code applies from ₦${promo.minSubtotal.toLocaleString('en-NG')} — add ₦${(promo.minSubtotal - subtotal).toLocaleString('en-NG')} more.`,
    }
  }
  // Single-use per customer: one redemption per email across past, non-cancelled orders.
  if (promo.singleUsePerCustomer && email) {
    const redeemed = await db.order.findFirst({
      where: { promoCode: code, email, status: { not: 'CANCELLED' } },
      select: { orderNumber: true },
    })
    if (redeemed) {
      return {
        ok: false,
        status: 400,
        error: `${code} is one per customer — it was already used on order ${redeemed.orderNumber}.`,
      }
    }
  }

  return {
    ok: true,
    promo: {
      code: promo.code,
      label: promo.label,
      type: promo.type,
      value: promo.value,
      minSubtotal: promo.minSubtotal,
      discount: computeDiscount(promo.type, promo.value, subtotal),
      freeShipping: promo.type === 'SHIPPING',
    },
  }
}
