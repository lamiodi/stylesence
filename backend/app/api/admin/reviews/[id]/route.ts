import { db } from '@/lib/db'
import { fail, ok, readValidated, toAdminReview } from '@/lib/api-helpers'
import { requireAdmin } from '@/lib/auth'
import { reviewPatchInput } from '@/lib/validators'

/** PATCH /api/admin/reviews/[id] `{status}` → `{ review }`. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if (!admin) return fail(401, 'Unauthorized')

  const { id } = await params
  const parsed = await readValidated(req, reviewPatchInput)
  if (!parsed.ok) return parsed.response

  const existing = await db.review.findUnique({ where: { id }, select: { id: true } })
  if (!existing) return fail(404, 'Review not found')

  const review = await db.review.update({
    where: { id },
    data: { status: parsed.data.status },
    include: { product: { select: { name: true, slug: true } } },
  })
  return ok({ review: toAdminReview(review) })
}

/** DELETE /api/admin/reviews/[id] → `{ ok: true }`. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if (!admin) return fail(401, 'Unauthorized')

  const { id } = await params
  const existing = await db.review.findUnique({ where: { id }, select: { id: true } })
  if (!existing) return fail(404, 'Review not found')

  await db.review.delete({ where: { id } })
  return ok({ ok: true })
}
