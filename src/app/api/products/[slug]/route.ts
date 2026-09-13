import { db } from '@/lib/db'
import { fail, isNewProduct, ok, orderSizes, orderVariantsBySizeColor, round1 } from '@/lib/api-helpers'

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

  // Related: up to 4 active products, same category (fallback: any), newest first.
  let relatedProducts: Array<{ slug: string; name: string; price: number; images: Array<{ url: string }> }> = []
  if (product.categoryId) {
    relatedProducts = await db.product.findMany({
      where: { isActive: true, id: { not: product.id }, categoryId: product.categoryId },
      orderBy: { createdAt: 'desc' },
      take: 4,
      include: { images: { orderBy: { position: 'asc' }, take: 1 } },
    })
  }
  if (relatedProducts.length === 0) {
    relatedProducts = await db.product.findMany({
      where: { isActive: true, id: { not: product.id } },
      orderBy: { createdAt: 'desc' },
      take: 4,
      include: { images: { orderBy: { position: 'asc' }, take: 1 } },
    })
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
      related: relatedProducts.map((p) => ({
        slug: p.slug,
        name: p.name,
        price: p.price,
        primaryImage: p.images[0]?.url ?? null,
        secondaryImage: p.images[1]?.url ?? null,
      })),
    },
  })
}
