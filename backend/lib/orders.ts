import { sql } from '@/lib/db'
import type { Order, OrderItem } from '@/lib/db-types'

/** Order with its line items included (items oldest-first by id). */
export type OrderWithItems = Order & { items: OrderItem[] }

/** Fetch an order with items by its unique order number. */
export async function getOrderByNumber(orderNumber: string): Promise<OrderWithItems | null> {
  const rows = await sql<(Omit<Order, never> & { items: OrderItem[] | null })[]>`
    SELECT o.*,
      (SELECT json_agg(src.*)
        FROM (SELECT * FROM "OrderItem" oi WHERE oi."orderId" = o.id ORDER BY oi.id ASC) src
      ) AS items
    FROM "Order" o
    WHERE o."orderNumber" = ${orderNumber}
    LIMIT 1
  `
  const row = rows[0]
  return row ? { ...row, items: row.items ?? [] } : null
}

/** Fetch an order with items by its stored gateway payment reference. */
export async function getOrderByPaymentReference(reference: string): Promise<OrderWithItems | null> {
  const rows = await sql<(Order & { items: OrderItem[] | null })[]>`
    SELECT o.*,
      (SELECT json_agg(src.*)
        FROM (SELECT * FROM "OrderItem" oi WHERE oi."orderId" = o.id ORDER BY oi.id ASC) src
      ) AS items
    FROM "Order" o
    WHERE o."paymentReference" = ${reference}
    LIMIT 1
  `
  const row = rows[0]
  return row ? { ...row, items: row.items ?? [] } : null
}
