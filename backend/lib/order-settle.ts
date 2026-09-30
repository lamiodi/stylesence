import { sql } from '@/lib/db'
import { sendOrderConfirmationEmail, type OrderEmailData } from '@/lib/email'

/**
 * Shared gateway-payment settlement: flips a PENDING_PAYMENT order to PAID and
 * dispatches the customer's confirmation email — exactly once, no matter which
 * path races in first (Paystack webhook, /api/checkout/verify on the redirect,
 * or the self-heal re-check on order views).
 *
 * The transition is a conditional UPDATE guarded on status, so concurrent
 * callers can't both claim it — the loser sees zero returned rows and sends
 * no email.
 */

export type SettleOutcome = 'settled' | 'already-settled' | 'amount-mismatch'

/** Accepts an order row (with items); only the receipt fields are read. */
export async function settleGatewayPayment(
  order: OrderEmailData & { id: string; status: string },
  reference: string,
  amountNaira: number | null,
): Promise<SettleOutcome> {
  // Settlement requires proof of the amount: a gateway-reported figure that
  // matches the order total exactly (no percentage tolerance — it invites
  // deliberate underpayment). A missing amount is NOT proof: refuse to settle
  // and leave the order pending for manual review.
  if (amountNaira === null || amountNaira !== order.total) {
    console.error(
      `[order-settle] amount mismatch for ${order.orderNumber}: expected ${order.total}, got ${amountNaira ?? 'nothing reported'}`,
    )
    return 'amount-mismatch'
  }

  const updated = await sql<{ id: string }[]>`
    UPDATE "Order"
    SET status = 'PAID', "paymentReference" = ${reference}, "updatedAt" = now()
    WHERE id = ${order.id} AND status = 'PENDING_PAYMENT'
    RETURNING id
  `
  if (updated.length === 0) return 'already-settled'

  sendOrderConfirmationEmail({
    orderNumber: order.orderNumber,
    fullName: order.fullName,
    email: order.email,
    phone: order.phone,
    address: order.address,
    city: order.city,
    state: order.state,
    shippingMethod: order.shippingMethod,
    shipping: order.shipping,
    subtotal: order.subtotal,
    discount: order.discount,
    total: order.total,
    items: order.items.map((item) => ({
      productName: item.productName,
      size: item.size,
      color: item.color,
      qty: item.qty,
      unitPrice: item.unitPrice,
      imageUrl: item.imageUrl,
    })),
  }).catch((err) =>
    console.error(`[order-settle] failed to send confirmation email for ${order.orderNumber}:`, err)
  )

  return 'settled'
}
