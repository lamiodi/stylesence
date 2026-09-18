import { fail, ok, readValidated } from '@/lib/api-helpers'
import { evaluatePromoStack } from '@/lib/promo'
import { promoValidateInput } from '@/lib/validators'

/**
 * POST /api/promo/validate
 * Body: { codes: string[] (1–2), subtotal, email? }
 * → { promos: AppliedPromo[], discount, freeShipping }
 *
 * Evaluates the whole applied stack: per-code rules (active, window, usage cap,
 * min subtotal, single-use per customer) plus stack rules when two codes are
 * present (both stackable; different type classes).
 */
export async function POST(req: Request) {
  const parsed = await readValidated(req, promoValidateInput)
  if (!parsed.ok) return parsed.response

  const result = await evaluatePromoStack(parsed.data.codes, parsed.data.subtotal, parsed.data.email)
  if (!result.ok) return fail(result.status, result.error)

  return ok({ promos: result.promos, discount: result.discount, freeShipping: result.freeShipping })
}
