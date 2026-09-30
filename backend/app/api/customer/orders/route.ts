import { sql } from '@/lib/db'
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

  const orders = await sql<{
    orderNumber: string
    status: string
    total: number
    createdAt: Date
    /** Per-order line quantities (json_agg → null when the order has no items). */
    itemQtys: number[] | null
  }[]>`
    SELECT o."orderNumber", o.status, o.total, o."createdAt",
      (SELECT json_agg(oi.qty) FROM "OrderItem" oi WHERE oi."orderId" = o.id) AS "itemQtys"
    FROM "Order" o
    WHERE o.email = ${customer.email}
    ORDER BY o."createdAt" DESC
    LIMIT 20
  `

  return ok({
    orders: orders.map((o) => ({
      orderNumber: o.orderNumber,
      status: o.status,
      total: o.total,
      itemCount: (o.itemQtys ?? []).reduce((sum, qty) => sum + qty, 0),
      createdAt: o.createdAt,
    })),
  })
}
