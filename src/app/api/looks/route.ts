import { db } from '@/lib/db'
import { ok } from '@/lib/api-helpers'
import type { LookPiece, LookView } from '@/lib/types'

/**
 * GET /api/looks — editorial "Shop the look" rows for the home page.
 * Anchors are products whose admin-curated "Complete the look" relations
 * (ProductRelation) yield at least one active partner; ordered by partner
 * count, then recency. Topped up to 3 with featured pieces (category
 * fallback for their partners) so the section always has content.
 * Each look's pieces[0] is the anchor itself.
 */

const MAX_LOOKS = 3
const MAX_PARTNERS = 3

type AnchorRow = {
  slug: string
  name: string
  subtitle: string | null
  price: number
  categoryName: string | null
  primaryImage: string | null
  partners: LookPiece[]
}

function toLook(anchor: AnchorRow, source: LookView['source']): LookView {
  return {
    slug: anchor.slug,
    title: anchor.name,
    subtitle: anchor.subtitle,
    categoryName: anchor.categoryName,
    image: anchor.primaryImage,
    pieces: [{ slug: anchor.slug, name: anchor.name, price: anchor.price }, ...anchor.partners.slice(0, MAX_PARTNERS)],
    source,
  }
}

export async function GET() {
  // 1) Curated anchors: active products with at least one active curated partner.
  const curated = await db.product.findMany({
    where: { isActive: true, curatedRelations: { some: {} } },
    include: {
      images: { orderBy: { position: 'asc' }, take: 1, select: { url: true } },
      category: { select: { name: true } },
      curatedRelations: {
        orderBy: { position: 'asc' },
        include: {
          related: {
            select: {
              slug: true,
              name: true,
              price: true,
              isActive: true,
              images: { orderBy: { position: 'asc' }, take: 1, select: { url: true } },
            },
          },
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  })

  const curatedAnchors: AnchorRow[] = curated
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      subtitle: p.subtitle,
      price: p.price,
      categoryName: p.category?.name ?? null,
      primaryImage: p.images[0]?.url ?? null,
      // Curated order preserved; inactive partners are filtered at read time.
      partners: p.curatedRelations
        .filter((r) => r.related.isActive)
        .map((r) => ({ slug: r.related.slug, name: r.related.name, price: r.related.price })),
    }))
    .filter((a) => a.partners.length > 0)

  curatedAnchors.sort((a, b) => b.partners.length - a.partners.length)

  const looks: LookView[] = curatedAnchors.slice(0, MAX_LOOKS).map((a) => toLook(a, 'curated'))

  // 2) Featured top-up when curation runs short (partners = same category).
  if (looks.length < MAX_LOOKS) {
    const usedSlugs = new Set(looks.map((l) => l.slug))
    const featured = await db.product.findMany({
      where: { isActive: true, slug: { notIn: [...usedSlugs] } },
      include: {
        images: { orderBy: { position: 'asc' }, take: 1, select: { url: true } },
        category: { select: { name: true } },
      },
      orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
    })

    for (const p of featured) {
      if (looks.length >= MAX_LOOKS) break
      const partners = p.categoryId
        ? await db.product.findMany({
            where: { isActive: true, categoryId: p.categoryId, slug: { not: p.slug } },
            select: { slug: true, name: true, price: true },
            orderBy: { createdAt: 'desc' },
            take: MAX_PARTNERS,
          })
        : []
      // Only fall back to category partners — a look without partners isn't a look.
      if (partners.length === 0) continue
      looks.push(
        toLook(
          {
            slug: p.slug,
            name: p.name,
            subtitle: p.subtitle,
            price: p.price,
            categoryName: p.category?.name ?? null,
            primaryImage: p.images[0]?.url ?? null,
            partners,
          },
          'featured',
        ),
      )
    }
  }

  return ok({ looks, total: looks.length })
}
