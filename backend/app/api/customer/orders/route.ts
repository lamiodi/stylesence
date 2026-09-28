import { db } from '@/lib/db'
import { fail, ok } from '@/lib/api-helpers'
import { getCustomerFromCookies } from '@/lib/auth'

/**
 * GET /api/customer/orders — order history for the signed-in customer.
 * Orders match on email (both are stored lowercased, so the match is effectively
 * case-insensitive). Summary rows only — same field shape as GET /api/orders?email=.
 */
export async function GET() {
  const customer = await getCustomerFromCookies()
  if (!customer) return fail(401, 'Unauthorized')

  const orders = await db.order.findMany({
    where: { email: customer.email },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      orderNumber: true,
      status: true,
      total: true,
      createdAt: true,
      items: { select: { qty: true } },
    },
  })

  return ok({
    orders: orders.map((o) => ({
      orderNumber: o.orderNumber,
      status: o.status,
      total: o.total,
      itemCount: o.items.reduce((sum, i) => sum + i.qty, 0),
      createdAt: o.createdAt,
    })),
  })
}
