import { db } from '@/lib/db'
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

  const reviews = await db.review.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: 'desc' },
    include: { product: { select: { name: true, slug: true } } },
  })
  return ok({ reviews: reviews.map(toAdminReview) })
}
