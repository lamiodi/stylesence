import { db } from '@/lib/db'
import { fail, ok, readValidated } from '@/lib/api-helpers'
import { getCartFromCookie } from '@/lib/cart'
import { checkoutInput } from '@/lib/validators'
import { evaluatePromoStack } from '@/lib/promo'
import { PRODUCTION_TIERS } from '@/lib/types'
import { deliveryZone, shippingError } from '@/lib/shipping'
import { initiatePaystack, initiateStripe, paystackConfigured, stripeConfigured } from '@/lib/payments'
import { getFrontendUrl } from '@/lib/email'

/**
 * POST /api/checkout
 * Re-checks stock, atomically decrements it, snapshots order items
 * (incl. Round-13 made-to-order measurements + per-item tailoring notes),
 * creates a PENDING_PAYMENT order, clears the cart.
 * Round 13: delivery tiers (local / nationwide / international) with a country
 * field, a production timeline (standard 7–10 · express 2–3 working days,
 * express surcharge arranged by the studio — never charged here), and a
 * mandatory pre-production confirmation.
 * Optional `promoCodes` (a single money-saving code) is validated, applied
 * and usage-incremented.
 * → 201 `{ order: { orderNumber, total, discount } }`.
 */

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
  if (input.promoCodes) {
    const stackEval = await evaluatePromoStack(input.promoCodes, subtotal, input.email)
    if (!stackEval.ok) return fail(stackEval.status, stackEval.error)
    discount = stackEval.discount
    promoCodes = stackEval.promos.map((p) => p.code).join(',')
    promoCode = stackEval.promos[0].code
    const rows = await db.promoCode.findMany({
      where: { code: { in: stackEval.promos.map((p) => p.code) } },
      select: { id: true },
    })
    promoIds = rows.map((r) => r.id)
  }

  // Resolve the price from the address, never from a client-supplied amount.
  const deliveryError = shippingError(input.country, input.state, input.shippingMethod)
  if (deliveryError) return fail(400, deliveryError)
  const shipping = deliveryZone(input.country, input.state)!.price
  // Round 13 production timeline — express is contact-priced (surcharge
  // arranged by the studio after ordering; never charged here).
  const productionTier = input.productionTier ?? 'standard'
  const productionFee = PRODUCTION_TIERS[productionTier].fee
  const total = subtotal - discount + shipping + productionFee

  // Payment rails: every order starts PENDING_PAYMENT. Gateway orders settle
  // via /api/checkout/verify (or the Paystack webhook); "confirmed" orders
  // (bank transfer / card link) settle when the studio marks them PAID in the
  // admin console. An order is never born PAID — the client's choice of rail
  // is not proof of payment.
  const gatewayLive =
    (input.paymentMethod === 'paystack' && paystackConfigured()) ||
    (input.paymentMethod === 'stripe' && stripeConfigured())
  const initialStatus = 'PENDING_PAYMENT'

  let orderNumber: string
  let orderId = ''
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

      // Unique order number: SS-<year>-XXXXXX — six digits (1M space) so the
      // number alone can't be enumerated across the customer-PII surface.
      // Legacy 4-digit numbers from earlier orders still resolve.
      let created: { orderNumber: string; id: string } | null = null
      for (let attempt = 0; attempt < 20 && !created; attempt++) {
        const digits = attempt < 15 ? 6 : 8
        const candidate = `SS-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10 ** digits)).padStart(digits, '0')}`
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
            status: initialStatus,
            paymentMethod: input.paymentMethod,
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
      orderId = created.id
      await tx.cartItem.deleteMany({ where: { cartId: cart.cartId } })
      return created.orderNumber
    })
  } catch (err) {
    if (err instanceof StockError) return fail(400, err.message)
    console.error('[api/checkout] transaction failed:', err)
    return fail(500, 'Checkout failed. Please try again.')
  }

  // Gateway payment — initialize and hand back the hosted payment URL. A
  // failed initialization leaves the order placed (PENDING_PAYMENT) and the
    if (gatewayLive) {
    const frontendUrl = getFrontendUrl()
    try {
      const payment =
        input.paymentMethod === 'paystack'
          ? await initiatePaystack({
              orderNumber,
              email: input.email,
              amountNaira: total,
              // The buyer's email rides the callback so the receipt page can
              // request the full order view (see /api/orders/[orderNumber]).
              callbackUrl: `${frontendUrl}/order/${orderNumber}?email=${encodeURIComponent(input.email)}`,
            })
          : await initiateStripe({
              orderNumber,
              email: input.email,
              amountNaira: total,
              successUrl: `${frontendUrl}/order/${orderNumber}?email=${encodeURIComponent(input.email)}&session_id={CHECKOUT_SESSION_ID}`,
              cancelUrl: `${frontendUrl}/order/${orderNumber}?email=${encodeURIComponent(input.email)}`,
            })
      await db.order.update({
        where: { id: orderId },
        data: { paymentReference: payment.reference },
      })
      return ok(
        { order: { orderNumber, total, discount }, payment: { url: payment.authorizationUrl } },
        { status: 201 },
      )
    } catch (err) {
      console.error(`[api/checkout] payment initialization failed for ${orderNumber}:`, err)
      return ok(
        {
          order: { orderNumber, total, discount },
          payment: { url: null, note: 'The payment gateway could not be reached — your order is saved and the studio will send payment details.' },
        },
        { status: 201 },
      )
    }
  }

  // Studio-confirmed rail: no automatic receipt — the receipt template reads
  // "Total Paid", which would be false until the studio verifies the transfer
  // and marks the order PAID (that transition sends the customer an update).
  // The studio contacts the buyer with payment details directly.
  console.log(`[api/checkout] order ${orderNumber} placed via studio-confirmed rail`)

  return ok({ order: { orderNumber, total, discount } }, { status: 201 })
}
