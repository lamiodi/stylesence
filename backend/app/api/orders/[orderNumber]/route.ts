import { db } from '@/lib/db'
import { fail, ok } from '@/lib/api-helpers'
import { parseMeasurements } from '@/lib/cart'

/**
 * GET /api/orders/[orderNumber]?email=… — order lookup by number.
 *
 * Full customer details (name, contact, address, body measurements, notes)
 * require the order's own email as verification; order numbers alone are
 * near-enumerable, so an unverified lookup gets a reduced tracking view:
 * status, totals and item summary only. The storefront tracking page works
 * on the reduced view; the post-payment receipt passes ?email= via the
 * gateway callback URL.
 */
export async function GET(req: Request, { params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params
  const email = new URL(req.url).searchParams.get('email')?.trim().toLowerCase() || ''

  const order = await db.order.findUnique({
    where: { orderNumber },
    include: { items: { orderBy: { id: 'asc' } } },
  })
  if (!order) return fail(404, 'Order not found')

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
