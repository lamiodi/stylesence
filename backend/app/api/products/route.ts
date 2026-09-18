import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { ok, isNewProduct, orderSizes, round1 } from '@/lib/api-helpers'

/**
 * GET /api/products
 * Query: category, q, size, color, minPrice, maxPrice,
 *        inStock ("1"/"true" — keep only products with ≥1 variant having stock > 0),
 *        sort (featured|newest|price-asc|price-desc|rating), page (1), perPage (12, max 48).
 * Only ACTIVE products. Facet base scope = category + q filters ONLY — inStock is a
 * user filter (like size/color/price), so facet counts and priceRange keep their
 * existing base-scope semantics and are NOT narrowed by it.
 */

const SORTS = ['featured', 'newest', 'price-asc', 'price-desc', 'rating'] as const
type Sort = (typeof SORTS)[number]

function parseIntParam(value: string | null): number | null {
  if (value === null || value.trim() === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

type CardSource = {
  id: string
  slug: string
  name: string
  subtitle: string | null
  price: number
  compareAtPrice: number | null
  isActive: boolean
  isFeatured: boolean
  createdAt: Date
  images: Array<{ url: string }>
  variants: Array<{ size: string; color: string; colorHex: string }>
  reviews: Array<{ rating: number }>
}

function toCard(product: CardSource) {
  const colorMap = new Map<string, string>()
  for (const v of product.variants) {
    if (!colorMap.has(v.color)) colorMap.set(v.color, v.colorHex)
  }
  const sizes = orderSizes(new Set(product.variants.map((v) => v.size)))
  const ratingCount = product.reviews.length
  const rating = ratingCount
    ? round1(product.reviews.reduce((sum, r) => sum + r.rating, 0) / ratingCount)
    : null
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    subtitle: product.subtitle,
    price: product.price,
    compareAtPrice: product.compareAtPrice,
    primaryImage: product.images[0]?.url ?? null,
    secondaryImage: product.images[1]?.url ?? null,
    colors: [...colorMap.entries()].map(([name, hex]) => ({ name, hex })),
    sizes,
    rating,
    reviewCount: ratingCount,
    isNew: isNewProduct(product.createdAt),
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const categorySlug = url.searchParams.get('category')?.trim() || null
  const q = url.searchParams.get('q')?.trim() || null
  const sizeFilter = url.searchParams.get('size')?.trim() || null
  const colorFilter = url.searchParams.get('color')?.trim() || null
  const minPrice = parseIntParam(url.searchParams.get('minPrice'))
  const maxPrice = parseIntParam(url.searchParams.get('maxPrice'))
  // "Ready to ship" — in-stock-only filter ("1" / "true" enable it; anything else is ignored).
  const inStockParam = (url.searchParams.get('inStock') ?? '').trim().toLowerCase()
  const inStockOnly = inStockParam === '1' || inStockParam === 'true'
  const sortParam = url.searchParams.get('sort')?.trim() || 'featured'
  const sort: Sort = (SORTS as readonly string[]).includes(sortParam) ? (sortParam as Sort) : 'featured'
  const page = Math.max(1, parseIntParam(url.searchParams.get('page')) ?? 1)
  const perPage = Math.min(48, Math.max(1, parseIntParam(url.searchParams.get('perPage')) ?? 12))

  // Base scope (facets): active + category + q only.
  const where: Prisma.ProductWhereInput = { isActive: true }
  if (categorySlug) where.category = { slug: categorySlug }
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { subtitle: { contains: q } },
      { description: { contains: q } },
    ]
  }

  const products = await db.product.findMany({
    where,
    include: {
      images: { orderBy: { position: 'asc' } },
      variants: true,
      reviews: { where: { status: 'APPROVED' }, select: { rating: true } },
    },
  })

  // Facets over the base scope.
  const colorCounts = new Map<string, { hex: string; count: number }>()
  const sizeCounts = new Map<string, number>()
  for (const p of products) {
    const seenColors = new Set<string>()
    const seenSizes = new Set<string>()
    for (const v of p.variants) {
      if (!seenColors.has(v.color)) {
        seenColors.add(v.color)
        const entry = colorCounts.get(v.color) ?? { hex: v.colorHex, count: 0 }
        entry.count += 1
        colorCounts.set(v.color, entry)
      }
      if (!seenSizes.has(v.size)) {
        seenSizes.add(v.size)
        sizeCounts.set(v.size, (sizeCounts.get(v.size) ?? 0) + 1)
      }
    }
  }
  const facets = {
    colors: [...colorCounts.entries()]
      .map(([name, { hex, count }]) => ({ name, hex, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    sizes: orderSizes(sizeCounts.keys()).map((size) => ({ size, count: sizeCounts.get(size) ?? 0 })),
    priceRange: {
      min: products.length ? Math.min(...products.map((p) => p.price)) : null,
      max: products.length ? Math.max(...products.map((p) => p.price)) : null,
    },
  }

  // User filters (size/color/price/inStock) applied on top of the base scope.
  let rows = products.map((product) => ({ product, card: toCard(product) }))
  if (inStockOnly) rows = rows.filter((r) => r.product.variants.some((v) => v.stock > 0))
  if (sizeFilter) rows = rows.filter((r) => r.product.variants.some((v) => v.size === sizeFilter))
  if (colorFilter) rows = rows.filter((r) => r.product.variants.some((v) => v.color === colorFilter))
  if (minPrice !== null) rows = rows.filter((r) => r.product.price >= minPrice)
  if (maxPrice !== null) rows = rows.filter((r) => r.product.price <= maxPrice)

  rows.sort((a, b) => {
    const createdDesc = b.product.createdAt.getTime() - a.product.createdAt.getTime()
    switch (sort) {
      case 'newest':
        return createdDesc
      case 'price-asc':
        return a.product.price - b.product.price || createdDesc
      case 'price-desc':
        return b.product.price - a.product.price || createdDesc
      case 'rating': {
        const ratingA = a.card.rating ?? -1
        const ratingB = b.card.rating ?? -1
        return ratingB - ratingA || b.card.reviewCount - a.card.reviewCount || createdDesc
      }
      default: // featured
        return Number(b.product.isFeatured) - Number(a.product.isFeatured) || createdDesc
    }
  })

  const total = rows.length
  const start = (page - 1) * perPage
  const pageProducts = rows.slice(start, start + perPage).map((r) => r.card)

  return ok({ products: pageProducts, total, page, perPage, facets })
}
