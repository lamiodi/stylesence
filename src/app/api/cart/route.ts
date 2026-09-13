import { db } from '@/lib/db'
import { fail, ok, readValidated } from '@/lib/api-helpers'
import { buildCartPayload, getCartFromCookie, getOrCreateCart, setCartCookie } from '@/lib/cart'
import { cartAddInput, cartPatchInput } from '@/lib/validators'

/**
 * /api/cart — cart identity lives in the httpOnly `ss_cart` cookie (lazy-created).
 * GET     → current cart (creates + sets cookie when absent)
 * POST    {variantId, qty 1-10}  → add / merge (capped at stock)
 * PATCH   {itemId, qty}          → set qty (0 removes)
 * DELETE  ?itemId= | ?clear=1    → remove one / wipe
 * Every response returns the fresh cart shape.
 */

async function respondWithCart(cartId: string, cookieId: string, status = 200) {
  const payload = await buildCartPayload(cartId)
  if (!payload) return fail(404, 'Cart not found')
  const res = ok({ cart: payload }, { status })
  setCartCookie(res, cookieId)
  return res
}

export async function GET() {
  const { cartId, cookieId } = await getOrCreateCart()
  return respondWithCart(cartId, cookieId)
}

export async function POST(req: Request) {
  const parsed = await readValidated(req, cartAddInput)
  if (!parsed.ok) return parsed.response
  const { variantId, qty } = parsed.data

  const variant = await db.productVariant.findUnique({
    where: { id: variantId },
    include: { product: { select: { isActive: true } } },
  })
  if (!variant || !variant.product.isActive) return fail(404, 'Variant not found')
  if (qty > variant.stock) return fail(400, `Only ${variant.stock} left in stock`)

  const { cartId, cookieId } = await getOrCreateCart()

  const existing = await db.cartItem.findUnique({
    where: { cartId_variantId: { cartId, variantId } },
  })
  if (existing) {
    // Merge: cap the combined quantity at available stock.
    const capped = Math.min(existing.qty + qty, variant.stock)
    await db.cartItem.update({ where: { id: existing.id }, data: { qty: capped } })
  } else {
    await db.cartItem.create({ data: { cartId, variantId, qty } })
  }

  return respondWithCart(cartId, cookieId)
}

export async function PATCH(req: Request) {
  const parsed = await readValidated(req, cartPatchInput)
  if (!parsed.ok) return parsed.response
  const { itemId, qty } = parsed.data

  const cart = await getCartFromCookie()
  if (!cart) return fail(404, 'Cart not found')

  const item = await db.cartItem.findUnique({ where: { id: itemId }, include: { variant: true } })
  if (!item || item.cartId !== cart.cartId) return fail(404, 'Item not found')

  if (qty === 0) {
    await db.cartItem.delete({ where: { id: item.id } })
  } else {
    if (qty > item.variant.stock) return fail(400, `Only ${item.variant.stock} left in stock`)
    await db.cartItem.update({ where: { id: item.id }, data: { qty } })
  }

  return respondWithCart(cart.cartId, cart.cookieId)
}

export async function DELETE(req: Request) {
  const url = new URL(req.url)
  const itemId = url.searchParams.get('itemId')?.trim() || null
  const clear = url.searchParams.get('clear')

  const cart = await getCartFromCookie()
  if (!cart) return fail(404, 'Cart not found')

  if (clear === '1' || clear === 'true') {
    await db.cartItem.deleteMany({ where: { cartId: cart.cartId } })
    return respondWithCart(cart.cartId, cart.cookieId)
  }

  if (!itemId) return fail(400, 'Provide itemId or clear=1')

  const item = await db.cartItem.findUnique({ where: { id: itemId } })
  if (!item || item.cartId !== cart.cartId) return fail(404, 'Item not found')
  await db.cartItem.delete({ where: { id: item.id } })

  return respondWithCart(cart.cartId, cart.cookieId)
}
