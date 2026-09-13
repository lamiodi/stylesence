import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { fail, ok, readValidated, toAdminProduct } from '@/lib/api-helpers'
import { requireAdmin } from '@/lib/auth'
import { productPatchInput } from '@/lib/validators'

/** Include shape used for admin product responses (module-private). */
const PRODUCT_INCLUDE = {
  category: { select: { slug: true, name: true } },
  images: { orderBy: { position: 'asc' as const } },
  variants: true,
  reviews: { select: { status: true } },
  curatedRelations: {
    orderBy: { position: 'asc' as const },
    select: { position: true, related: { select: { slug: true } } },
  },
} as const

/**
 * PATCH /api/admin/products/[id] — partial update (name, slug, subtitle, price,
 * compareAtPrice (null clears), isActive, isFeatured, categoryId, description,
 * material, care, details, variantStocks, relatedSlugs (curated "Complete the
 * look" set — replaced atomically; [] clears), images (media pipeline — full
 * replace, ≥1 required, position = order). Returns the full updated product
 * plus `notifiedStockAlerts` — waitlist entries marked notified by this PATCH
 * (variants whose stock went 0 → >0; the emails themselves are a dev placeholder).
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if (!admin) return fail(401, 'Unauthorized')

  const { id } = await params
  const parsed = await readValidated(req, productPatchInput)
  if (!parsed.ok) return parsed.response
  const input = parsed.data

  const existing = await db.product.findUnique({ where: { id }, select: { id: true, slug: true } })
  if (!existing) return fail(404, 'Product not found')

  if (input.slug !== undefined) {
    const clash = await db.product.findFirst({ where: { slug: input.slug, id: { not: id } } })
    if (clash) return fail(400, `Slug "${input.slug}" is already in use`)
  }
  if (input.categoryId) {
    const category = await db.category.findUnique({ where: { id: input.categoryId } })
    if (!category) return fail(400, 'Category not found')
  }

  // Curated "Complete the look" slugs — shape validation before anything is
  // written (existence is re-checked below, just before the replacement).
  if (input.relatedSlugs !== undefined) {
    const seen = new Set<string>()
    for (const slug of input.relatedSlugs) {
      if (seen.has(slug)) return fail(400, `"${slug}" appears more than once in the curated pieces`)
      seen.add(slug)
    }
    if (input.relatedSlugs.includes(existing.slug)) {
      return fail(400, 'A piece cannot be styled with itself in "Complete the look"')
    }
  }

  // Image set (media pipeline) — replace semantics; duplicate URLs rejected.
  if (input.images !== undefined) {
    const seenUrls = new Set<string>()
    for (const img of input.images) {
      if (seenUrls.has(img.url)) return fail(400, `Image URL "${img.url}" appears more than once`)
      seenUrls.add(img.url)
    }
  }

  const data: Prisma.ProductUncheckedUpdateInput = {}
  if (input.name !== undefined) data.name = input.name
  if (input.slug !== undefined) data.slug = input.slug
  if (input.subtitle !== undefined) data.subtitle = input.subtitle
  if (input.description !== undefined) data.description = input.description
  if (input.details !== undefined) data.details = input.details
  if (input.material !== undefined) data.material = input.material
  if (input.care !== undefined) data.care = input.care
  if (input.price !== undefined) data.price = input.price
  if (input.compareAtPrice !== undefined) data.compareAtPrice = input.compareAtPrice
  if (input.categoryId !== undefined) data.categoryId = input.categoryId
  if (input.isActive !== undefined) data.isActive = input.isActive
  if (input.isFeatured !== undefined) data.isFeatured = input.isFeatured

  let notifiedStockAlerts = 0
  if (input.variantStocks !== undefined) {
    // Read the current stocks first so 0 → >0 restock transitions can be
    // detected after the (ownership-guarded) updates land.
    const before = await db.productVariant.findMany({
      where: { productId: id },
      select: { id: true, stock: true },
    })
    const beforeById = new Map(before.map((v) => [v.id, v.stock]))

    for (const vs of input.variantStocks) {
      const updated = await db.productVariant.updateMany({
        where: { id: vs.id, productId: id },
        data: { stock: vs.stock },
      })
      if (updated.count === 0) {
        return fail(400, `Variant "${vs.id}" does not belong to this product`)
      }
    }

    // All updates succeeded — mark every un-notified waitlist entry on variants
    // that just came back into stock (the email itself is a dev placeholder).
    const restocked = input.variantStocks.filter(
      (vs) => beforeById.get(vs.id) === 0 && vs.stock > 0,
    )
    for (const vs of restocked) {
      const marked = await db.stockAlert.updateMany({
        where: { variantId: vs.id, notifiedAt: null },
        data: { notifiedAt: new Date() },
      })
      notifiedStockAlerts += marked.count
    }
    if (notifiedStockAlerts > 0) {
      console.log(`[api/admin/products] simulated back-in-stock email(s): ${notifiedStockAlerts}`)
    }
  }

  // Curated "Complete the look" relations — validated above, replaced below
  // (before the response is serialised) atomically: deleteMany + createMany
  // in one transaction. An empty array clears the set.
  if (input.relatedSlugs !== undefined) {
    const relatedSlugs = input.relatedSlugs

    if (relatedSlugs.length > 0) {
      const related = await db.product.findMany({
        where: { slug: { in: relatedSlugs } },
        select: { id: true, slug: true },
      })
      const bySlug = new Map(related.map((r) => [r.slug, r.id]))
      const missing = relatedSlugs.filter((slug) => !bySlug.has(slug))
      if (missing.length > 0) {
        return fail(400, `Unknown product slug${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`)
      }

      await db.$transaction([
        db.productRelation.deleteMany({ where: { productId: id } }),
        db.productRelation.createMany({
          data: relatedSlugs.map((slug, position) => ({
            productId: id,
            relatedId: bySlug.get(slug) as string,
            position,
          })),
        }),
      ])
    } else {
      await db.productRelation.deleteMany({ where: { productId: id } })
    }
  }

  // Image set (media pipeline) — validated above, replaced atomically below:
  // deleteMany + createMany with position = display order. The validator
  // enforces ≥1 image, so the gallery can never be emptied by a PATCH.
  if (input.images !== undefined) {
    await db.$transaction([
      db.productImage.deleteMany({ where: { productId: id } }),
      db.productImage.createMany({
        data: input.images.map((img, position) => ({
          productId: id,
          url: img.url,
          alt: img.alt?.trim() || null,
          position,
        })),
      }),
    ])
  }

  const product = await db.product.update({ where: { id }, data, include: PRODUCT_INCLUDE })
  return ok({ product: toAdminProduct(product), notifiedStockAlerts })
}

/** DELETE /api/admin/products/[id] — cascades images/variants/reviews/cart items. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if (!admin) return fail(401, 'Unauthorized')

  const { id } = await params
  const existing = await db.product.findUnique({ where: { id }, select: { id: true } })
  if (!existing) return fail(404, 'Product not found')

  await db.product.delete({ where: { id } })
  return ok({ ok: true })
}
