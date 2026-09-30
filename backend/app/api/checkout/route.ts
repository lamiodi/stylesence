import { sql, cuid, sqlIn, sqlJoin } from '@/lib/db'
import { fail, ok, readValidated } from '@/lib/api-helpers'
import { getCartFromCookie } from '@/lib/cart'
import { checkoutInput } from '@/lib/validators'
import { evaluatePromoStack } from '@/lib/promo'
import { PRODUCTION_TIERS } from '@/lib/types'
import { deliveryZone, shippingError, zonePrice } from '@/lib/shipping'
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

  type ItemRow = {
    id: string
    qty: number
    sizeMode: string
    customMeasurements: string | null
    notes: string | null
    variantId: string
    vSize: string
    vColor: string
    vStock: number
    pSlug: string
    pName: string
    pPrice: number
    pImage: string | null
  }
  const rawItems = await sql<ItemRow[]>`
    SELECT ci.id, ci.qty, ci."sizeMode", ci."customMeasurements", ci.notes,
           v.id AS "variantId", v.size AS "vSize", v.color AS "vColor", v.stock AS "vStock",
           p.slug AS "pSlug", p.name AS "pName", p.price AS "pPrice",
           (SELECT pi.url FROM "ProductImage" pi WHERE pi."productId" = p.id ORDER BY pi.position ASC LIMIT 1) AS "pImage"
    FROM "CartItem" ci
    JOIN "ProductVariant" v ON v.id = ci."variantId"
    JOIN "Product" p ON p.id = v."productId"
    WHERE ci."cartId" = ${cart.cartId}
    ORDER BY ci.id ASC
  `
  const items = rawItems.map((r) => ({
    variantId: r.variantId,
    qty: r.qty,
    sizeMode: r.sizeMode,
    customMeasurements: r.customMeasurements,
    notes: r.notes,
    variant: { size: r.vSize, color: r.vColor, stock: r.vStock },
    product: {
      name: r.pName,
      slug: r.pSlug,
      price: r.pPrice,
      images: r.pImage ? [{ url: r.pImage }] : [],
    },
  }))
  if (items.length === 0) return fail(404, 'Your cart is empty')

  // Pre-flight stock check (fail fast with the offending item).
  for (const item of items) {
    if (item.qty > item.variant.stock) {
      return fail(
        400,
        stockMessage(item.product.name, item.variant.size, item.variant.color, item.variant.stock)
      )
    }
  }

  const subtotal = items.reduce((sum, i) => sum + i.product.price * i.qty, 0)

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
    const rows = await sql<{ id: string }[]>`
      SELECT id FROM "PromoCode" WHERE code IN ${sqlIn(stackEval.promos.map((p) => p.code))}
    `
    promoIds = rows.map((r) => r.id)
  }

  // Resolve the price from the address, never from a client-supplied amount.
  // International parcels ship DHL Express — chargeable weight is pieces × 2kg.
  const deliveryError = shippingError(input.country, input.state, input.shippingMethod)
  if (deliveryError) return fail(400, deliveryError)
  const pieces = items.reduce((sum, i) => sum + i.qty, 0)
  const shipping = zonePrice(deliveryZone(input.country, input.state), pieces)
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
    orderNumber = await sql.begin(async (tx) => {
      // Atomically decrement stock — guarded by `stock >= qty`.
      for (const item of items) {
        const dec = await tx<{ id: string }[]>`
          UPDATE "ProductVariant" SET stock = stock - ${item.qty}
          WHERE id = ${item.variantId} AND stock >= ${item.qty}
          RETURNING id
        `
        if (dec.length !== 1) {
          throw new StockError(
            stockMessage(item.product.name, item.variant.size, item.variant.color, item.variant.stock)
          )
        }
      }

      // Unique order number: SS-<year>-XXXXXX — six digits (1M space) so the
      // number alone can't be enumerated across the customer-PII surface.
      // Legacy 4-digit numbers from earlier orders still resolve. A unique
      // violation races straight into the next candidate.
      let created: { orderNumber: string; id: string } | null = null
      for (let attempt = 0; attempt < 20 && !created; attempt++) {
        const digits = attempt < 15 ? 6 : 8
        const candidate = `SS-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10 ** digits)).padStart(digits, '0')}`
        try {
          const inserted = await tx<{ orderNumber: string; id: string }[]>`
            INSERT INTO "Order" (
              id, "orderNumber", email, "fullName", phone, address, city, state, country, notes,
              "shippingMethod", shipping, subtotal, discount, "promoCode", "promoCodes",
              "productionTier", "productionFee", "confirmedProduction", total, status, "paymentMethod",
              "createdAt", "updatedAt"
            ) VALUES (
              ${cuid()}, ${candidate}, ${input.email}, ${input.fullName}, ${input.phone ?? null},
              ${input.address}, ${input.city}, ${input.state}, ${input.country}, ${input.notes ?? null},
              ${input.shippingMethod}, ${shipping}, ${subtotal}, ${discount}, ${promoCode}, ${promoCodes},
              ${productionTier}, ${productionFee}, true, ${total}, ${initialStatus}, ${input.paymentMethod},
              now(), now()
            )
            RETURNING "orderNumber", id
          `
          created = inserted[0]
        } catch (err) {
          if ((err as { code?: string }).code === '23505') continue // order-number clash — next candidate
          throw err
        }
        if (created) {
          for (const id of promoIds) {
            await tx`
              UPDATE "PromoCode" SET "usageCount" = "usageCount" + 1, "updatedAt" = now()
              WHERE id = ${id}
            `
          }
          const itemValues = items.map(
            (item) => sql`(${cuid()}, ${created!.id}, ${item.variantId}, ${item.product.name}, ${item.product.slug},
              ${item.sizeMode === 'custom' ? `${item.variant.size} (custom)` : item.variant.size}, ${item.variant.color},
              ${item.product.images[0]?.url ?? null}, ${item.product.price}, ${item.qty}, ${item.sizeMode},
              ${item.customMeasurements}, ${item.notes})`,
          )
          await tx`
            INSERT INTO "OrderItem" (
              id, "orderId", "variantId", "productName", "productSlug", size, color, "imageUrl",
              "unitPrice", qty, "sizeMode", "customMeasurements", notes
            ) VALUES ${sqlJoin(itemValues, ', ')}
          `
        }
      }
      if (!created) throw new Error('Could not allocate a unique order number')
      orderId = created.id
      await tx`DELETE FROM "CartItem" WHERE "cartId" = ${cart.cartId}`
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
      await sql`
        UPDATE "Order" SET "paymentReference" = ${payment.reference}, "updatedAt" = now()
        WHERE id = ${orderId}
      `
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
