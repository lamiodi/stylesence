import { sql } from '@/lib/db'
import { fail, ok } from '@/lib/api-helpers'
import { requireAdmin } from '@/lib/auth'

const WAITLIST_STATUSES = ['pending', 'notified'] as const

/** Row cap for the consolidated admin view — `truncated: true` is added to the
 *  response (only then) when the applicable set exceeds it. */
const MAX_ROWS = 500

/** Only the fields the admin waitlist panel needs — variant → product. */
type WaitlistRow = {
  id: string
  email: string
  createdAt: Date
  notifiedAt: Date | null
  variantId: string
  size: string
  color: string
  stock: number
  productName: string
  productSlug: string
  productActive: boolean
}

function selectRows(notifiedIsNull: boolean, order: ReturnType<typeof sql>) {
  return sql<WaitlistRow[]>`
    SELECT sa.id, sa.email, sa."createdAt", sa."notifiedAt",
           v.id AS "variantId", v.size, v.color, v.stock,
           p.name AS "productName", p.slug AS "productSlug", p."isActive" AS "productActive"
    FROM "StockAlert" sa
    JOIN "ProductVariant" v ON v.id = sa."variantId"
    JOIN "Product" p ON p.id = v."productId"
    WHERE ${notifiedIsNull ? sql`sa."notifiedAt" IS NULL` : sql`sa."notifiedAt" IS NOT NULL`}
    ORDER BY ${order}
    LIMIT ${MAX_ROWS}
  `
}

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
  const summaryRows = await sql<{ pending: number; notified: number; uniqueEmails: number }[]>`
    SELECT COUNT(*) FILTER (WHERE "notifiedAt" IS NULL)::int AS pending,
           COUNT(*) FILTER (WHERE "notifiedAt" IS NOT NULL)::int AS notified,
           COUNT(DISTINCT email)::int AS "uniqueEmails"
    FROM "StockAlert"
  `
  const summary = {
    total: summaryRows[0].pending + summaryRows[0].notified,
    pending: summaryRows[0].pending,
    notified: summaryRows[0].notified,
    uniqueEmails: summaryRows[0].uniqueEmails,
  }

  // Rows in the merged order (pending first, oldest first; then notified, most recent first).
  let rows: WaitlistRow[]
  if (status === 'pending') {
    rows = await selectRows(true, sql`sa."createdAt" ASC`)
  } else if (status === 'notified') {
    rows = await selectRows(false, sql`sa."notifiedAt" DESC, sa."createdAt" DESC`)
  } else {
    const [pendingRows, notifiedRows] = await Promise.all([
      selectRows(true, sql`sa."createdAt" ASC`),
      selectRows(false, sql`sa."notifiedAt" DESC, sa."createdAt" DESC`),
    ])
    rows = [...pendingRows, ...notifiedRows].slice(0, MAX_ROWS)
  }

  const waitlist = rows.map((r) => ({
    id: r.id,
    email: r.email,
    createdAt: r.createdAt,
    notifiedAt: r.notifiedAt,
    productName: r.productName,
    productSlug: r.productSlug,
    productActive: r.productActive,
    variantId: r.variantId,
    size: r.size,
    color: r.color,
    stock: r.stock,
  }))

  const applicableTotal =
    status === 'pending' ? summary.pending : status === 'notified' ? summary.notified : summary.total
  if (applicableTotal > MAX_ROWS) {
    return ok({ waitlist, summary, truncated: true })
  }
  return ok({ waitlist, summary })
}
