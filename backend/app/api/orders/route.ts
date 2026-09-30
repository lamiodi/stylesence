import { sql } from '@/lib/db'
import { fail, ok } from '@/lib/api-helpers'
import { emailLookupInput } from '@/lib/validators'

/**
 * GET /api/orders?email=… — public guest order-history lookup.
 * Returns order summaries (no addresses, no contact details) for the email,
 * newest first, capped at 20. Unknown email → empty list (200), not an error.
 * Full details stay behind /api/orders/[orderNumber] by order number.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const raw = url.searchParams.get('email')
  if (!raw) return fail(400, 'Missing required query parameter: email')

  const parsed = emailLookupInput.safeParse({ email: raw })
  if (!parsed.success) {
    return fail(400, parsed.error.issues[0]?.message ?? 'Please enter a valid email address')
  }
  const email = parsed.data.email

  const orders = await sql<
    { orderNumber: string; status: string; total: number; createdAt: Date; itemCount: number }[]
  >`
    SELECT o."orderNumber", o.status, o.total, o."createdAt",
      (SELECT COALESCE(SUM(oi.qty), 0)::int FROM "OrderItem" oi WHERE oi."orderId" = o.id) AS "itemCount"
    FROM "Order" o
    WHERE o.email = ${email}
    ORDER BY o."createdAt" DESC
    LIMIT 20
  `

  return ok({
    email,
    orders: orders.map((o) => ({
      orderNumber: o.orderNumber,
      status: o.status,
      total: o.total,
      itemCount: o.itemCount,
      createdAt: o.createdAt,
    })),
  })
}
