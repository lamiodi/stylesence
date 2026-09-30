import { sql } from '@/lib/db'
import { fail, ok } from '@/lib/api-helpers'
import { getOrderByNumber } from '@/lib/orders'
import { getFrontendUrl } from '@/lib/email'
import { initiatePaystack, initiateStripe, paystackConfigured, stripeConfigured, verifyPaystack, verifyStripe } from '@/lib/payments'
import { settleGatewayPayment } from '@/lib/order-settle'

/**
 * POST /api/orders/[orderNumber]/pay?email=…
 * Retry-payment for a PENDING_PAYMENT gateway order whose session failed,
 * was cancelled or timed out. The email query param must match the order
 * (same gate as the full order view — an order number alone can't restart
 * payments).
 *
 * The PREVIOUS session is verified before a new one is minted: a payment
 * that actually landed is settled instead of re-charged, and one still in
 * flight (bank transfer in progress) returns 409 so the customer can't pay
 * twice. Only a definitively dead session (Paystack failed/abandoned/
 * reversed/expired, Stripe unpaid — or a reference the gateway never knew)
 * gets a fresh session at the stored server-side total; paymentReference
 * rotates and the webhook's metadata lookup and the self-heal re-check work
 * unchanged against the new reference (a very late completion of the OLD
 * session still settles via webhook metadata).
 */

/** Paystack statuses that mean the session can never complete. */
const PAYSTACK_DEAD = new Set(['failed', 'abandoned', 'reversed', 'expired'])

export async function POST(req: Request, { params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params
  const email = new URL(req.url).searchParams.get('email')?.trim().toLowerCase() || ''

  const rows = await sql<
    { id: string; email: string; total: number; status: string; paymentMethod: string; paymentReference: string | null }[]
  >`
    SELECT id, email, total, status, "paymentMethod", "paymentReference"
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

  // Check the previous attempt first — the retry button must never turn a
  // pending transfer into a second charge.
  if (order.paymentReference) {
    let previous: { paid: boolean; amountNaira: number | null; gatewayStatus?: string }
    try {
      previous =
        order.paymentMethod === 'paystack'
          ? await verifyPaystack(order.paymentReference)
          : await verifyStripe(order.paymentReference)
    } catch (err) {
      console.error(`[api/orders/pay] could not verify previous session for ${orderNumber}:`, err)
      return fail(502, 'We could not check your previous payment attempt — try again in a moment.')
    }

    if (previous.paid) {
      // The "failed" session actually landed — settle it, don't re-charge.
      const full = await getOrderByNumber(orderNumber)
      if (!full) return fail(404, 'Order not found')
      const outcome = await settleGatewayPayment(full, order.paymentReference, previous.amountNaira)
      if (outcome === 'amount-mismatch') {
        return fail(402, 'Payment amount does not match the order — WhatsApp the studio on +234 816 302 2233.')
      }
      return ok({ settled: true })
    }

    const gatewayStatus = (previous.gatewayStatus ?? '').toLowerCase()
    const dead =
      gatewayStatus === '' || // the gateway never knew this reference — no live charge to protect
      (order.paymentMethod === 'paystack'
        ? PAYSTACK_DEAD.has(gatewayStatus)
        : gatewayStatus === 'unpaid') // Stripe session expired without paying
    if (!dead) {
      // Ongoing, processing, unknown — a charge may still complete. Send the
      // customer back to wait rather than opening a second session.
      return fail(
        409,
        'A payment attempt is still being processed. If you completed a bank transfer, give it a few minutes — this page updates automatically. Otherwise WhatsApp the studio on +234 816 302 2233.',
      )
    }
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
