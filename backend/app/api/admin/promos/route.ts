import { sql, cuid } from '@/lib/db'
import type { PromoCode } from '@/lib/db-types'
import { fail, ok, readValidated } from '@/lib/api-helpers'
import { requireAdmin } from '@/lib/auth'
import { promoInput } from '@/lib/validators'

/**
 * GET  /api/admin/promos — all codes, newest first.
 * POST /api/admin/promos — create a code (singleUsePerCustomer/stackable optional, default false).
 */
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return fail(401, 'Unauthorized')

  const promos = await sql<PromoCode[]>`
    SELECT * FROM "PromoCode" ORDER BY "createdAt" DESC
  `
  return ok({
    promos: promos.map((p) => ({
      id: p.id,
      code: p.code,
      label: p.label,
      type: p.type,
      value: p.value,
      minSubtotal: p.minSubtotal,
      maxUsage: p.maxUsage,
      usageCount: p.usageCount,
      singleUsePerCustomer: p.singleUsePerCustomer,
      stackable: p.stackable,
      isActive: p.isActive,
      expiresAt: p.expiresAt,
      createdAt: p.createdAt,
    })),
  })
}

export async function POST(req: Request) {
  const admin = await requireAdmin()
  if (!admin) return fail(401, 'Unauthorized')

  const parsed = await readValidated(req, promoInput)
  if (!parsed.ok) return parsed.response
  const input = parsed.data

  const clash = await sql<{ id: string }[]>`
    SELECT id FROM "PromoCode" WHERE code = ${input.code} LIMIT 1
  `
  if (clash[0]) return fail(400, `Code ${input.code} already exists.`)

  const rows = await sql<PromoCode[]>`
    INSERT INTO "PromoCode" (
      id, code, label, type, value, "minSubtotal", "maxUsage", "usageCount",
      "singleUsePerCustomer", stackable, "isActive", "expiresAt", "createdAt", "updatedAt"
    ) VALUES (
      ${cuid()}, ${input.code}, ${input.label ?? null}, ${input.type}, ${input.value},
      ${input.minSubtotal}, ${input.maxUsage ?? null}, 0,
      ${input.singleUsePerCustomer ?? false}, ${input.stackable ?? false}, ${input.isActive ?? true},
      ${input.expiresAt ?? null}, now(), now()
    )
    RETURNING *
  `
  const promo = rows[0]
  return ok({ promo }, { status: 201 })
}
