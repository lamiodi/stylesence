import { db } from '@/lib/db'
import { fail, ok } from '@/lib/api-helpers'

/** GET /api/orders/[orderNumber] — public order lookup by order number. */
export async function GET(_req: Request, { params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params

  const order = await db.order.findUnique({
    where: { orderNumber },
    include: { items: { orderBy: { id: 'asc' } } },
  })
  if (!order) return fail(404, 'Order not found')

  return ok({
    order: {
      orderNumber: order.orderNumber,
      status: order.status,
      email: order.email,
      fullName: order.fullName,
      address: order.address,
      city: order.city,
      state: order.state,
      country: order.country,
      phone: order.phone,
      shippingMethod: order.shippingMethod,
      shipping: order.shipping,
      subtotal: order.subtotal,
      total: order.total,
      createdAt: order.createdAt,
      items: order.items.map((i) => ({
        productName: i.productName,
        productSlug: i.productSlug,
        size: i.size,
        color: i.color,
        imageUrl: i.imageUrl,
        unitPrice: i.unitPrice,
        qty: i.qty,
      })),
    },
  })
}
