import crypto from 'node:crypto'
import { cookies } from 'next/headers'
import type { NextResponse } from 'next/server'
import { db } from '@/lib/db'
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
  const cart = await db.cart.findUnique({ where: { cookieId }, select: { id: true } })
  if (!cart) return null
  return { cartId: cart.id, cookieId }
}

/** Read the cart cookie and return the cart, lazily creating the row (and a fresh uuid when needed). */
export async function getOrCreateCart(): Promise<{ cartId: string; cookieId: string }> {
  const jar = await cookies()
  const existing = jar.get(CART_COOKIE)?.value
  const cookieId = existing && CART_COOKIE_PATTERN.test(existing) ? existing : crypto.randomUUID()
  const cart = await db.cart.upsert({
    where: { cookieId },
    update: {},
    create: { cookieId },
  })
  return { cartId: cart.id, cookieId }
}

/**
 * Build the contract cart shape. Items are oldest-first
 * (CartItem has no createdAt column; cuid ids preserve insertion order).
 */
export async function buildCartPayload(cartId: string): Promise<CartPayload | null> {
  const cart = await db.cart.findUnique({
    where: { id: cartId },
    include: {
      items: {
        orderBy: { id: 'asc' },
        include: {
          variant: {
            include: { product: { include: { images: { orderBy: { position: 'asc' }, take: 1 } } } },
          },
        },
      },
    },
  })
  if (!cart) return null

  const items = cart.items.map((item) => ({
    id: item.id,
    qty: item.qty,
    variant: {
      id: item.variant.id,
      size: item.variant.size,
      color: item.variant.color,
      colorHex: item.variant.colorHex,
      stock: item.variant.stock,
    },
    product: {
      slug: item.variant.product.slug,
      name: item.variant.product.name,
      price: item.variant.product.price,
      primaryImage: item.variant.product.images[0]?.url ?? null,
    },
    sizeMode: (item.sizeMode === 'custom' ? 'custom' : 'standard') as 'standard' | 'custom',
    customMeasurements: parseMeasurements(item.customMeasurements),
    notes: item.notes,
  }))

  const subtotal = cart.items.reduce((sum, i) => sum + i.variant.product.price * i.qty, 0)
  const itemCount = cart.items.reduce((sum, i) => sum + i.qty, 0)
  return { items, subtotal, itemCount }
}

/** (Re-)set the `ss_cart` cookie on a response. */
export function setCartCookie(res: NextResponse, cookieId: string): void {
  res.cookies.set(CART_COOKIE, cookieId, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: CART_COOKIE_MAX_AGE,
    path: '/',
  })
}
