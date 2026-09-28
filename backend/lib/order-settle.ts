import { db } from '@/lib/db'
import { sendOrderConfirmationEmail, type OrderEmailData } from '@/lib/email'

/**
 * Shared gateway-payment settlement: flips a PENDING_PAYMENT order to PAID and
 * dispatches the customer's confirmation email — exactly once, no matter which
 * path races in first (Paystack webhook, /api/checkout/verify on the redirect,
 * or the self-heal re-check on order views).
 *
 * The transition is a conditional updateMany guarded on status, so concurrent
 * callers can't both claim it — the loser sees count 0 and sends no email.
 */

export type SettleOutcome = 'settled' | 'already-settled' | 'amount-mismatch'

/** Accepts a Prisma order (with items included); only the receipt fields are read. */
export async function settleGatewayPayment(
  order: OrderEmailData & { id: string; status: string },
  reference: string,
  amountNaira: number | null,
): Promise<SettleOutcome> {
  // Same-currency gateway amounts must match the order total exactly (no
  // percentage tolerance: it invites deliberate underpayment). Null amount
  // (gateway didn't report one) still passes.
  if (amountNaira !== null && amountNaira !== order.total) {
    console.error(
      `[order-settle] amount mismatch for ${order.orderNumber}: expected ${order.total}, got ${amountNaira}`,
    )
    return 'amount-mismatch'
  }

  const updated = await db.order.updateMany({
    where: { id: order.id, status: 'PENDING_PAYMENT' },
    data: { status: 'PAID', paymentReference: reference },
  })
  if (updated.count === 0) return 'already-settled'

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
