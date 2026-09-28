import { fail, ok, readValidated } from '@/lib/api-helpers'
import { evaluatePromoStack } from '@/lib/promo'
import { promoValidateInput } from '@/lib/validators'

/**
 * POST /api/promo/validate
 * Body: { codes: string[] (1), subtotal, email? }
 * → { promos: AppliedPromo[], discount }
 *
 * Evaluates the applied code: per-code rules (active, window, usage cap,
 * min subtotal, single-use per customer).
 */
export async function POST(req: Request) {
  const parsed = await readValidated(req, promoValidateInput)
  if (!parsed.ok) return parsed.response

  const result = await evaluatePromoStack(parsed.data.codes, parsed.data.subtotal, parsed.data.email)
  if (!result.ok) return fail(result.status, result.error)

  return ok({ promos: result.promos, discount: result.discount })
}
