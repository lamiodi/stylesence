import { sql, sqlJoin } from '@/lib/db'
import { okCached, cachedJson, isNewProduct, orderSizes, round1 } from '@/lib/api-helpers'

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
  variants: Array<{ size: string; color: string; colorHex: string; stock: number }>
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

type ProductRow = {
  id: string
  slug: string
  name: string
  subtitle: string | null
  price: number
  compareAtPrice: number | null
  isActive: boolean
  isFeatured: boolean
  createdAt: Date
  images: Array<{ url: string }> | null
  variants: Array<{ size: string; color: string; colorHex: string; stock: number }> | null
  reviews: Array<{ rating: number }> | null
}

/** Base scope (facets): active + category + q only — one joined query, no N+1. */
async function loadBaseScope(categorySlug: string | null, q: string | null): Promise<CardSource[]> {
  const conds = [sql`p."isActive" = true`]
  if (categorySlug) {
    conds.push(sql`p."categoryId" = (SELECT id FROM "Category" c WHERE c.slug = ${categorySlug})`)
  }
  if (q) {
    const like = `%${q}%`
    conds.push(sql`(p.name LIKE ${like} OR p.subtitle LIKE ${like} OR p.description LIKE ${like})`)
  }
  const rows = await sql<ProductRow[]>`
    SELECT p.id, p.slug, p.name, p.subtitle, p.price, p."compareAtPrice",
           p."isActive", p."isFeatured", p."createdAt",
           (SELECT json_agg(src.*)
              FROM (SELECT pi.url FROM "ProductImage" pi WHERE pi."productId" = p.id ORDER BY pi.position ASC) src
           ) AS images,
           (SELECT json_agg(src.*)
              FROM (SELECT pv.size, pv.color, pv."colorHex", pv.stock
                    FROM "ProductVariant" pv WHERE pv."productId" = p.id) src
           ) AS variants,
           (SELECT json_agg(src.*)
              FROM (SELECT r.rating FROM "Review" r
                    WHERE r."productId" = p.id AND r.status = 'APPROVED') src
           ) AS reviews
    FROM "Product" p
    WHERE ${sqlJoin(conds, ' AND ')}
  `
  return rows.map((p) => ({
    ...p,
    images: p.images ?? [],
    variants: p.variants ?? [],
    reviews: p.reviews ?? [],
  }))
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

  // Base scope (facets): active + category + q only. Cached 60s in-process —
  // the key covers exactly the base-scope inputs (sort/page don't affect it).
  const products = await cachedJson(
    `products:${categorySlug ?? ''}:${q ?? ''}`,
    60_000,
    () => loadBaseScope(categorySlug, q),
  )

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

  return okCached({ products: pageProducts, total, page, perPage, facets })
}
