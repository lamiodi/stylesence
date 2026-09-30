import { sql, cuid, sqlIn, sqlJoin, sqlRaw } from '@/lib/db'
import { fail, ok, readValidated, toAdminProduct, bumpStorefrontCache } from '@/lib/api-helpers'
import { getAdminProductById } from '@/lib/admin-products'
import { requireAdmin } from '@/lib/auth'
import { generateSku } from '@/lib/sku'
import { productPatchInput } from '@/lib/validators'
import { galleryColorError } from '@/lib/gallery-colors'

/**
 * GET /api/admin/products/[id] — full admin product by id (the edit dialog reads
 * from the list endpoint, but future features get a canonical single fetch).
 * 404 `{ error: 'Product not found' }` when missing.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if (!admin) return fail(401, 'Unauthorized')

  const { id } = await params
  const product = await getAdminProductById(id)
  if (!product) return fail(404, 'Product not found')
  return ok({ product: toAdminProduct(product) })
}

/**
 * PATCH /api/admin/products/[id] — partial update (name, slug, subtitle, price,
 * compareAtPrice (null clears), isActive, isFeatured, categoryId, description,
 * material, care, details, variants (full-set edit: rows with id update, rows
 * without id create, missing ones delete — cart lines/waitlists cascade),
 * variantStocks (stock-only legacy path), relatedSlugs (curated "Complete the
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

  const existingRows = await sql<{ id: string; slug: string }[]>`
    SELECT id, slug FROM "Product" WHERE id = ${id} LIMIT 1
  `
  const existing = existingRows[0]
  if (!existing) return fail(404, 'Product not found')

  const currentGallery = await getAdminProductById(id)
  if (!currentGallery) return fail(404, 'Product not found')
  const gallery = input.images?.map(img => ({ ...img, color: img.color === undefined
    ? currentGallery.images.find(old => old.url === img.url)?.color ?? null : img.color }))
  const galleryError = galleryColorError(gallery ?? currentGallery.images, input.variants ?? currentGallery.variants)
  if (galleryError) return fail(400, galleryError)

  if (input.slug !== undefined) {
    const clash = await sql<{ id: string }[]>`
      SELECT id FROM "Product" WHERE slug = ${input.slug} AND id <> ${id} LIMIT 1
    `
    if (clash[0]) return fail(400, `Slug "${input.slug}" is already in use`)
  }
  if (input.categoryId) {
    const category = await sql<{ id: string }[]>`
      SELECT id FROM "Category" WHERE id = ${input.categoryId} LIMIT 1
    `
    if (!category[0]) return fail(400, 'Category not found')
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

  // Scalar column patch — fixed whitelist of column names, parameterized values.
  const fields: Array<[string, string | number | boolean | null]> = []
  if (input.name !== undefined) fields.push(['name', input.name])
  if (input.slug !== undefined) fields.push(['slug', input.slug])
  if (input.subtitle !== undefined) fields.push(['subtitle', input.subtitle])
  if (input.description !== undefined) fields.push(['description', input.description])
  if (input.details !== undefined) fields.push(['details', input.details])
  if (input.material !== undefined) fields.push(['material', input.material])
  if (input.care !== undefined) fields.push(['care', input.care])
  if (input.price !== undefined) fields.push(['price', input.price])
  if (input.compareAtPrice !== undefined) fields.push(['compareAtPrice', input.compareAtPrice])
  if (input.categoryId !== undefined) fields.push(['categoryId', input.categoryId])
  if (input.isActive !== undefined) fields.push(['isActive', input.isActive])
  if (input.isFeatured !== undefined) fields.push(['isFeatured', input.isFeatured])

  let notifiedStockAlerts = 0
  if (input.variants !== undefined) {
    // Full variant-set edit. Ownership + duplicates are validated up front so
    // the transaction below can update/delete by id alone; deleting a variant
    // cascades its cart lines and waitlist entries (orders keep snapshots).
    const currentVariants = await sql<{ id: string; stock: number }[]>`
      SELECT id, stock FROM "ProductVariant" WHERE "productId" = ${id}
    `
    const beforeById = new Map(currentVariants.map((v) => [v.id, v.stock]))

    const keepIds = new Set<string>()
    for (const row of input.variants) {
      if (row.id === undefined) continue
      if (!beforeById.has(row.id)) {
        return fail(400, `Variant "${row.id}" does not belong to this product`)
      }
      if (keepIds.has(row.id)) {
        return fail(400, 'A variant appears more than once in the set')
      }
      keepIds.add(row.id)
    }

    const updates = input.variants.filter(
      (row): row is typeof row & { id: string } => row.id !== undefined,
    )
    const creates = input.variants.filter((row) => row.id === undefined)
    const deleteIds = currentVariants.filter((v) => !keepIds.has(v.id)).map((v) => v.id)

    // New rows need globally-unique SKUs.
    let takenSkus = new Set<string>()
    if (creates.length > 0) {
      const skuRows = await sql<{ sku: string }[]>`SELECT sku FROM "ProductVariant"`
      takenSkus = new Set(skuRows.map((v) => v.sku))
    }

    await sql.begin(async (tx) => {
      if (deleteIds.length > 0) {
        await tx`DELETE FROM "ProductVariant" WHERE id IN ${sqlIn(deleteIds)}`
      }
      for (const u of updates) {
        await tx`
          UPDATE "ProductVariant" SET size = ${u.size}, color = ${u.color},
            "colorHex" = ${u.colorHex ?? '#EDE7DC'}, stock = ${u.stock}
          WHERE id = ${u.id}
        `
      }
      if (creates.length > 0) {
        const createRows = creates.map(
          (c) => sql`(${cuid()}, ${id}, ${c.size}, ${c.color}, ${c.colorHex ?? '#EDE7DC'},
            ${generateSku(c.color, c.size, takenSkus)}, ${c.stock})`,
        )
        await tx`
          INSERT INTO "ProductVariant" (id, "productId", size, color, "colorHex", sku, stock)
          VALUES ${sqlJoin(createRows, ', ')}
        `
      }
    })

    // All writes landed — mark every un-notified waitlist entry on variants
    // that just came back into stock (the email itself is a dev placeholder).
    const restocked = updates.filter((u) => beforeById.get(u.id) === 0 && u.stock > 0)
    for (const u of restocked) {
      const marked = await sql<{ id: string }[]>`
        UPDATE "StockAlert" SET "notifiedAt" = now()
        WHERE "variantId" = ${u.id} AND "notifiedAt" IS NULL
        RETURNING id
      `
      notifiedStockAlerts += marked.length
    }
    if (notifiedStockAlerts > 0) {
      console.log(`[api/admin/products] simulated back-in-stock email(s): ${notifiedStockAlerts}`)
    }
  } else if (input.variantStocks !== undefined) {
    // Legacy stock-only path — read the current stocks first so 0 → >0 restock
    // transitions can be detected after the (ownership-guarded) updates land.
    const before = await sql<{ id: string; stock: number }[]>`
      SELECT id, stock FROM "ProductVariant" WHERE "productId" = ${id}
    `
    const beforeById = new Map(before.map((v) => [v.id, v.stock]))

    for (const vs of input.variantStocks) {
      const updated = await sql<{ id: string }[]>`
        UPDATE "ProductVariant" SET stock = ${vs.stock}
        WHERE id = ${vs.id} AND "productId" = ${id}
        RETURNING id
      `
      if (updated.length === 0) {
        return fail(400, `Variant "${vs.id}" does not belong to this product`)
      }
    }

    // All updates succeeded — mark every un-notified waitlist entry on variants
    // that just came back into stock (the email itself is a dev placeholder).
    const restocked = input.variantStocks.filter(
      (vs) => beforeById.get(vs.id) === 0 && vs.stock > 0,
    )
    for (const vs of restocked) {
      const marked = await sql<{ id: string }[]>`
        UPDATE "StockAlert" SET "notifiedAt" = now()
        WHERE "variantId" = ${vs.id} AND "notifiedAt" IS NULL
        RETURNING id
      `
      notifiedStockAlerts += marked.length
    }
    if (notifiedStockAlerts > 0) {
      console.log(`[api/admin/products] simulated back-in-stock email(s): ${notifiedStockAlerts}`)
    }
  }

  // Curated "Complete the look" relations — validated above, replaced below
  // (before the response is serialised) atomically: delete + insert in one
  // transaction. An empty array clears the set.
  if (input.relatedSlugs !== undefined) {
    const relatedSlugs = input.relatedSlugs

    if (relatedSlugs.length > 0) {
      const related = await sql<{ id: string; slug: string }[]>`
        SELECT id, slug FROM "Product" WHERE slug IN ${sqlIn(relatedSlugs)}
      `
      const bySlug = new Map(related.map((r) => [r.slug, r.id]))
      const missing = relatedSlugs.filter((slug) => !bySlug.has(slug))
      if (missing.length > 0) {
        return fail(400, `Unknown product slug${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`)
      }

      await sql.begin(async (tx) => {
        await tx`DELETE FROM "ProductRelation" WHERE "productId" = ${id}`
        const rows = relatedSlugs.map(
          (slug, position) => sql`(${cuid()}, ${id}, ${bySlug.get(slug) as string}, ${position}, now())`,
        )
        await tx`
          INSERT INTO "ProductRelation" (id, "productId", "relatedId", position, "createdAt")
          VALUES ${sqlJoin(rows, ', ')}
        `
      })
    } else {
      await sql`DELETE FROM "ProductRelation" WHERE "productId" = ${id}`
    }
  }

  // Image set (media pipeline) — validated above, replaced atomically below:
  // delete + insert with position = display order. The validator enforces ≥1
  // image, so the gallery can never be emptied by a PATCH.
  if (input.images !== undefined) {
    const images = gallery!
    await sql.begin(async (tx) => {
      await tx`DELETE FROM "ProductImage" WHERE "productId" = ${id}`
      const rows = images.map(
        (img, position) => sql`(${cuid()}, ${id}, ${img.url}, ${img.alt?.trim() || null}, ${position}, ${img.color ?? null})`,
      )
      await tx`
        INSERT INTO "ProductImage" (id, "productId", url, alt, position, color)
        VALUES ${sqlJoin(rows, ', ')}
      `
    })
  }

  // Scalar patch always lands last (empty field set just refreshes updatedAt,
  // matching the previous Prisma update-include behaviour).
  const assignments = fields.map(
    ([col, val]) => sql`${sqlRaw(`"${col}"`)} = ${val}`,
  )
  await sql`
    UPDATE "Product" SET ${sqlJoin([...assignments, sql`"updatedAt" = now()`], ', ')}
    WHERE id = ${id}
  `

  const product = await getAdminProductById(id)
  if (!product) return fail(404, 'Product not found')

  bumpStorefrontCache()
  return ok({ product: toAdminProduct(product), notifiedStockAlerts })
}

/** DELETE /api/admin/products/[id] — cascades images/variants/reviews/cart items. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if (!admin) return fail(401, 'Unauthorized')

  const { id } = await params
  const existing = await sql<{ id: string }[]>`
    SELECT id FROM "Product" WHERE id = ${id} LIMIT 1
  `
  if (!existing[0]) return fail(404, 'Product not found')

  await sql`DELETE FROM "Product" WHERE id = ${id}`
  bumpStorefrontCache()
  return ok({ ok: true })
}
