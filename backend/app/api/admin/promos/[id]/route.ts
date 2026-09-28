import { db } from '@/lib/db'
import { fail, ok, readValidated } from '@/lib/api-helpers'
import { requireAdmin } from '@/lib/auth'
import { promoPatchInput } from '@/lib/validators'

/**
 * PATCH  /api/admin/promos/[id] — partial update (label, type, value, minSubtotal,
 * maxUsage, singleUsePerCustomer, isActive, expiresAt).
 * DELETE /api/admin/promos/[id] — remove the code.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if (!admin) return fail(401, 'Unauthorized')
  const { id } = await params

  const parsed = await readValidated(req, promoPatchInput)
  if (!parsed.ok) return parsed.response
  const input = parsed.data

  const existing = await db.promoCode.findUnique({ where: { id }, select: { id: true } })
  if (!existing) return fail(404, 'Promo code not found')

  try {
    const promo = await db.promoCode.update({ where: { id }, data: input })
    return ok({ promo })
  } catch {
    return fail(500, 'Could not update the code.')
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if (!admin) return fail(401, 'Unauthorized')
  const { id } = await params

  const existing = await db.promoCode.findUnique({ where: { id }, select: { id: true } })
  if (!existing) return fail(404, 'Promo code not found')

  await db.promoCode.delete({ where: { id } })
  return ok({ ok: true })
}
