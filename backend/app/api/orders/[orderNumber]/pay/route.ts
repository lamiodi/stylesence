import { sql } from '@/lib/db'
import { fail, ok } from '@/lib/api-helpers'
import { getFrontendUrl } from '@/lib/email'
import { initiatePaystack, initiateStripe, paystackConfigured, stripeConfigured } from '@/lib/payments'

/**
 * POST /api/orders/[orderNumber]/pay?email=…
 * Retry-payment for a PENDING_PAYMENT gateway order whose session failed,
 * was cancelled or timed out. The email query param must match the order
 * (same gate as the full order view — an order number alone can't restart
 * payments). Re-initializes the gateway at the stored server-side total and
 * rotates paymentReference; the webhook's metadata lookup and the
 * self-heal re-check work unchanged against the new reference, and a very
 * late completion of the OLD session still settles via webhook metadata.
 */
export async function POST(req: Request, { params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params
  const email = new URL(req.url).searchParams.get('email')?.trim().toLowerCase() || ''

  const rows = await sql<
    { id: string; email: string; total: number; status: string; paymentMethod: string }[]
  >`
    SELECT id, email, total, status, "paymentMethod"
    FROM "Order" WHERE "orderNumber" = ${orderNumber} LIMIT 1
  `
  const order = rows[0]
  if (!order) return fail(404, 'Order not found')

  if (!email || email !== order.email.toLowerCase()) {
    return fail(403, 'Email does not match this order.')
  }
  if (order.status !== 'PENDING_PAYMENT') {
    return fail(400, 'This order is not awaiting payment.')
  }
  if (order.paymentMethod !== 'paystack' && order.paymentMethod !== 'stripe') {
    return fail(400, 'This order is on studio-confirmed payment — the studio will send you payment details.')
  }
  if (order.paymentMethod === 'paystack' && !paystackConfigured()) {
    return fail(503, 'Card payment is temporarily unavailable — WhatsApp the studio on +234 816 302 2233.')
  }
  if (order.paymentMethod === 'stripe' && !stripeConfigured()) {
    return fail(503, 'Card payment is temporarily unavailable — WhatsApp the studio on +234 816 302 2233.')
  }

  const frontendUrl = getFrontendUrl()
  const callbackBase = `${frontendUrl}/order/${orderNumber}?email=${encodeURIComponent(order.email)}`
  try {
    const payment =
      order.paymentMethod === 'paystack'
        ? await initiatePaystack({
            orderNumber,
            email: order.email,
            amountNaira: order.total,
            callbackUrl: callbackBase,
          })
        : await initiateStripe({
            orderNumber,
            email: order.email,
            amountNaira: order.total,
            successUrl: `${callbackBase}&session_id={CHECKOUT_SESSION_ID}`,
            cancelUrl: callbackBase,
          })
    await sql`
      UPDATE "Order" SET "paymentReference" = ${payment.reference}, "updatedAt" = now()
      WHERE id = ${order.id}
    `
    return ok({ payment: { url: payment.authorizationUrl } })
  } catch (err) {
    console.error(`[api/orders/pay] gateway initialization failed for ${orderNumber}:`, err)
    return fail(502, 'The payment gateway could not be reached — try again in a moment.')
  }
}
