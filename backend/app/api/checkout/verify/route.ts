import { db } from '@/lib/db'
import { fail, ok } from '@/lib/api-helpers'
import { verifyPaystack, verifyStripe } from '@/lib/payments'
import { settleGatewayPayment } from '@/lib/order-settle'

/**
 * GET /api/checkout/verify?order=SS-2026-1234&reference=…
 * Server-side verification of a gateway return (Paystack callback or Stripe
 * success redirect). Marks a PENDING_PAYMENT order PAID only when the gateway
 * confirms the payment — the client's word is never enough.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const orderNumber = url.searchParams.get('order')
  const reference = url.searchParams.get('reference')
  if (!orderNumber || !reference) return fail(400, 'Missing order or reference')

  const order = await db.order.findUnique({
    where: { orderNumber },
    include: { items: true },
  })
  if (!order) return fail(404, 'Order not found')

  if (order.status !== 'PENDING_PAYMENT') {
    // Already settled (PAID / CANCELLED / …) — idempotent success.
    return ok({ order: orderNumber, status: order.status, verified: true })
  }

  try {
    const result =
      order.paymentMethod === 'paystack'
        ? await verifyPaystack(reference)
        : order.paymentMethod === 'stripe'
          ? await verifyStripe(reference)
          : { paid: false, amountNaira: null }

    if (!result.paid) {
      return ok({ order: orderNumber, status: 'PENDING_PAYMENT', verified: false })
    }

    const outcome = await settleGatewayPayment(order, reference, result.amountNaira)
    if (outcome === 'amount-mismatch') {
      return fail(402, 'Payment amount does not match the order — contact the studio on WhatsApp +234 816 302 2233.')
    }

    return ok({ order: orderNumber, status: 'PAID', verified: true })
  } catch (err) {
    console.error('[api/checkout/verify] verification failed:', err)
    return fail(502, 'Could not verify the payment. If you were charged, WhatsApp the studio on +234 816 302 2233.')
  }
}
