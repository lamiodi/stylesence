import { db } from '@/lib/db'
import { fail, ok, toAdminOrder } from '@/lib/api-helpers'
import { requireAdmin } from '@/lib/auth'

/** GET /api/admin/orders — all orders (newest first) with items. */
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return fail(401, 'Unauthorized')

  const orders = await db.order.findMany({
    orderBy: { createdAt: 'desc' },
    include: { items: { orderBy: { id: 'asc' } } },
  })
  return ok({ orders: orders.map(toAdminOrder) })
}
