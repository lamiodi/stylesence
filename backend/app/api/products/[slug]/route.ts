import { sql, sqlIn, sqlJoin } from '@/lib/db'
import { cachedJson, fail, isNewProduct, okCached, orderSizes, orderVariantsBySizeColor, round1 } from '@/lib/api-helpers'

/** Related slot count on the storefront PDP. */
const MAX_RELATED = 4

type RelatedProduct = {
  id: string
  slug: string
  name: string
  price: number
  images: Array<{ url: string }>
  variants: Array<{ id: string; size: string; color: string; stock: number }>
}

type RelatedRow = Omit<RelatedProduct, 'images' | 'variants'> & {
  images: Array<{ url: string }> | null
  variants: Array<{ id: string; size: string; color: string; stock: number }> | null
}

/** Normalise a related-pieces row (json_agg yields null for empty sets). */
function toRelatedProduct(r: RelatedRow): RelatedProduct {
  return { ...r, images: r.images ?? [], variants: r.variants ?? [] }
}

/** Active fill products (newest first): first-two images + all variants. */
async function fetchRelatedProducts(
  excludeIds: readonly string[],
  categoryId: string | null,
  take: number,
): Promise<RelatedProduct[]> {
  const conds = [sql`p."isActive" = true`]
  if (excludeIds.length > 0) conds.push(sql`p.id NOT IN ${sqlIn([...excludeIds])}`)
  if (categoryId !== null) conds.push(sql`p."categoryId" = ${categoryId}`)
  const rows = await sql<RelatedRow[]>`
    SELECT
      p.id, p.slug, p.name, p.price,
      (SELECT json_agg(json_build_object('url', src.url) ORDER BY src.position ASC)
        FROM (SELECT url, position FROM "ProductImage" WHERE "productId" = p.id ORDER BY position ASC LIMIT 2) src
      ) AS images,
      (SELECT json_agg(json_build_object('id', v.id, 'size', v.size, 'color', v.color, 'stock', v.stock) ORDER BY v.id ASC)
        FROM "ProductVariant" v WHERE v."productId" = p.id
      ) AS variants
    FROM "Product" p
    WHERE ${sqlJoin(conds, ' AND ')}
    ORDER BY p."createdAt" DESC
    LIMIT ${take}
  `
  return rows.map(toRelatedProduct)
}

/**
 * GET /api/products/[slug] — full product detail.
 * 404 `{ error: 'Product not found' }` when missing or inactive.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const body = await cachedJson(`product:${slug}`, 60_000, () => loadProductDetail(slug))
  if (!body) return fail(404, 'Product not found')
  return okCached(body)
}

async function loadProductDetail(slug: string) {
  const rows = await sql<{
    id: string
    slug: string
    name: string
    subtitle: string | null
    description: string
    details: string | null
    material: string | null
    care: string | null
    price: number
    compareAtPrice: number | null
    categoryId: string | null
    isActive: boolean
    isFeatured: boolean
    createdAt: Date
    categorySlug: string | null
    categoryName: string | null
    images: Array<{ url: string; alt: string | null; color: string | null }> | null
    variants: Array<{ id: string; size: string; color: string; colorHex: string; sku: string; stock: number }> | null
  }[]>`
    SELECT
      p.id, p.slug, p.name, p.subtitle, p.description, p.details, p.material, p.care,
      p.price, p."compareAtPrice", p."categoryId", p."isActive", p."isFeatured", p."createdAt",
      c.slug AS "categorySlug", c.name AS "categoryName",
      (SELECT json_agg(json_build_object('url', pi.url, 'alt', pi.alt, 'color', pi.color) ORDER BY pi.position ASC)
        FROM "ProductImage" pi WHERE pi."productId" = p.id) AS images,
      (SELECT json_agg(json_build_object('id', v.id, 'size', v.size, 'color', v.color, 'colorHex', v."colorHex", 'sku', v.sku, 'stock', v.stock) ORDER BY v.id ASC)
        FROM "ProductVariant" v WHERE v."productId" = p.id) AS variants
    FROM "Product" p
    LEFT JOIN "Category" c ON c.id = p."categoryId"
    WHERE p.slug = ${slug}
    LIMIT 1
  `
  const product = rows[0]
  if (!product || !product.isActive) return null

  const images = product.images ?? []
  const variants = product.variants ?? []
  const category =
    product.categorySlug !== null ? { slug: product.categorySlug, name: product.categoryName ?? '' } : null
  const reviews = await sql<
    { id: string; author: string; rating: number; title: string | null; body: string; createdAt: Date }[]
  >`
    SELECT id, author, rating, title, body, "createdAt"
    FROM "Review"
    WHERE "productId" = ${product.id} AND status = 'APPROVED'
    ORDER BY "createdAt" DESC
  `

  // Related: curated "Complete the look" pieces first (admin-managed, ordered),
  // then same-category fill, then any active pieces — always up to 4 total.
  // Each related item carries a defaultVariantId (first in-stock variant in the
  // canonical size/colour order) so the PDP can offer "Add the look to bag".
  const relatedItems: Array<{
    slug: string
    name: string
    price: number
    primaryImage: string | null
    secondaryImage: string | null
    defaultVariantId: string | null
    inStock: boolean
  }> = []
  const includedIds = new Set<string>([product.id])
  let curatedCount = 0
  let anyFillCount = 0

  const pushRelated = (p: RelatedProduct) => {
    if (relatedItems.length >= MAX_RELATED || includedIds.has(p.id)) return false
    includedIds.add(p.id)
    const ordered = orderVariantsBySizeColor(p.variants)
    const defaultVariant = ordered.find((v) => v.stock > 0) ?? null
    relatedItems.push({
      slug: p.slug,
      name: p.name,
      price: p.price,
      primaryImage: p.images[0]?.url ?? null,
      secondaryImage: p.images[1]?.url ?? null,
      defaultVariantId: defaultVariant?.id ?? null,
      inStock: defaultVariant !== null,
    })
    return true
  }

  // 1. Curated relations (position asc; inactive related pieces are skipped).
  const curatedRows = await sql<RelatedRow[]>`
    SELECT
      r.id, r.slug, r.name, r.price,
      (SELECT json_agg(json_build_object('url', src.url) ORDER BY src.position ASC)
        FROM (SELECT url, position FROM "ProductImage" WHERE "productId" = r.id ORDER BY position ASC LIMIT 2) src
      ) AS images,
      (SELECT json_agg(json_build_object('id', v.id, 'size', v.size, 'color', v.color, 'stock', v.stock) ORDER BY v.id ASC)
        FROM "ProductVariant" v WHERE v."productId" = r.id
      ) AS variants
    FROM "ProductRelation" pr
    JOIN "Product" r ON r.id = pr."relatedId"
    WHERE pr."productId" = ${product.id} AND r."isActive" = true
    ORDER BY pr.position ASC
    LIMIT ${MAX_RELATED}
  `
  const curated = curatedRows.map(toRelatedProduct)
  for (const row of curated) {
    if (pushRelated(row)) curatedCount++
  }

  // 2. Same-category fill (newest first, excluding already-included pieces).
  if (relatedItems.length < MAX_RELATED && product.categoryId) {
    const categoryFill = await fetchRelatedProducts(
      [...includedIds],
      product.categoryId,
      MAX_RELATED - relatedItems.length,
    )
    for (const p of categoryFill) pushRelated(p)
  }

  // 3. Any active pieces when still short (newest first).
  if (relatedItems.length < MAX_RELATED) {
    const anyFill = await fetchRelatedProducts([...includedIds], null, MAX_RELATED - relatedItems.length)
    for (const p of anyFill) {
      if (pushRelated(p)) anyFillCount++
    }
  }

  let relatedSource: 'curated' | 'mixed' | 'category' | 'any'
  if (curatedCount > 0 && curatedCount === relatedItems.length) {
    relatedSource = 'curated'
  } else if (curatedCount > 0) {
    relatedSource = 'mixed'
  } else if (anyFillCount > 0) {
    relatedSource = 'any'
  } else {
    relatedSource = 'category'
  }

  const orderedVariants = orderVariantsBySizeColor(variants)
  const colorMap = new Map<string, string>()
  for (const v of variants) {
    if (!colorMap.has(v.color)) colorMap.set(v.color, v.colorHex)
  }
  const reviewCount = reviews.length
  const rating = reviewCount
    ? round1(reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount)
    : null

  return {
    product: {
      id: product.id,
      slug: product.slug,
      name: product.name,
      subtitle: product.subtitle,
      price: product.price,
      compareAtPrice: product.compareAtPrice,
      primaryImage: images[0]?.url ?? null,
      colors: [...colorMap.entries()].map(([name, hex]) => ({ name, hex })),
      sizes: orderSizes(new Set(variants.map((v) => v.size))),
      rating,
      reviewCount,
      isNew: isNewProduct(product.createdAt),
      description: product.description,
      material: product.material,
      care: product.care,
      details: product.details
        ? product.details.split('\n').map((d) => d.trim()).filter(Boolean)
        : [],
      category,
      images: images.map((img) => ({ url: img.url, alt: img.alt, color: img.color ?? null })),
      variants: orderedVariants.map((v) => ({
        id: v.id,
        size: v.size,
        color: v.color,
        colorHex: v.colorHex,
        stock: v.stock,
        sku: v.sku,
      })),
      reviews: reviews.map((r) => ({
        id: r.id,
        author: r.author,
        rating: r.rating,
        title: r.title,
        body: r.body,
        createdAt: r.createdAt,
      })),
      related: relatedItems,
      relatedSource,
    },
  }
}
