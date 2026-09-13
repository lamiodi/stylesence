import { db } from '@/lib/db'
import { fail, ok, readValidated } from '@/lib/api-helpers'
import { requireAdmin } from '@/lib/auth'
import { promoInput } from '@/lib/validators'

/**
 * GET  /api/admin/promos — all codes, newest first.
 * POST /api/admin/promos — create a code (singleUsePerCustomer optional, default false).
 */
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return fail(401, 'Unauthorized')

  const promos = await db.promoCode.findMany({ orderBy: { createdAt: 'desc' } })
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

  const clash = await db.promoCode.findUnique({ where: { code: input.code }, select: { id: true } })
  if (clash) return fail(400, `Code ${input.code} already exists.`)

  const promo = await db.promoCode.create({
    data: {
      code: input.code,
      label: input.label ?? null,
      type: input.type,
      value: input.value,
      minSubtotal: input.minSubtotal,
      maxUsage: input.maxUsage ?? null,
      singleUsePerCustomer: input.singleUsePerCustomer ?? false,
      isActive: input.isActive ?? true,
      expiresAt: input.expiresAt ?? null,
    },
  })
  return ok({ promo }, { status: 201 })
}
