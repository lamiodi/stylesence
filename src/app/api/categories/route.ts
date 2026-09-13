import { db } from '@/lib/db'
import { ok } from '@/lib/api-helpers'

/** GET /api/categories — ordered by position asc, productCount = active products. */
export async function GET() {
  const categories = await db.category.findMany({
    orderBy: { position: 'asc' },
    include: { products: { where: { isActive: true }, select: { id: true } } },
  })
  return ok({
    categories: categories.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      tagline: c.tagline,
      imageUrl: c.imageUrl,
      productCount: c.products.length,
    })),
  })
}
