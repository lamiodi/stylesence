/**
 * One-off receipt re-sender — for a PAID order whose settle-time email was
 * skipped (e.g. the gateway settled while RESEND_API_KEY was not yet
 * configured on the server). Reads the order through the public API so no
 * database access is needed, refuses anything that is not PAID, and sends
 * the exact same confirmation/receipt email the settlement flow sends.
 *
 * Usage (from backend/): npx tsx --env-file=.env scripts/resend-receipt.ts SS-2026-361117 buyer@example.com
 */
import { sendOrderConfirmationEmail } from '../lib/email'

async function main() {
  const [orderNumber, emailArg] = process.argv.slice(2)
  if (!orderNumber || !emailArg) {
    console.error('usage: npx tsx scripts/resend-receipt.ts <orderNumber> <email>')
    process.exit(1)
  }

  const res = await fetch(
    `https://www.stylesence.com/api/orders/${encodeURIComponent(orderNumber)}?email=${encodeURIComponent(emailArg)}`,
  )
  if (!res.ok) {
    console.error(`order fetch failed: ${res.status} — check the order number and email match`)
    process.exit(1)
  }
  const { order } = (await res.json()) as {
    order: {
      orderNumber: string
      status: string
      fullName: string
      email: string
      phone: string | null
      address: string
      city: string
      state: string
      shippingMethod: string
      shipping: number
      subtotal: number
      discount: number
      total: number
      items: {
        productName: string
        size: string
        color: string
        qty: number
        unitPrice: number
        imageUrl: string | null
      }[]
    }
  }

  if (order.status !== 'PAID') {
    console.error(`order is ${order.status}, not PAID — refusing to send a receipt`)
    process.exit(1)
  }

  const out = await sendOrderConfirmationEmail({
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
    items: order.items.map((i) => ({
      productName: i.productName,
      size: i.size,
      color: i.color,
      qty: i.qty,
      unitPrice: i.unitPrice,
      imageUrl: i.imageUrl,
    })),
  })
  console.log('receipt result:', JSON.stringify(out))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
