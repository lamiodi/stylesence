import { db } from '@/lib/db'
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
 * review moderation counts, subscribers and distinct customers.
 */
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return fail(401, 'Unauthorized')

  const now = new Date()
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const windowStart = new Date(todayUtc.getTime() - 29 * DAY_MS) // 30 calendar days, oldest first

  const orders = await db.order.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      orderNumber: true,
      email: true,
      fullName: true,
      total: true,
      status: true,
      createdAt: true,
      items: { select: { qty: true } },
    },
  })

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
    itemCount: o.items.reduce((sum, i) => sum + i.qty, 0),
  }))

  const products = await db.product.findMany({ select: { isActive: true } })
  const lowStock = await db.productVariant.findMany({
    where: { stock: { lte: 3 } },
    orderBy: [{ stock: 'asc' }, { id: 'asc' }],
    take: 12,
    include: { product: { select: { name: true } } },
  })

  const reviews = await db.review.findMany({ select: { status: true, rating: true } })
  const approvedRatings = reviews.filter((r) => r.status === 'APPROVED').map((r) => r.rating)
  const avgRating = approvedRatings.length
    ? round1(approvedRatings.reduce((sum, r) => sum + r, 0) / approvedRatings.length)
    : null

  const subscribers = await db.newsletterSubscriber.count()
  const customers = new Set(orders.map((o) => o.email)).size

  return ok({
    revenue: { total: revenueTotal, last30: revenueLast30 },
    orders: {
      total: orders.length,
      byStatus,
      last30Series,
      recent,
    },
    products: {
      total: products.length,
      active: products.filter((p) => p.isActive).length,
      lowStock: lowStock.map((v) => ({
        productName: v.product.name,
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
  })
}
