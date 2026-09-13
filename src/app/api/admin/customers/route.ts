import { db } from '@/lib/db'
import { fail, ok } from '@/lib/api-helpers'
import { requireAdmin } from '@/lib/auth'

/**
 * GET /api/admin/customers — orders grouped by email:
 * { email, name (most recent fullName), orderCount, lifetimeValue, lastOrderAt }
 * sorted by lifetimeValue desc.
 */
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return fail(401, 'Unauthorized')

  const orders = await db.order.findMany({
    orderBy: { createdAt: 'asc' }, // ascending → last write wins = most recent
    select: { email: true, fullName: true, total: true, status: true, createdAt: true },
  })

  const map = new Map<
    string,
    { email: string; name: string; orderCount: number; lifetimeValue: number; lastOrderAt: Date }
  >()
  for (const o of orders) {
    const entry =
      map.get(o.email) ??
      { email: o.email, name: o.fullName, orderCount: 0, lifetimeValue: 0, lastOrderAt: o.createdAt }
    entry.name = o.fullName
    entry.orderCount += 1
    if (o.status !== 'CANCELLED') entry.lifetimeValue += o.total
    entry.lastOrderAt = o.createdAt
    map.set(o.email, entry)
  }

  const customers = [...map.values()].sort((a, b) => b.lifetimeValue - a.lifetimeValue)
  return ok({ customers })
}
