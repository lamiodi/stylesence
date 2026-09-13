import { fail, ok, readValidated } from '@/lib/api-helpers'
import { evaluatePromo } from '@/lib/promo'
import { promoValidateInput } from '@/lib/validators'

/**
 * POST /api/promo/validate
 * Body: { code, subtotal } → { promo: { code, label, type, value, minSubtotal, discount, freeShipping } }
 * 404 unknown code; 400 inactive/expired/exhausted/min-subtotal rules.
 */
export async function POST(req: Request) {
  const parsed = await readValidated(req, promoValidateInput)
  if (!parsed.ok) return parsed.response

  const result = await evaluatePromo(parsed.data.code, parsed.data.subtotal)
  if (!result.ok) return fail(result.status, result.error)

  return ok({ promo: result.promo })
}
