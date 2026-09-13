import { db } from '@/lib/db'
import { fail, ok, readValidated } from '@/lib/api-helpers'
import { getCartFromCookie } from '@/lib/cart'
import { checkoutInput } from '@/lib/validators'

/**
 * POST /api/checkout
 * Re-checks stock, atomically decrements it, snapshots order items,
 * creates a PAID order (dev placeholder payment), clears the cart
 * → 201 `{ order: { orderNumber, total } }`.
 */

const SHIPPING_RATES: Record<'standard' | 'express', number> = {
  standard: 3500,
  express: 7500,
}

class StockError extends Error {}

function stockMessage(name: string, size: string, color: string, stock: number): string {
  return `Only ${stock} left in stock for ${name} (${size}, ${color})`
}

export async function POST(req: Request) {
  const parsed = await readValidated(req, checkoutInput)
  if (!parsed.ok) return parsed.response
  const input = parsed.data

  const cart = await getCartFromCookie()
  if (!cart) return fail(404, 'Your cart is empty')

  const items = await db.cartItem.findMany({
    where: { cartId: cart.cartId },
    orderBy: { id: 'asc' },
    include: {
      variant: { include: { product: { include: { images: { orderBy: { position: 'asc' }, take: 1 } } } } },
    },
  })
  if (items.length === 0) return fail(404, 'Your cart is empty')

  // Pre-flight stock check (fail fast with the offending item).
  for (const item of items) {
    if (item.qty > item.variant.stock) {
      return fail(
        400,
        stockMessage(item.variant.product.name, item.variant.size, item.variant.color, item.variant.stock)
      )
    }
  }

  const subtotal = items.reduce((sum, i) => sum + i.variant.product.price * i.qty, 0)
  const shipping = SHIPPING_RATES[input.shippingMethod]
  const total = subtotal + shipping

  let orderNumber: string
  try {
    orderNumber = await db.$transaction(async (tx) => {
      // Atomically decrement stock — guarded by `stock >= qty`.
      for (const item of items) {
        const updated = await tx.productVariant.updateMany({
          where: { id: item.variantId, stock: { gte: item.qty } },
          data: { stock: { decrement: item.qty } },
        })
        if (updated.count !== 1) {
          throw new StockError(
            stockMessage(item.variant.product.name, item.variant.size, item.variant.color, item.variant.stock)
          )
        }
      }

      // Unique order number: SS-2026-XXXX (retry on collision).
      let created: { orderNumber: string } | null = null
      for (let attempt = 0; attempt < 20 && !created; attempt++) {
        const digits = attempt < 15 ? 4 : 6
        const candidate = `SS-2026-${String(Math.floor(Math.random() * 10 ** digits)).padStart(digits, '0')}`
        const clash = await tx.order.findUnique({ where: { orderNumber: candidate }, select: { id: true } })
        if (clash) continue
        const order = await tx.order.create({
          data: {
            orderNumber: candidate,
            email: input.email,
            fullName: input.fullName,
            phone: input.phone ?? null,
            address: input.address,
            city: input.city,
            state: input.state,
            notes: input.notes ?? null,
            shippingMethod: input.shippingMethod,
            shipping,
            subtotal,
            total,
            status: 'PAID',
          },
          select: { orderNumber: true, id: true },
        })
        await tx.orderItem.createMany({
          data: items.map((item) => ({
            orderId: order.id,
            variantId: item.variantId,
            productName: item.variant.product.name,
            productSlug: item.variant.product.slug,
            size: item.variant.size,
            color: item.variant.color,
            imageUrl: item.variant.product.images[0]?.url ?? null,
            unitPrice: item.variant.product.price,
            qty: item.qty,
          })),
        })
        created = order
      }
      if (!created) throw new Error('Could not allocate a unique order number')

      await tx.cartItem.deleteMany({ where: { cartId: cart.cartId } })
      return created.orderNumber
    })
  } catch (err) {
    if (err instanceof StockError) return fail(400, err.message)
    console.error('[api/checkout] transaction failed:', err)
    return fail(500, 'Checkout failed. Please try again.')
  }

  return ok({ order: { orderNumber, total } }, { status: 201 })
}
