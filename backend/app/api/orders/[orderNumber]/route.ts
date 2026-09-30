import { getOrderByNumber } from '@/lib/orders'
import { fail, ok } from '@/lib/api-helpers'
import { parseMeasurements } from '@/lib/cart'
import { paystackConfigured, stripeConfigured, verifyPaystack, verifyStripe } from '@/lib/payments'
import { settleGatewayPayment } from '@/lib/order-settle'

/**
 * GET /api/orders/[orderNumber]?email=… — order lookup by number.
 *
 * Full customer details (name, contact, address, body measurements, notes)
 * require the order's own email as verification; order numbers alone are
 * near-enumerable, so an unverified lookup gets a reduced tracking view:
 * status, totals and item summary only. The storefront tracking page works
 * on the reduced view; the post-payment receipt passes ?email= via the
 * gateway callback URL.
 *
 * Self-heal: bank transfer / USSD payments often never redirect back to the
 * site and webhooks can be missed — while a gateway order sits PENDING_PAYMENT,
 * every lookup re-checks the gateway by its stored reference and settles
 * (PAID + confirmation email) on a late confirmation. Best-effort: a gateway
 * hiccup never fails the lookup itself.
 */
export async function GET(req: Request, { params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params
  const email = new URL(req.url).searchParams.get('email')?.trim().toLowerCase() || ''

  const order = await getOrderByNumber(orderNumber)
  if (!order) return fail(404, 'Order not found')

  if (order.status === 'PENDING_PAYMENT' && order.paymentReference) {
    try {
      const result =
        order.paymentMethod === 'paystack' && paystackConfigured()
          ? await verifyPaystack(order.paymentReference)
          : order.paymentMethod === 'stripe' && stripeConfigured()
            ? await verifyStripe(order.paymentReference)
            : { paid: false, amountNaira: null }
      if (result.paid) {
        const outcome = await settleGatewayPayment(order, order.paymentReference, result.amountNaira)
        if (outcome === 'settled') order.status = 'PAID'
      }
    } catch (err) {
      console.error(`[api/orders] self-heal verification failed for ${orderNumber}:`, err)
    }
  }

  const verified = email !== '' && email === order.email.toLowerCase()

  return ok({
    order: {
      orderNumber: order.orderNumber,
      status: order.status,
      email: verified ? order.email : null,
      fullName: verified ? order.fullName : null,
      address: verified ? order.address : null,
      city: verified ? order.city : null,
      state: verified ? order.state : null,
      country: order.country,
      phone: verified ? order.phone : null,
      notes: verified ? order.notes : null,
      shippingMethod: order.shippingMethod,
      /** Payment rail — drives the retry-payment affordance on the order page. */
      paymentMethod: order.paymentMethod,
      shipping: order.shipping,
      subtotal: order.subtotal,
      discount: order.discount,
      promoCode: order.promoCode,
      promoCodes: order.promoCodes
        ? order.promoCodes.split(',').map((c) => c.trim()).filter(Boolean)
        : null,
      productionTier: order.productionTier === 'express' ? 'express' : 'standard',
      productionFee: order.productionFee,
      total: order.total,
      createdAt: order.createdAt,
      verified,
      items: order.items.map((i) => ({
        productName: i.productName,
        productSlug: i.productSlug,
        size: i.size,
        color: i.color,
        imageUrl: i.imageUrl,
        unitPrice: i.unitPrice,
        qty: i.qty,
        sizeMode: i.sizeMode === 'custom' ? 'custom' : 'standard',
        customMeasurements: verified ? parseMeasurements(i.customMeasurements) : null,
        notes: verified ? i.notes : null,
      })),
    },
  })
}
