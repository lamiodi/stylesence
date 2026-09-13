import { NextResponse } from 'next/server'
import type { z } from 'zod'
import type { Customer, Order, OrderItem, Product, ProductImage, ProductVariant, Review } from '@prisma/client'

/**
 * Shared helpers for the Style Sence JSON API.
 * All success payloads are wrapped in named keys; all errors are `{ error: message }`.
 */

/** Success JSON response helper. */
export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init)
}

/** Error JSON response helper — always `{ error: message }`. */
export function fail(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status })
}

/** Safely parse a JSON request body. Returns null when the body is not valid JSON. */
export async function parseJson(req: Request): Promise<unknown> {
  try {
    return (await req.json()) as unknown
  } catch {
    return null
  }
}

/** Turn the first zod issue into a human-readable message. */
function firstIssueMessage(error: z.ZodError): string {
  const issue = error.issues[0]
  if (!issue) return 'Invalid request body'
  const path = issue.path.map((p) => String(p)).join('.')
  if (issue.code === 'invalid_type' && issue.message.includes('received undefined')) {
    return path ? `Missing required field: ${path}` : 'Missing required field'
  }
  return issue.message
}

/** Parse + validate a JSON request body against a zod schema; on failure returns a ready 400 response. */
export async function readValidated<T>(
  req: Request,
  schema: z.ZodType<T>
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return { ok: false, response: fail(400, 'Request body must be valid JSON') }
  }
  const result = schema.safeParse(body)
  if (!result.success) {
    return { ok: false, response: fail(400, firstIssueMessage(result.error)) }
  }
  return { ok: true, data: result.data }
}

/* ------------------------------------------------------------------ *
 * Shared domain helpers (money is integer Naira throughout).
 * ------------------------------------------------------------------ */

/** Canonical apparel size order used across storefront + admin endpoints. */
export const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'One Size'] as const

export function sizeRank(size: string): number {
  const index = (SIZE_ORDER as readonly string[]).indexOf(size)
  return index === -1 ? SIZE_ORDER.length : index
}

/** Distinct sizes in canonical order (unknown sizes last, alphabetical). */
export function orderSizes(sizes: Iterable<string>): string[] {
  return [...sizes].sort((a, b) => sizeRank(a) - sizeRank(b) || a.localeCompare(b))
}

/** Variants ordered by canonical size, then color name. */
export function orderVariantsBySizeColor<T extends { size: string; color: string }>(variants: readonly T[]): T[] {
  return [...variants].sort((a, b) => sizeRank(a.size) - sizeRank(b.size) || a.color.localeCompare(b.color))
}

/** Round to one decimal place (used for average ratings). */
export function round1(value: number): number {
  return Math.round(value * 10) / 10
}

/** Lowercase hyphenated slug from arbitrary text. */
export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

/** "New" badge window: created within the last 21 days. */
export function isNewProduct(createdAt: Date): boolean {
  return createdAt.getTime() >= Date.now() - 21 * 24 * 60 * 60 * 1000
}

/* ------------------------------------------------------------------ *
 * Admin response shapes (shared between list + single + patch routes).
 * ------------------------------------------------------------------ */

export type AdminProductSource = Product & {
  category: { slug: string; name: string } | null
  images: ProductImage[]
  variants: ProductVariant[]
  reviews: { status: string }[]
  /** Outgoing curated "Complete the look" rows — only populated when included by the caller. */
  curatedRelations?: { position: number; related: { slug: string } }[] | null
}

/** Admin product shape: full fields + ordered images/variants + summed stock + review count + curated slugs. */
export function toAdminProduct(p: AdminProductSource) {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    subtitle: p.subtitle,
    description: p.description,
    details: p.details,
    material: p.material,
    care: p.care,
    price: p.price,
    compareAtPrice: p.compareAtPrice,
    isActive: p.isActive,
    isFeatured: p.isFeatured,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    category: p.category ? { slug: p.category.slug, name: p.category.name } : null,
    images: p.images.map((img) => ({ url: img.url, alt: img.alt, position: img.position })),
    variants: orderVariantsBySizeColor(p.variants).map((v) => ({
      id: v.id,
      size: v.size,
      color: v.color,
      colorHex: v.colorHex,
      stock: v.stock,
      sku: v.sku,
    })),
    stock: p.variants.reduce((sum, v) => sum + v.stock, 0),
    reviewCount: p.reviews.length,
    curatedRelated: (p.curatedRelations ?? []).map((rel) => rel.related.slug),
  }
}

/** Admin order shape: full order fields + line items. */
export function toAdminOrder(o: Order & { items: OrderItem[] }) {
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    email: o.email,
    fullName: o.fullName,
    phone: o.phone,
    address: o.address,
    city: o.city,
    state: o.state,
    country: o.country,
    notes: o.notes,
    shippingMethod: o.shippingMethod,
    shipping: o.shipping,
    subtotal: o.subtotal,
    discount: o.discount,
    promoCode: o.promoCode,
    total: o.total,
    status: o.status,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    items: o.items.map((i) => ({
      id: i.id,
      variantId: i.variantId,
      productName: i.productName,
      productSlug: i.productSlug,
      size: i.size,
      color: i.color,
      imageUrl: i.imageUrl,
      unitPrice: i.unitPrice,
      qty: i.qty,
    })),
  }
}

/** Admin review shape: full review fields + denormalised product name/slug. */
export function toAdminReview(r: Review & { product: { name: string; slug: string } }) {
  return {
    id: r.id,
    productId: r.productId,
    productName: r.product.name,
    productSlug: r.product.slug,
    author: r.author,
    email: r.email,
    rating: r.rating,
    title: r.title,
    body: r.body,
    status: r.status,
    createdAt: r.createdAt,
  }
}

/** Customer profile shape — safe fields only (never the password hash). */
export function toCustomerProfile(c: Customer) {
  return {
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    defaultAddress: c.defaultAddress,
    defaultCity: c.defaultCity,
    defaultState: c.defaultState,
    createdAt: c.createdAt,
  }
}
