import { sql } from '@/lib/db'
import { fail, ok, round1 } from '@/lib/api-helpers'
import { requireAdmin } from '@/lib/auth'

const ORDER_STATUSES = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const
const DAY_MS = 24 * 60 * 60 * 1000

function utcDateKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/**
 * GET /api/admin/stats — dashboard aggregates:
 * revenue, orders (incl. 30-day series), products (+ low stock),
 * review moderation counts, subscribers, distinct customers,
 * and promo-code performance (order-derived usage + discount impact).
 */
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return fail(401, 'Unauthorized')

  const now = new Date()
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const windowStart = new Date(todayUtc.getTime() - 29 * DAY_MS) // 30 calendar days, oldest first

  type OrderRow = {
    orderNumber: string
    email: string
    fullName: string
    total: number
    status: string
    createdAt: Date
    promoCode: string | null
    promoCodes: string | null
    discount: number
    itemCount: number
  }
  const orders = await sql<OrderRow[]>`
    SELECT o."orderNumber", o.email, o."fullName", o.total, o.status, o."createdAt",
           o."promoCode", o."promoCodes", o.discount,
           (SELECT COALESCE(SUM(oi.qty), 0)::int FROM "OrderItem" oi WHERE oi."orderId" = o.id) AS "itemCount"
    FROM "Order" o
    ORDER BY o."createdAt" DESC
  `

  const nonCancelled = orders.filter((o) => o.status !== 'CANCELLED')
  const revenueTotal = nonCancelled.reduce((sum, o) => sum + o.total, 0)
  const revenueLast30 = nonCancelled
    .filter((o) => o.createdAt.getTime() >= windowStart.getTime())
    .reduce((sum, o) => sum + o.total, 0)

  const byStatus: Record<(typeof ORDER_STATUSES)[number], number> = {
    PAID: 0,
    PROCESSING: 0,
    SHIPPED: 0,
    DELIVERED: 0,
    CANCELLED: 0,
  }
  for (const o of orders) {
    if ((ORDER_STATUSES as readonly string[]).includes(o.status)) {
      byStatus[o.status as (typeof ORDER_STATUSES)[number]] += 1
    }
  }

  // 30-day series (oldest → newest). Revenue excludes CANCELLED; order count includes it.
  const series = new Map<string, { revenue: number; orders: number }>()
  for (let i = 0; i < 30; i++) {
    series.set(utcDateKey(new Date(windowStart.getTime() + i * DAY_MS)), { revenue: 0, orders: 0 })
  }
  for (const o of orders) {
    const entry = series.get(utcDateKey(o.createdAt))
    if (!entry) continue
    entry.orders += 1
    if (o.status !== 'CANCELLED') entry.revenue += o.total
  }
  const last30Series = [...series.entries()].map(([date, v]) => ({ date, ...v }))

  const recent = orders.slice(0, 8).map((o) => ({
    orderNumber: o.orderNumber,
    fullName: o.fullName,
    email: o.email,
    total: o.total,
    status: o.status,
    createdAt: o.createdAt,
    itemCount: o.itemCount,
  }))

  const productAgg = await sql<{ total: number; active: number }[]>`
    SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE "isActive")::int AS active
    FROM "Product"
  `
  const lowStock = await sql<{ productName: string; size: string; color: string; stock: number }[]>`
    SELECT p.name AS "productName", v.size, v.color, v.stock
    FROM "ProductVariant" v
    JOIN "Product" p ON p.id = v."productId"
    WHERE v.stock <= 3
    ORDER BY v.stock ASC, v.id ASC
    LIMIT 12
  `

  const reviews = await sql<{ status: string; rating: number }[]>`
    SELECT status, rating FROM "Review"
  `
  const approvedRatings = reviews.filter((r) => r.status === 'APPROVED').map((r) => r.rating)
  const avgRating = approvedRatings.length
    ? round1(approvedRatings.reduce((sum, r) => sum + r, 0) / approvedRatings.length)
    : null

  const subscriberRows = await sql<{ n: number }[]>`
    SELECT COUNT(*)::int AS n FROM "NewsletterSubscriber"
  `
  const subscribers = subscriberRows[0].n
  const customers = new Set(orders.map((o) => o.email)).size

  // Promo performance: order-derived usage (CANCELLED excluded from impact figures).
  // Stacked orders (Round 12) attribute ONE order to EACH applied code; the order's
  // discount value counts once per code (a shipping code contributes 0 by nature).
  const promoOrders = orders.filter(
    (o) => (o.promoCode || o.promoCodes) && o.status !== 'CANCELLED',
  )
  const promoDiscountTotal = promoOrders.reduce((sum, o) => sum + (o.discount ?? 0), 0)
  const promoByCode = new Map<string, { orderCount: number; discountTotal: number }>()
  for (const o of promoOrders) {
    const codes = new Set<string>()
    if (o.promoCode) codes.add(o.promoCode)
    if (o.promoCodes) for (const c of o.promoCodes.split(',')) codes.add(c.trim())
    for (const code of codes) {
      const entry = promoByCode.get(code) ?? { orderCount: 0, discountTotal: 0 }
      entry.orderCount += 1
      entry.discountTotal += o.discount ?? 0
      promoByCode.set(code, entry)
    }
  }
  const promoCodes = await sql<
    { code: string; label: string | null; type: string; value: number; usageCount: number; maxUsage: number | null; isActive: boolean }[]
  >`
    SELECT code, label, type, value, "usageCount", "maxUsage", "isActive"
    FROM "PromoCode"
    ORDER BY "usageCount" DESC
  `
  const promoTop = promoCodes
    .map((c) => ({
      code: c.code,
      label: c.label,
      type: c.type,
      value: c.value,
      usageCount: c.usageCount,
      maxUsage: c.maxUsage,
      isActive: c.isActive,
      orderCount: promoByCode.get(c.code)?.orderCount ?? 0,
      discountTotal: promoByCode.get(c.code)?.discountTotal ?? 0,
    }))
    .sort((a, b) => b.orderCount - a.orderCount || b.usageCount - a.usageCount)
    .slice(0, 6)

  return ok({
    revenue: { total: revenueTotal, last30: revenueLast30 },
    orders: {
      total: orders.length,
      byStatus,
      last30Series,
      recent,
    },
    products: {
      total: productAgg[0].total,
      active: productAgg[0].active,
      lowStock: lowStock.map((v) => ({
        productName: v.productName,
        variant: { size: v.size, color: v.color },
        stock: v.stock,
      })),
    },
    reviews: {
      pending: reviews.filter((r) => r.status === 'PENDING').length,
      approved: approvedRatings.length,
      avgRating,
    },
    subscribers,
    customers,
    promos: {
      activeCodes: promoCodes.filter((c) => c.isActive).length,
      totalCodes: promoCodes.length,
      ordersWithPromo: promoOrders.length,
      discountTotal: promoDiscountTotal,
      top: promoTop,
    },
  })
}
