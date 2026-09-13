import { db } from '@/lib/db'
import { fail, ok } from '@/lib/api-helpers'
import { requireAdmin } from '@/lib/auth'

const WAITLIST_STATUSES = ['pending', 'notified'] as const

/** Row cap for the consolidated admin view — `truncated: true` is added to the
 *  response (only then) when the applicable set exceeds it. */
const MAX_ROWS = 500

/** Only the fields the admin waitlist panel needs — variant → product. */
const ROW_INCLUDE = {
  variant: {
    select: {
      size: true,
      color: true,
      stock: true,
      product: { select: { name: true, slug: true, isActive: true } },
    },
  },
} as const

/**
 * GET /api/admin/waitlist?status=pending|notified — consolidated back-in-stock
 * waitlist (StockAlert rows joined onto their variant + product).
 *
 * Ordering: pending rows (notifiedAt null) FIRST by createdAt asc (longest
 * waiting at the top — the actionable queue), then notified rows by notifiedAt
 * desc (most recently notified first). The optional `status` filter narrows the
 * set to one of those two groups; without it every row is returned in the
 * merged order above. Rows are capped at 500 per response — when the applicable
 * set (filtered group, or all rows without a filter) exceeds the cap the
 * response carries an extra `truncated: true` field; the field is absent
 * otherwise. `summary` counts are always computed from the FULL set (never the
 * truncated slice) so the panel's tiles and tab counts stay true.
 */
export async function GET(req: Request) {
  const admin = await requireAdmin()
  if (!admin) return fail(401, 'Unauthorized')

  const status = new URL(req.url).searchParams.get('status')?.trim() || null
  if (status && !(WAITLIST_STATUSES as readonly string[]).includes(status)) {
    return fail(400, 'Invalid status filter')
  }

  // Summary from the FULL set (two counts + distinct emails), regardless of filter or cap.
  const [pendingCount, notifiedCount, uniqueEmails] = await Promise.all([
    db.stockAlert.count({ where: { notifiedAt: null } }),
    db.stockAlert.count({ where: { notifiedAt: { not: null } } }),
    db.stockAlert.findMany({ select: { email: true }, distinct: ['email'] }).then((rows) => rows.length),
  ])
  const summary = {
    total: pendingCount + notifiedCount,
    pending: pendingCount,
    notified: notifiedCount,
    uniqueEmails,
  }

  // Rows in the merged order (pending first, oldest first; then notified, most recent first).
  let rows
  if (status === 'pending') {
    rows = await db.stockAlert.findMany({
      where: { notifiedAt: null },
      orderBy: { createdAt: 'asc' },
      take: MAX_ROWS,
      include: ROW_INCLUDE,
    })
  } else if (status === 'notified') {
    rows = await db.stockAlert.findMany({
      where: { notifiedAt: { not: null } },
      orderBy: [{ notifiedAt: 'desc' }, { createdAt: 'desc' }],
      take: MAX_ROWS,
      include: ROW_INCLUDE,
    })
  } else {
    const [pendingRows, notifiedRows] = await Promise.all([
      db.stockAlert.findMany({
        where: { notifiedAt: null },
        orderBy: { createdAt: 'asc' },
        take: MAX_ROWS,
        include: ROW_INCLUDE,
      }),
      db.stockAlert.findMany({
        where: { notifiedAt: { not: null } },
        orderBy: [{ notifiedAt: 'desc' }, { createdAt: 'desc' }],
        take: MAX_ROWS,
        include: ROW_INCLUDE,
      }),
    ])
    rows = [...pendingRows, ...notifiedRows].slice(0, MAX_ROWS)
  }

  const waitlist = rows.map((r) => ({
    id: r.id,
    email: r.email,
    createdAt: r.createdAt,
    notifiedAt: r.notifiedAt,
    productName: r.variant.product.name,
    productSlug: r.variant.product.slug,
    productActive: r.variant.product.isActive,
    variantId: r.variantId,
    size: r.variant.size,
    color: r.variant.color,
    stock: r.variant.stock,
  }))

  const applicableTotal =
    status === 'pending' ? summary.pending : status === 'notified' ? summary.notified : summary.total
  if (applicableTotal > MAX_ROWS) {
    return ok({ waitlist, summary, truncated: true })
  }
  return ok({ waitlist, summary })
}
