import crypto from 'crypto'
import { db } from '@/lib/db'
import { settleGatewayPayment } from '@/lib/order-settle'

export async function GET() {
  return new Response(JSON.stringify({ status: 'active', gateway: 'paystack' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function POST(req: Request) {
  const secret = process.env.PAYSTACK_SECRET_KEY
  if (!secret) {
    console.error('[webhook/paystack] PAYSTACK_SECRET_KEY is not configured')
    return new Response('Webhook secret not configured', { status: 500 })
  }

  const rawBody = await req.text()
  const signature = req.headers.get('x-paystack-signature')

  const hash = crypto
    .createHmac('sha512', secret)
    .update(rawBody)
    .digest('hex')

  // Constant-time comparison — a plain !== leaks timing on the secret prefix.
  const sigBuffer = Buffer.from(signature ?? '', 'utf8')
  const hashBuffer = Buffer.from(hash, 'utf8')
  const signatureOk =
    sigBuffer.length === hashBuffer.length && crypto.timingSafeEqual(sigBuffer, hashBuffer)

  if (!signatureOk) {
    console.warn('[webhook/paystack] Invalid signature received')
    return new Response('Invalid signature', { status: 400 })
  }

  let event: { event?: string; data?: { reference?: string; amount?: number; metadata?: { orderNumber?: string } } } | null = null
  try {
    event = JSON.parse(rawBody)
  } catch (err) {
    return new Response('Invalid JSON payload', { status: 400 })
  }

  if (event?.event === 'charge.success') {
    const data = event.data
    const reference = data?.reference
    const orderNumber = data?.metadata?.orderNumber

    let order = null
    if (orderNumber) {
      order = await db.order.findUnique({
        where: { orderNumber },
        include: { items: true },
      })
    }
    if (!order && reference) {
      order = await db.order.findFirst({
        where: { paymentReference: reference },
        include: { items: true },
      })
    }

    if (order && order.status === 'PENDING_PAYMENT') {
      // Bank transfer / USSD payments often never redirect back to the site —
      // this webhook is the only signal they ever produce. settleGatewayPayment
      // amount-checks, flips the order PAID and sends the confirmation email
      // exactly once (guarded against the verify/self-heal paths racing in).
      const amountPaid = typeof data?.amount === 'number' ? data.amount / 100 : null
      await settleGatewayPayment(order, reference || order.paymentReference || '', amountPaid)
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
