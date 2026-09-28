import crypto from 'crypto'
import { db } from '@/lib/db'
import { sendOrderConfirmationEmail } from '@/lib/email'

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
      const amountPaid = typeof data?.amount === 'number' ? data.amount / 100 : null
      // Same currency (NGN kobo ↔ naira): require an exact match — a
      // percentage tolerance lets an attacker underpay deliberately.
      const amountOk =
        amountPaid === null || amountPaid === order.total

      if (amountOk) {
        await db.order.update({
          where: { id: order.id },
          data: {
            status: 'PAID',
            paymentReference: reference || order.paymentReference,
          },
        })

        sendOrderConfirmationEmail({
          orderNumber: order.orderNumber,
          fullName: order.fullName,
          email: order.email,
          phone: order.phone,
          address: order.address,
          city: order.city,
          state: order.state,
          shippingMethod: order.shippingMethod,
          shipping: order.shipping,
          subtotal: order.subtotal,
          discount: order.discount,
          total: order.total,
          items: order.items.map((item) => ({
            productName: item.productName,
            size: item.size,
            color: item.color,
            qty: item.qty,
            unitPrice: item.unitPrice,
            imageUrl: item.imageUrl,
          })),
        }).catch((err) =>
          console.error('[webhook/paystack] Failed to send order email:', err)
        )
      } else {
        console.error(
          `[webhook/paystack] Amount mismatch for order ${order.orderNumber}: expected ${order.total}, got ${amountPaid}`
        )
      }
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
