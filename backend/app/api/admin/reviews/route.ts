import { sql } from '@/lib/db'
import type { Review } from '@/lib/db-types'
import { fail, ok, toAdminReview } from '@/lib/api-helpers'
import { requireAdmin } from '@/lib/auth'

const REVIEW_STATUSES = ['PENDING', 'APPROVED', 'REJECTED']

/** GET /api/admin/reviews?status= — all (or filtered) reviews, newest first. */
export async function GET(req: Request) {
  const admin = await requireAdmin()
  if (!admin) return fail(401, 'Unauthorized')

  const status = new URL(req.url).searchParams.get('status')?.trim() || null
  if (status && !(REVIEW_STATUSES as string[]).includes(status)) {
    return fail(400, 'Invalid status filter')
  }

  const reviews = await sql<(Review & { product: { name: string; slug: string } })[]>`
    SELECT r.*, json_build_object('name', p.name, 'slug', p.slug) AS product
    FROM "Review" r
    JOIN "Product" p ON p.id = r."productId"
    ${status ? sql`WHERE r.status = ${status}` : sql``}
    ORDER BY r."createdAt" DESC
  `
  return ok({ reviews: reviews.map(toAdminReview) })
}
