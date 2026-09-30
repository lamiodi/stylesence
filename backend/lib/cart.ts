import crypto from 'node:crypto'
import { cookies } from 'next/headers'
import type { NextResponse } from 'next/server'
import { sql, cuid } from '@/lib/db'
import type { CustomMeasurements } from '@/lib/types'

/**
 * Cart identity = httpOnly cookie `ss_cart` (uuid) -> Cart row (lazy-created).
 * Route handlers set the cookie on responses via `setCartCookie`.
 */

export const CART_COOKIE = 'ss_cart'
const CART_COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days
const CART_COOKIE_PATTERN = /^[A-Za-z0-9-]{8,64}$/

export type CartPayload = {
  items: Array<{
    id: string
    qty: number
    variant: { id: string; size: string; color: string; colorHex: string; stock: number }
    product: { slug: string; name: string; price: number; primaryImage: string | null }
    sizeMode: 'standard' | 'custom'
    customMeasurements: CustomMeasurements | null
    notes: string | null
  }>
  subtotal: number
  itemCount: number
}

/** Parse a stored measurements JSON column defensively — bad rows read as null, never crash a cart. */
export function parseMeasurements(raw: string | null | undefined): CustomMeasurements | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const out: CustomMeasurements = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'number' && Number.isFinite(value)) {
        out[key as keyof CustomMeasurements] = value
      }
    }
    return Object.keys(out).length > 0 ? out : null
  } catch {
    return null
  }
}

/** Read the cart cookie + look up the Cart row without creating anything. */
export async function getCartFromCookie(): Promise<{ cartId: string; cookieId: string } | null> {
  const jar = await cookies()
  const cookieId = jar.get(CART_COOKIE)?.value
  if (!cookieId || !CART_COOKIE_PATTERN.test(cookieId)) return null
  const rows = await sql<{ id: string }[]>`
    SELECT id FROM "Cart" WHERE "cookieId" = ${cookieId} LIMIT 1
  `
  if (!rows[0]) return null
  return { cartId: rows[0].id, cookieId }
}

/** Read the cart cookie and return the cart, lazily creating the row (and a fresh uuid when needed). */
export async function getOrCreateCart(): Promise<{ cartId: string; cookieId: string }> {
  const jar = await cookies()
  const existing = jar.get(CART_COOKIE)?.value
  const cookieId = existing && CART_COOKIE_PATTERN.test(existing) ? existing : crypto.randomUUID()
  const rows = await sql<{ id: string }[]>`
    INSERT INTO "Cart" (id, "cookieId", "createdAt", "updatedAt")
    VALUES (${cuid()}, ${cookieId}, now(), now())
    ON CONFLICT ("cookieId") DO UPDATE SET "updatedAt" = now()
    RETURNING id
  `
  return { cartId: rows[0].id, cookieId }
}

/**
 * Build the contract cart shape. Items are oldest-first
 * (CartItem has no createdAt column; cuid ids preserve insertion order).
 * One joined query: items + variant + product + first product image.
 */
export async function buildCartPayload(cartId: string): Promise<CartPayload | null> {
  const cartRows = await sql<{ id: string }[]>`
    SELECT id FROM "Cart" WHERE id = ${cartId} LIMIT 1
  `
  if (!cartRows[0]) return null

  type Row = {
    id: string
    qty: number
    sizeMode: string
    customMeasurements: string | null
    notes: string | null
    vId: string
    vSize: string
    vColor: string
    vColorHex: string
    vStock: number
    pSlug: string
    pName: string
    pPrice: number
    pImage: string | null
  }
  const rows = await sql<Row[]>`
    SELECT
      ci.id, ci.qty, ci."sizeMode", ci."customMeasurements", ci.notes,
      v.id AS "vId", v.size AS "vSize", v.color AS "vColor", v."colorHex" AS "vColorHex", v.stock AS "vStock",
      p.slug AS "pSlug", p.name AS "pName", p.price AS "pPrice",
      (SELECT pi.url FROM "ProductImage" pi WHERE pi."productId" = p.id ORDER BY pi.position ASC LIMIT 1) AS "pImage"
    FROM "CartItem" ci
    JOIN "ProductVariant" v ON v.id = ci."variantId"
    JOIN "Product" p ON p.id = v."productId"
    WHERE ci."cartId" = ${cartId}
    ORDER BY ci.id ASC
  `

  const items = rows.map((item) => ({
    id: item.id,
    qty: item.qty,
    variant: {
      id: item.vId,
      size: item.vSize,
      color: item.vColor,
      colorHex: item.vColorHex,
      stock: item.vStock,
    },
    product: {
      slug: item.pSlug,
      name: item.pName,
      price: item.pPrice,
      primaryImage: item.pImage,
    },
    sizeMode: (item.sizeMode === 'custom' ? 'custom' : 'standard') as 'standard' | 'custom',
    customMeasurements: parseMeasurements(item.customMeasurements),
    notes: item.notes,
  }))

  const subtotal = rows.reduce((sum, i) => sum + i.pPrice * i.qty, 0)
  const itemCount = rows.reduce((sum, i) => sum + i.qty, 0)
  return { items, subtotal, itemCount }
}

/** (Re-)set the `ss_cart` cookie on a response. */
export function setCartCookie(res: NextResponse, cookieId: string): void {
  res.cookies.set(CART_COOKIE, cookieId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: CART_COOKIE_MAX_AGE,
    path: '/',
  })
}
