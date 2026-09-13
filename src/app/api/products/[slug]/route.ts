import { db } from '@/lib/db'
import { fail, isNewProduct, ok, orderSizes, orderVariantsBySizeColor, round1 } from '@/lib/api-helpers'

/** Related slot count on the storefront PDP. */
const MAX_RELATED = 4

type RelatedProduct = {
  id: string
  slug: string
  name: string
  price: number
  images: Array<{ url: string }>
}

/**
 * GET /api/products/[slug] — full product detail.
 * 404 `{ error: 'Product not found' }` when missing or inactive.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const product = await db.product.findUnique({
    where: { slug },
    include: {
      category: true,
      images: { orderBy: { position: 'asc' } },
      variants: true,
      reviews: { where: { status: 'APPROVED' }, orderBy: { createdAt: 'desc' } },
    },
  })
  if (!product || !product.isActive) return fail(404, 'Product not found')

  // Related: curated "Complete the look" pieces first (admin-managed, ordered),
  // then same-category fill, then any active pieces — always up to 4 total.
  const relatedItems: Array<{
    slug: string
    name: string
    price: number
    primaryImage: string | null
    secondaryImage: string | null
  }> = []
  const includedIds = new Set<string>([product.id])
  let curatedCount = 0
  let anyFillCount = 0

  const pushRelated = (p: RelatedProduct) => {
    if (relatedItems.length >= MAX_RELATED || includedIds.has(p.id)) return false
    includedIds.add(p.id)
    relatedItems.push({
      slug: p.slug,
      name: p.name,
      price: p.price,
      primaryImage: p.images[0]?.url ?? null,
      secondaryImage: p.images[1]?.url ?? null,
    })
    return true
  }

  // 1. Curated relations (position asc; inactive related pieces are skipped).
  const curated = await db.productRelation.findMany({
    where: { productId: product.id, related: { isActive: true } },
    orderBy: { position: 'asc' },
    take: MAX_RELATED,
    include: { related: { include: { images: { orderBy: { position: 'asc' }, take: 2 } } } },
  })
  for (const row of curated) {
    if (pushRelated(row.related)) curatedCount++
  }

  // 2. Same-category fill (newest first, excluding already-included pieces).
  if (relatedItems.length < MAX_RELATED && product.categoryId) {
    const categoryFill: RelatedProduct[] = await db.product.findMany({
      where: { isActive: true, id: { notIn: [...includedIds] }, categoryId: product.categoryId },
      orderBy: { createdAt: 'desc' },
      take: MAX_RELATED - relatedItems.length,
      include: { images: { orderBy: { position: 'asc' }, take: 2 } },
    })
    for (const p of categoryFill) pushRelated(p)
  }

  // 3. Any active pieces when still short (newest first).
  if (relatedItems.length < MAX_RELATED) {
    const anyFill: RelatedProduct[] = await db.product.findMany({
      where: { isActive: true, id: { notIn: [...includedIds] } },
      orderBy: { createdAt: 'desc' },
      take: MAX_RELATED - relatedItems.length,
      include: { images: { orderBy: { position: 'asc' }, take: 2 } },
    })
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

  const variants = orderVariantsBySizeColor(product.variants)
  const colorMap = new Map<string, string>()
  for (const v of product.variants) {
    if (!colorMap.has(v.color)) colorMap.set(v.color, v.colorHex)
  }
  const reviewCount = product.reviews.length
  const rating = reviewCount
    ? round1(product.reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount)
    : null

  return ok({
    product: {
      id: product.id,
      slug: product.slug,
      name: product.name,
      subtitle: product.subtitle,
      price: product.price,
      compareAtPrice: product.compareAtPrice,
      primaryImage: product.images[0]?.url ?? null,
      colors: [...colorMap.entries()].map(([name, hex]) => ({ name, hex })),
      sizes: orderSizes(new Set(product.variants.map((v) => v.size))),
      rating,
      reviewCount,
      isNew: isNewProduct(product.createdAt),
      description: product.description,
      material: product.material,
      care: product.care,
      details: product.details
        ? product.details.split('\n').map((d) => d.trim()).filter(Boolean)
        : [],
      category: product.category ? { slug: product.category.slug, name: product.category.name } : null,
      images: product.images.map((img) => ({ url: img.url, alt: img.alt })),
      variants: variants.map((v) => ({
        id: v.id,
        size: v.size,
        color: v.color,
        colorHex: v.colorHex,
        stock: v.stock,
        sku: v.sku,
      })),
      reviews: product.reviews.map((r) => ({
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
  })
}
