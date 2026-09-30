import { sql } from '@/lib/db'
import type { Review } from '@/lib/db-types'
import { bumpStorefrontCache, fail, ok, readValidated, toAdminReview } from '@/lib/api-helpers'
import { requireAdmin } from '@/lib/auth'
import { reviewPatchInput } from '@/lib/validators'

/** PATCH /api/admin/reviews/[id] `{status}` → `{ review }`. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if (!admin) return fail(401, 'Unauthorized')

  const { id } = await params
  const parsed = await readValidated(req, reviewPatchInput)
  if (!parsed.ok) return parsed.response

  const existing = await sql<{ id: string }[]>`
    SELECT id FROM "Review" WHERE id = ${id} LIMIT 1
  `
  if (!existing[0]) return fail(404, 'Review not found')

  const rows = await sql<Review[]>`
    UPDATE "Review" SET status = ${parsed.data.status} WHERE id = ${id} RETURNING *
  `
  const review = rows[0]
  const productRows = await sql<{ name: string; slug: string }[]>`
    SELECT name, slug FROM "Product" WHERE id = ${review.productId} LIMIT 1
  `
  // Moderation changes which reviews the storefront shows — drop its cache.
  bumpStorefrontCache()
  return ok({ review: toAdminReview({ ...review, product: productRows[0] }) })
}

/** DELETE /api/admin/reviews/[id] → `{ ok: true }`. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if (!admin) return fail(401, 'Unauthorized')

  const { id } = await params
  const existing = await sql<{ id: string }[]>`
    SELECT id FROM "Review" WHERE id = ${id} LIMIT 1
  `
  if (!existing[0]) return fail(404, 'Review not found')

  await sql`DELETE FROM "Review" WHERE id = ${id}`
  // Deleting a (possibly approved) review changes the storefront too.
  bumpStorefrontCache()
  return ok({ ok: true })
}
