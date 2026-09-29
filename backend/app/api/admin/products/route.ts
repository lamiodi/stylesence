import { db } from '@/lib/db'
import { fail, ok, readValidated, slugify, toAdminProduct } from '@/lib/api-helpers'
import { requireAdmin } from '@/lib/auth'
import { generateSku } from '@/lib/sku'
import { productInput } from '@/lib/validators'

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

/** List include — additionally counts un-notified back-in-stock waitlist entries per variant. */
const PRODUCT_LIST_INCLUDE = {
  ...PRODUCT_INCLUDE,
  variants: {
    include: {
      _count: { select: { stockAlerts: { where: { notifiedAt: null } } } },
    },
  },
} as const

/** GET /api/admin/products — ALL products (incl. inactive), newest first. */
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return fail(401, 'Unauthorized')

  const products = await db.product.findMany({
    orderBy: { createdAt: 'desc' },
    include: PRODUCT_LIST_INCLUDE,
  })
  return ok({ products: products.map(toAdminProduct) })
}

/** POST /api/admin/products — create with images + variants; auto slug + SKUs. */
export async function POST(req: Request) {
  const admin = await requireAdmin()
  if (!admin) return fail(401, 'Unauthorized')

  const parsed = await readValidated(req, productInput)
  if (!parsed.ok) return parsed.response
  const input = parsed.data

  // Category (optional) must exist when provided.
  let categoryId: string | null = null
  if (input.categoryId) {
    const category = await db.category.findUnique({ where: { id: input.categoryId } })
    if (!category) return fail(400, 'Category not found')
    categoryId = category.id
  }

  // Slug: explicit (must be free) or generated from the name (suffixed when taken).
  let slug = input.slug ?? slugify(input.name)
  if (!slug) return fail(400, 'Could not derive a slug from the name — please provide one')
  if (await db.product.findUnique({ where: { slug } })) {
    if (input.slug) return fail(400, `Slug "${slug}" is already in use`)
    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate = `${slug}-${Math.random().toString(36).slice(2, 6)}`
      if (!(await db.product.findUnique({ where: { slug: candidate } }))) {
        slug = candidate
        break
      }
    }
    if (await db.product.findUnique({ where: { slug } })) {
      return fail(409, 'Could not generate a unique slug — please provide one')
    }
  }

  // Unique SKUs for the new variants.
  const takenSkus = new Set((await db.productVariant.findMany({ select: { sku: true } })).map((v) => v.sku))

  const product = await db.product.create({
    data: {
      name: input.name,
      slug,
      subtitle: input.subtitle ?? null,
      description: input.description,
      details: input.details ?? null,
      material: input.material ?? null,
      care: input.care ?? null,
      price: input.price,
      compareAtPrice: input.compareAtPrice ?? null,
      categoryId,
      isActive: input.isActive ?? true,
      isFeatured: input.isFeatured ?? false,
      images: {
        create: (input.images ?? []).map((img, position) => ({
          url: img.url,
          alt: img.alt ?? null,
          position,
        })),
      },
      variants: {
        create: (input.variants ?? []).map((v) => ({
          size: v.size,
          color: v.color,
          colorHex: v.colorHex ?? '#EDE7DC',
          stock: v.stock,
          sku: generateSku(v.color, v.size, takenSkus),
        })),
      },
    },
    include: PRODUCT_INCLUDE,
  })

  return ok({ product: toAdminProduct(product) }, { status: 201 })
}
