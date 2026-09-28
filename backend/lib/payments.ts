/**
 * Payment gateways — Paystack (African markets) and Stripe (international).
 *
 * Both are env-gated: with no keys configured every helper reports
 * unconfigured and checkout falls back to studio-confirmed payment. Calls go
 * straight to the gateways' REST APIs — no SDK dependency to ship.
 *
 * Env:
 *   PAYSTACK_SECRET_KEY   — sk_test_…/sk_live_… from paystack.com
 *   STRIPE_SECRET_KEY     — sk_test_…/sk_live_… from stripe.com
 *   STRIPE_CURRENCY       — presentment currency, default 'ngn'
 *   STRIPE_NAIRA_RATE     — currency units per ₦1 when currency ≠ ngn
 *                           (e.g. 0.00065 for USD at ₦1,540/$)
 */

const PAYSTACK_API = 'https://api.paystack.co'
const STRIPE_API = 'https://api.stripe.com/v1'

export function paystackConfigured(): boolean {
  return Boolean(process.env.PAYSTACK_SECRET_KEY)
}

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY)
}

export interface InitiatedPayment {
  reference: string
  authorizationUrl: string
}

/** Nigerian-market checkout — Paystack transaction initialize (amounts in kobo). */
export async function initiatePaystack(params: {
  orderNumber: string
  email: string
  amountNaira: number
  callbackUrl: string
}): Promise<InitiatedPayment> {
  const reference = `${params.orderNumber}_${Date.now().toString(36)}`
  const res = await fetch(`${PAYSTACK_API}/transaction/initialize`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: params.email,
      amount: params.amountNaira * 100,
      reference,
      callback_url: params.callbackUrl,
      metadata: { orderNumber: params.orderNumber, custom_fields: [] },
    }),
  })
  const body = await res.json().catch(() => null) as
    | { status?: boolean; message?: string; data?: { reference?: string; authorization_url?: string } }
    | null
  if (!res.ok || !body?.status || !body.data?.authorization_url || !body.data.reference) {
    throw new Error(body?.message ?? `Paystack initialization failed (${res.status})`)
  }
  return { reference: body.data.reference, authorizationUrl: body.data.authorization_url }
}

/** Verify a Paystack transaction by reference. */
export async function verifyPaystack(reference: string): Promise<{ paid: boolean; amountNaira: number | null }> {
  const res = await fetch(`${PAYSTACK_API}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
  })
  const body = await res.json().catch(() => null) as
    | { status?: boolean; data?: { status?: string; amount?: number } }
    | null
  if (!res.ok || !body?.status) return { paid: false, amountNaira: null }
  return {
    paid: body.data?.status === 'success',
    amountNaira: typeof body.data?.amount === 'number' ? body.data.amount / 100 : null,
  }
}

/** Smallest-unit amount + currency for a Stripe session from a Naira total. */
function stripeAmount(amountNaira: number): { currency: string; unitAmount: number } {
  const currency = (process.env.STRIPE_CURRENCY ?? 'ngn').toLowerCase()
  if (currency === 'ngn') return { currency, unitAmount: amountNaira * 100 }
  const rate = Number(process.env.STRIPE_NAIRA_RATE ?? 0)
  if (!Number.isFinite(rate) || rate <= 0) throw new Error('STRIPE_NAIRA_RATE must be set when STRIPE_CURRENCY is not ngn')
  return { currency, unitAmount: Math.max(50, Math.round(amountNaira * rate * 100)) }
}

/** International checkout — Stripe Checkout Session (one line: the order total). */
export async function initiateStripe(params: {
  orderNumber: string
  email: string
  amountNaira: number
  successUrl: string
  cancelUrl: string
}): Promise<InitiatedPayment> {
  const { currency, unitAmount } = stripeAmount(params.amountNaira)
  const form = new URLSearchParams({
    mode: 'payment',
    customer_email: params.email,
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    client_reference_id: params.orderNumber,
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': currency,
    'line_items[0][price_data][unit_amount]': String(unitAmount),
    'line_items[0][price_data][product_data][name]': `Style Sence — order ${params.orderNumber}`,
    'metadata[orderNumber]': params.orderNumber,
  })
  const res = await fetch(`${STRIPE_API}/checkout/sessions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  })
  const body = await res.json().catch(() => null) as
    | { error?: { message?: string }; id?: string; url?: string }
    | null
  if (!res.ok || !body?.url || !body.id) {
    throw new Error(body?.error?.message ?? `Stripe session failed (${res.status})`)
  }
  return { reference: body.id, authorizationUrl: body.url }
}

/** Verify a Stripe Checkout Session by id. */
export async function verifyStripe(sessionId: string): Promise<{ paid: boolean; amountNaira: number | null }> {
  const res = await fetch(`${STRIPE_API}/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
  })
  const body = await res.json().catch(() => null) as
    | { payment_status?: string; amount_total?: number; currency?: string }
    | null
  if (!res.ok || !body) return { paid: false, amountNaira: null }
  let amountNaira: number | null = null
  if (typeof body.amount_total === 'number') {
    const currency = (body.currency ?? 'ngn').toLowerCase()
    if (currency === 'ngn') amountNaira = body.amount_total / 100
    else {
      const rate = Number(process.env.STRIPE_NAIRA_RATE ?? 0)
      amountNaira = rate > 0 ? body.amount_total / 100 / rate : null
    }
  }
  return { paid: body.payment_status === 'paid', amountNaira }
}
