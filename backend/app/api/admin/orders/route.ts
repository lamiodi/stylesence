import { sql } from '@/lib/db'
import type { Order, OrderItem } from '@/lib/db-types'
import { fail, ok, toAdminOrder } from '@/lib/api-helpers'
import { requireAdmin } from '@/lib/auth'

/** GET /api/admin/orders — all orders (newest first) with items. */
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return fail(401, 'Unauthorized')

  const rows = await sql<(Order & { items: OrderItem[] | null })[]>`
    SELECT o.*,
      (SELECT json_agg(src.*)
        FROM (SELECT * FROM "OrderItem" oi WHERE oi."orderId" = o.id ORDER BY oi.id ASC) src
      ) AS items
    FROM "Order" o
    ORDER BY o."createdAt" DESC
  `
  const orders = rows.map((o) => ({ ...o, items: o.items ?? [] }))
  return ok({ orders: orders.map(toAdminOrder) })
}
