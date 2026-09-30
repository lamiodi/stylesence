import { sql, sqlJoin } from '@/lib/db'
import type { PromoCode } from '@/lib/db-types'
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

  const existing = await sql<{ id: string }[]>`
    SELECT id FROM "PromoCode" WHERE id = ${id} LIMIT 1
  `
  if (!existing[0]) return fail(404, 'Promo code not found')

  try {
    const sets = [sql`"updatedAt" = now()`]
    if (input.label !== undefined) sets.push(sql`label = ${input.label}`)
    if (input.type !== undefined) sets.push(sql`type = ${input.type}`)
    if (input.value !== undefined) sets.push(sql`value = ${input.value}`)
    if (input.minSubtotal !== undefined) sets.push(sql`"minSubtotal" = ${input.minSubtotal}`)
    if (input.maxUsage !== undefined) sets.push(sql`"maxUsage" = ${input.maxUsage}`)
    if (input.singleUsePerCustomer !== undefined) {
      sets.push(sql`"singleUsePerCustomer" = ${input.singleUsePerCustomer}`)
    }
    if (input.stackable !== undefined) sets.push(sql`stackable = ${input.stackable}`)
    if (input.isActive !== undefined) sets.push(sql`"isActive" = ${input.isActive}`)
    if (input.expiresAt !== undefined) sets.push(sql`"expiresAt" = ${input.expiresAt}`)
    const rows = await sql<PromoCode[]>`
      UPDATE "PromoCode" SET ${sqlJoin(sets, ', ')} WHERE id = ${id} RETURNING *
    `
    const promo = rows[0]
    return ok({ promo })
  } catch {
    return fail(500, 'Could not update the code.')
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if (!admin) return fail(401, 'Unauthorized')
  const { id } = await params

  const existing = await sql<{ id: string }[]>`
    SELECT id FROM "PromoCode" WHERE id = ${id} LIMIT 1
  `
  if (!existing[0]) return fail(404, 'Promo code not found')

  await sql`DELETE FROM "PromoCode" WHERE id = ${id}`
  return ok({ ok: true })
}
