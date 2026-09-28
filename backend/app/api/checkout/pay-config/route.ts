import { ok } from '@/lib/api-helpers'
import { paystackConfigured, stripeConfigured } from '@/lib/payments'

/**
 * GET /api/checkout/pay-config — which gateways are live. Booleans only; the
 * storefront uses this to show real payment options and route by country
 * (Paystack for African markets, Stripe elsewhere).
 */
export async function GET() {
  return ok({
    paystack: paystackConfigured(),
    stripe: stripeConfigured(),
  })
}
