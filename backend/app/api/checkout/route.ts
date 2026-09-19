import { db } from '@/lib/db'
import { fail, ok, readValidated } from '@/lib/api-helpers'
import { getCartFromCookie } from '@/lib/cart'
import { checkoutInput } from '@/lib/validators'
import { evaluatePromoStack } from '@/lib/promo'
import { PRODUCTION_TIERS } from '@/lib/types'
import { sendOrderConfirmationEmail } from '@/lib/email'

/**
 * POST /api/checkout
 * Re-checks stock, atomically decrements it, snapshots order items
 * (incl. Round-13 made-to-order measurements + per-item tailoring notes),
 * creates a PAID order (dev placeholder payment), clears the cart.
 * Round 13: delivery tiers (local / nationwide / international) with a country
 * field, a production timeline (standard 7–10 · express 2–3 working days,
 * fee = dev placeholder), and a mandatory pre-production confirmation.
 * Optional `promoCodes` (up to 2 — one money-saving + one shipping, both
 * stackable) is validated, applied and usage-incremented per code.
 * → 201 `{ order: { orderNumber, total, discount } }`.
 */

const SHIPPING_RATES: Record<'local' | 'nationwide' | 'international', number> = {
  local: 2500,
  nationwide: 3500,
  international: 25000, // dev placeholder — live international rates pending
}

/** Complimentary nationwide shipping on merchandise subtotals at/above this value. */
const FREE_SHIPPING_THRESHOLD = 150_000

class StockError extends Error {}

function stockMessage(name: string, size: string, color: string, stock: number): string {
  return `Only ${stock} left in stock for ${name} (${size}, ${color})`
}

export async function POST(req: Request) {
  const parsed = await readValidated(req, checkoutInput)
  if (!parsed.ok) return parsed.response
  const input = parsed.data

  const cart = await getCartFromCookie()
  if (!cart) return fail(404, 'Your cart is empty')

  const items = await db.cartItem.findMany({
    where: { cartId: cart.cartId },
    orderBy: { id: 'asc' },
    include: {
      variant: { include: { product: { include: { images: { orderBy: { position: 'asc' }, take: 1 } } } } },
    },
  })
  if (items.length === 0) return fail(404, 'Your cart is empty')

  // Pre-flight stock check (fail fast with the offending item).
  for (const item of items) {
    if (item.qty > item.variant.stock) {
      return fail(
        400,
        stockMessage(item.variant.product.name, item.variant.size, item.variant.color, item.variant.stock)
      )
    }
  }

  const subtotal = items.reduce((sum, i) => sum + i.variant.product.price * i.qty, 0)

  // Validate the promo stack against this cart before the transaction (server is
  // authoritative). The order email participates — single-use-per-customer codes
  // reject repeat redeemers.
  let discount = 0
  let promoCode: string | null = null
  let promoCodes: string | null = null
  let promoIds: string[] = []
  let freeShipping = false
  if (input.promoCodes) {
    const stackEval = await evaluatePromoStack(input.promoCodes, subtotal, input.email)
    if (!stackEval.ok) return fail(stackEval.status, stackEval.error)
    discount = stackEval.discount
    freeShipping = stackEval.freeShipping
    promoCodes = stackEval.promos.map((p) => p.code).join(',')
    // Primary code: the money-saving one when stacked, else the only code.
    promoCode = stackEval.promos.find((p) => p.type !== 'SHIPPING')?.code ?? stackEval.promos[0].code
    const rows = await db.promoCode.findMany({
      where: { code: { in: stackEval.promos.map((p) => p.code) } },
      select: { id: true },
    })
    promoIds = rows.map((r) => r.id)
  }

  // Round 13 delivery tiers: local + nationwide are Nigeria-only; international
  // is the only method for addresses outside Nigeria.
  if (input.country !== 'Nigeria' && (input.shippingMethod === 'local' || input.shippingMethod === 'nationwide')) {
    return fail(400, 'Local and nationwide delivery are only available within Nigeria — choose international delivery.')
  }

  // Complimentary nationwide shipping over the threshold (matches the storefront
  // promise on the cart page + announcement bar). Promo free-shipping wins over
  // everything (also waives international).
  const thresholdFree = subtotal >= FREE_SHIPPING_THRESHOLD && input.shippingMethod === 'nationwide'
  const shipping = freeShipping || thresholdFree ? 0 : SHIPPING_RATES[input.shippingMethod]
  // Round 13 production timeline — express is a paid add-on (fee is a dev placeholder).
  const productionTier = input.productionTier ?? 'standard'
  const productionFee = PRODUCTION_TIERS[productionTier].fee
  const total = subtotal - discount + shipping + productionFee

  let orderNumber: string
  try {
    orderNumber = await db.$transaction(async (tx) => {
      // Atomically decrement stock — guarded by `stock >= qty`.
      for (const item of items) {
        const updated = await tx.productVariant.updateMany({
          where: { id: item.variantId, stock: { gte: item.qty } },
          data: { stock: { decrement: item.qty } },
        })
        if (updated.count !== 1) {
          throw new StockError(
            stockMessage(item.variant.product.name, item.variant.size, item.variant.color, item.variant.stock)
          )
        }
      }

      // Unique order number: SS-2026-XXXX (retry on collision).
      let created: { orderNumber: string } | null = null
      for (let attempt = 0; attempt < 20 && !created; attempt++) {
        const digits = attempt < 15 ? 4 : 6
        const candidate = `SS-2026-${String(Math.floor(Math.random() * 10 ** digits)).padStart(digits, '0')}`
        const clash = await tx.order.findUnique({ where: { orderNumber: candidate }, select: { id: true } })
        if (clash) continue
        const order = await tx.order.create({
          data: {
            orderNumber: candidate,
            email: input.email,
            fullName: input.fullName,
            phone: input.phone ?? null,
            address: input.address,
            city: input.city,
            state: input.state,
            country: input.country,
            notes: input.notes ?? null,
            shippingMethod: input.shippingMethod,
            shipping,
            subtotal,
            discount,
            promoCode,
            promoCodes,
            productionTier,
            productionFee,
            confirmedProduction: true,
            total,
            status: 'PAID',
          },
          select: { orderNumber: true, id: true },
        })
        for (const id of promoIds) {
          await tx.promoCode.update({
            where: { id },
            data: { usageCount: { increment: 1 } },
          })
        }
        await tx.orderItem.createMany({
          data: items.map((item) => ({
            orderId: order.id,
            variantId: item.variantId,
            productName: item.variant.product.name,
            productSlug: item.variant.product.slug,
            size: item.sizeMode === 'custom' ? `${item.variant.size} (custom)` : item.variant.size,
            color: item.variant.color,
            imageUrl: item.variant.product.images[0]?.url ?? null,
            unitPrice: item.variant.product.price,
            qty: item.qty,
            sizeMode: item.sizeMode,
            customMeasurements: item.customMeasurements,
            notes: item.notes,
          })),
        })
        created = order
      }
      if (!created) throw new Error('Could not allocate a unique order number')

      await tx.cartItem.deleteMany({ where: { cartId: cart.cartId } })
      return created.orderNumber
    })
  } catch (err) {
    if (err instanceof StockError) return fail(400, err.message)
    console.error('[api/checkout] transaction failed:', err)
    return fail(500, 'Checkout failed. Please try again.')
  }

  // Non-blocking order confirmation email dispatch via Resend
  sendOrderConfirmationEmail({
    orderNumber,
    fullName: input.fullName,
    email: input.email,
    phone: input.phone,
    address: input.address,
    city: input.city,
    state: input.state,
    shippingMethod: input.shippingMethod,
    shipping,
    subtotal,
    discount,
    total,
    items: items.map((item) => ({
      productName: item.variant.product.name,
      size: item.sizeMode === 'custom' ? `${item.variant.size} (custom)` : item.variant.size,
      color: item.variant.color,
      qty: item.qty,
      unitPrice: item.variant.product.price,
      imageUrl: item.variant.product.images[0]?.url ?? null,
    })),
  }).catch((err) => console.error('[api/checkout] Failed to dispatch order confirmation email:', err))

  return ok({ order: { orderNumber, total, discount } }, { status: 201 })
}
