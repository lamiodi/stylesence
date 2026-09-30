import { sql, cuid } from '@/lib/db'
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
  const { variantId, qty, sizeMode, customMeasurements, notes } = parsed.data

  const variantRows = await sql<{ stock: number; productIsActive: boolean }[]>`
    SELECT v.stock, p."isActive" AS "productIsActive"
    FROM "ProductVariant" v
    JOIN "Product" p ON p.id = v."productId"
    WHERE v.id = ${variantId}
    LIMIT 1
  `
  const variant = variantRows[0]
  if (!variant || !variant.productIsActive) return fail(404, 'Variant not found')
  if (qty > variant.stock) return fail(400, `Only ${variant.stock} left in stock`)

  const { cartId, cookieId } = await getOrCreateCart()

  // Round 13 made-to-order lines: a custom line merges only with the SAME
  // custom line (identical measurements + notes on the same variant);
  // a standard add merges only with a standard line. Different measurements,
  // or a standard + custom mix on one variant, coexist as separate rows
  // (the Round-13 schema dropped the unique(cartId, variantId) index).
  const isCustom = sizeMode === 'custom' && customMeasurements !== undefined
  const measurementsJson = isCustom ? JSON.stringify(customMeasurements) : null
  const notesValue = notes ?? null

  const matchLine = isCustom
    ? sql`AND "sizeMode" = 'custom' AND "customMeasurements" = ${measurementsJson} AND ${
        notesValue === null ? sql`notes IS NULL` : sql`notes = ${notesValue}`
      }`
    : sql`AND "sizeMode" = 'standard'`
  const existingRows = await sql<{ id: string; qty: number }[]>`
    SELECT id, qty FROM "CartItem"
    WHERE "cartId" = ${cartId} AND "variantId" = ${variantId}
    ${matchLine}
    ORDER BY id DESC
    LIMIT 1
  `
  const existing = existingRows[0]

  if (existing) {
    // Merge: cap the combined quantity at available stock.
    const capped = Math.min(existing.qty + qty, variant.stock)
    await sql`UPDATE "CartItem" SET qty = ${capped} WHERE id = ${existing.id}`
  } else {
    await sql`
      INSERT INTO "CartItem" (id, "cartId", "variantId", qty, "sizeMode", "customMeasurements", notes)
      VALUES (${cuid()}, ${cartId}, ${variantId}, ${qty}, ${isCustom ? 'custom' : 'standard'}, ${measurementsJson}, ${notesValue})
    `
  }

  return respondWithCart(cartId, cookieId)
}

export async function PATCH(req: Request) {
  const parsed = await readValidated(req, cartPatchInput)
  if (!parsed.ok) return parsed.response
  const { itemId, qty } = parsed.data

  const cart = await getCartFromCookie()
  if (!cart) return fail(404, 'Cart not found')

  const itemRows = await sql<{ id: string; cartId: string; stock: number }[]>`
    SELECT ci.id, ci."cartId", v.stock
    FROM "CartItem" ci
    JOIN "ProductVariant" v ON v.id = ci."variantId"
    WHERE ci.id = ${itemId}
    LIMIT 1
  `
  const item = itemRows[0]
  if (!item || item.cartId !== cart.cartId) return fail(404, 'Item not found')

  if (qty === 0) {
    await sql`DELETE FROM "CartItem" WHERE id = ${item.id}`
  } else {
    if (qty > item.stock) return fail(400, `Only ${item.stock} left in stock`)
    await sql`UPDATE "CartItem" SET qty = ${qty} WHERE id = ${item.id}`
  }

  return respondWithCart(cart.cartId, cart.cookieId)
}

export async function DELETE(req: Request) {
  const url = new URL(req.url)
  const itemId = url.searchParams.get('itemId')?.trim() || null
  const clear = url.searchParams.get('clear')

  const cart = await getCartFromCookie()
  if (!cart && !(clear === '1' || clear === 'true')) return fail(404, 'Cart not found')

  if (clear === '1' || clear === 'true') {
    // Idempotent wipe: a session without a cart simply gets a fresh empty one.
    const target = cart ?? (await getOrCreateCart())
    await sql`DELETE FROM "CartItem" WHERE "cartId" = ${target.cartId}`
    return respondWithCart(target.cartId, target.cookieId)
  }

  // The clear branch returned above, so a session reaching here has a cart —
  // the guard simply makes that narrowing visible to TypeScript.
  if (!cart) return fail(404, 'Cart not found')

  if (!itemId) return fail(400, 'Provide itemId or clear=1')

  const itemRows = await sql<{ id: string; cartId: string }[]>`
    SELECT id, "cartId" FROM "CartItem" WHERE id = ${itemId} LIMIT 1
  `
  const item = itemRows[0]
  if (!item || item.cartId !== cart.cartId) return fail(404, 'Item not found')
  await sql`DELETE FROM "CartItem" WHERE id = ${item.id}`

  return respondWithCart(cart.cartId, cart.cookieId)
}
