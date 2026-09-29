import { db } from '@/lib/db'
import { fail, ok, readValidated, toAdminOrder } from '@/lib/api-helpers'
import { requireAdmin } from '@/lib/auth'
import { orderPatchInput } from '@/lib/validators'
import { refundPromoUsage } from '@/lib/promo'
import { sendOrderStatusUpdateEmail } from '@/lib/email'

const ORDER_STATUSES = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']

/** PATCH /api/admin/orders/[id] `{status}` → `{ order }` (with items).
 *
 * Stock follows the CANCELLED boundary in both directions: cancelling an
 * order returns its items to stock; un-cancelling re-consumes them (and is
 * rejected if stock is no longer available). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if (!admin) return fail(401, 'Unauthorized')

  const { id } = await params
  const parsed = await readValidated(req, orderPatchInput)
  if (!parsed.ok) return parsed.response

  if (!(ORDER_STATUSES as string[]).includes(parsed.data.status)) {
    return fail(400, 'Invalid order status')
  }

  const existing = await db.order.findUnique({
    where: { id },
    select: { id: true, status: true, promoCode: true, promoCodes: true },
  })
  if (!existing) return fail(404, 'Order not found')

  const next = parsed.data.status
  const wasCancelled = existing.status === 'CANCELLED'
  const crossingIntoCancelled = next === 'CANCELLED' && !wasCancelled
  const leavingCancelled = wasCancelled && next !== 'CANCELLED'

  let order
  try {
    order = await db.$transaction(async (tx) => {
      if (crossingIntoCancelled || leavingCancelled) {
        const items = await tx.orderItem.findMany({
          where: { orderId: id },
          select: { variantId: true, qty: true },
        })
        for (const item of items) {
          if (!item.variantId) continue // legacy/custom rows without a variant link
          const updated = await tx.productVariant.updateMany({
            where: crossingIntoCancelled
              ? { id: item.variantId }
              : { id: item.variantId, stock: { gte: item.qty } },
            data: {
              stock: crossingIntoCancelled
                ? { increment: item.qty }
                : { decrement: item.qty },
            },
          })
          if (updated.count !== 1) {
            if (crossingIntoCancelled) {
              // Variant row gone (deleted product) — nothing to restock; skip.
              console.warn(`[api/admin/orders] variant ${item.variantId} missing on cancel-restock — skipped`)
              continue
            }
            throw new Error('Insufficient stock to un-cancel this order')
          }
        }
        // A cancelled order returns its promo usage too — the checkout
        // increment is only deserved by orders that stand.
        if (crossingIntoCancelled) {
          await refundPromoUsage(tx, existing.promoCode, existing.promoCodes)
        }
      }
      return tx.order.update({
        where: { id },
        data: { status: next },
        include: { items: { orderBy: { id: 'asc' } } },
      })
    })
  } catch (err) {
    console.error('[api/admin/orders] status change failed:', err)
    return fail(409, (err as Error).message || 'Could not update the order status.')
  }

  // Non-blocking status notification dispatch via Resend
  sendOrderStatusUpdateEmail({
    orderNumber: order.orderNumber,
    fullName: order.fullName,
    email: order.email,
    status: order.status,
  }).catch((err) => console.error('[api/admin/orders] Failed to send status update email:', err))

  return ok({ order: toAdminOrder(order) })
}
