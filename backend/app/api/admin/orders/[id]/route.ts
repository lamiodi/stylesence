import { db } from '@/lib/db'
import { fail, ok, readValidated, toAdminOrder } from '@/lib/api-helpers'
import { requireAdmin } from '@/lib/auth'
import { orderPatchInput } from '@/lib/validators'
import { sendOrderStatusUpdateEmail } from '@/lib/email'

const ORDER_STATUSES = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']

/** PATCH /api/admin/orders/[id] `{status}` → `{ order }` (with items). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if (!admin) return fail(401, 'Unauthorized')

  const { id } = await params
  const parsed = await readValidated(req, orderPatchInput)
  if (!parsed.ok) return parsed.response

  if (!(ORDER_STATUSES as string[]).includes(parsed.data.status)) {
    return fail(400, 'Invalid order status')
  }

  const existing = await db.order.findUnique({ where: { id }, select: { id: true } })
  if (!existing) return fail(404, 'Order not found')

  const order = await db.order.update({
    where: { id },
    data: { status: parsed.data.status },
    include: { items: { orderBy: { id: 'asc' } } },
  })

  // Non-blocking status notification dispatch via Resend
  sendOrderStatusUpdateEmail({
    orderNumber: order.orderNumber,
    fullName: order.fullName,
    email: order.email,
    status: order.status,
  }).catch((err) => console.error('[api/admin/orders] Failed to send status update email:', err))

  return ok({ order: toAdminOrder(order) })
}
