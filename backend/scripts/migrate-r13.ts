/**
 * Round 13 migration — made-to-order feature set.
 * Run once: bun scripts/migrate-r13.ts
 * Idempotent: skips anything that already exists; never touches orders,
 * customers, carts or promo usage. Adds:
 *   1. "Two-Piece Sets" category (positioned after Dresses)
 *   2. Three two-piece-set products (images pre-generated) with XS–XXL
 *   3. XXL variants for every existing apparel product (per colour)
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const IVORY = { name: 'Ivory', hex: '#EDE7DC' }
const CHARCOAL = { name: 'Charcoal', hex: '#35322D' }
const ESPRESSO = { name: 'Espresso', hex: '#4B3A32' }
const CHAMPAGNE = { name: 'Champagne', hex: '#D8CBB2' }
const APPAREL_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL']

type ColorDef = { name: string; hex: string }

type NewProduct = {
  slug: string
  name: string
  subtitle: string
  description: string
  details: string[]
  material: string
  care: string
  price: number
  colors: ColorDef[]
  featured?: boolean
}

const NEW_PRODUCTS: NewProduct[] = [
  {
    slug: 'sandwashed-silk-set',
    name: 'The Sandwashed Silk Set',
    subtitle: 'Bias shell & skirt, two pieces',
    description:
      'The slip dress, halved and doubled. A bias-cut shell camisole and its matching fluid midi skirt in the same sandwashed ivory silk — worn together they move as one line, apart they anchor everything else you own.\n\nThe set is cut generously and finished with French seams throughout; the skirt sits high on the waist with a covered elastic interior so the bias never pulls.',
    details: [
      'Two-piece set: bias shell + matching midi skirt',
      'Sandwashed silk, 19mm — same cloth as the slip dress',
      'French seams throughout',
      'Covered elastic interior waistband',
      'Made in small batches at our Lagos atelier partner',
    ],
    material: '100% mulberry silk, sandwashed finish',
    care: 'Dry clean recommended. Alternatively: hand wash cold, roll in a towel, dry flat away from direct sun.',
    price: 156000,
    colors: [IVORY, CHARCOAL],
    featured: true,
  },
  {
    slug: 'tailored-wool-set',
    name: 'The Tailored Wool Set',
    subtitle: 'Soft-shoulder blazer & trouser',
    description:
      'A suit with nothing corporate about it. The soft-shoulder blazer and its straight wide-leg trouser are cut from the same double-face charcoal wool, hand-padded through the chest and pressed into one long, quiet column.\n\nWorn together it is ceremony; the pieces separate effortlessly — the blazer over silk, the trouser with knitwear.',
    details: [
      'Two-piece set: soft-shoulder blazer + wide-leg trouser',
      'Hand-padded chest and lapel, horn button',
      'Concealed closures on both pieces',
      'Trouser drafted with a long rise, single break',
      'Made in small batches',
    ],
    material: '96% virgin wool, 4% elastane; cupro lining',
    care: 'Dry clean only. Brush after wear; rest 24h between rotations.',
    price: 178000,
    colors: [CHARCOAL, IVORY],
  },
  {
    slug: 'satin-evening-set',
    name: 'Satin Evening Set',
    subtitle: 'Cowl camisole & floor-sweeping trouser',
    description:
      'Evening, reconsidered as two pieces. A draped cowl-neck camisole in heavyweight champagne satin over floor-sweeping wide-leg trousers of the same liquid cloth — the gown\u2019s drama, the separates\u2019 ease.\n\nThe camisole is weighted at the drape so it falls correctly from the shoulder; the trouser is cut high and long to be worn with a heel.',
    details: [
      'Two-piece set: cowl camisole + wide-leg trouser',
      'Heavyweight liquid satin, weighted cowl drape',
      'Trouser cut high-waist, floor length',
      'Camisole adjustable at the shoulder',
    ],
    material: '82% triacetate, 18% polyester satin',
    care: 'Dry clean only. Store the camisole flat to preserve the drape.',
    price: 168000,
    colors: [CHAMPAGNE, IVORY],
  },
]

const ORDERED_CATEGORY_SLUGS = [
  'ready-to-wear',
  'dresses',
  'two-piece-sets',
  'knitwear',
  'outerwear',
  'accessories',
]

function skuBase(slug: string, color: string, size: string) {
  return `SS-${slug.slice(0, 6).toUpperCase()}-${color.slice(0, 2).toUpperCase()}-${size.replace(/\s/g, '')}`
}

async function main() {
  console.log('Round 13 migration — two-piece sets + XXL …')

  // ——— 1. category ———
  const existingCat = await db.category.findUnique({ where: { slug: 'two-piece-sets' } })
  if (!existingCat) {
    await db.category.create({
      data: {
        slug: 'two-piece-sets',
        name: 'Two-Piece Sets',
        tagline: 'Coordinated, in one motion',
        imageUrl: '/images/products/sandwashed-silk-set.png',
        position: 2,
      },
    })
    console.log('✓ category two-piece-sets created')
  } else {
    console.log('↷ category two-piece-sets exists')
  }

  // Re-assert the canonical ordering (dresses → two-piece-sets → …).
  for (let i = 0; i < ORDERED_CATEGORY_SLUGS.length; i++) {
    await db.category.update({
      where: { slug: ORDERED_CATEGORY_SLUGS[i] },
      data: { position: i },
    })
  }
  console.log('✓ category positions normalised')

  // ——— 2. products ———
  for (const p of NEW_PRODUCTS) {
    const existing = await db.product.findUnique({ where: { slug: p.slug } })
    if (existing) {
      console.log(`↷ product ${p.slug} exists`)
      continue
    }
    const created = await db.product.create({
      data: {
        slug: p.slug,
        name: p.name,
        subtitle: p.subtitle,
        description: p.description,
        details: p.details.join('\n'),
        material: p.material,
        care: p.care,
        price: p.price,
        categoryId: (await db.category.findUnique({ where: { slug: 'two-piece-sets' } }))!.id,
        isActive: true,
        isFeatured: !!p.featured,
        createdAt: new Date(Date.now() - 3 * 86400000),
      },
    })
    await db.productImage.create({
      data: {
        productId: created.id,
        url: `/images/products/${p.slug}.png`,
        alt: `${p.name} — ${p.subtitle}`,
        position: 0,
      },
    })
    let variantCount = 0
    for (const color of p.colors) {
      for (const size of APPAREL_SIZES) {
        await db.productVariant.create({
          data: {
            productId: created.id,
            size,
            color: color.name,
            colorHex: color.hex,
            sku: `${skuBase(p.slug, color.name, size)}-${Math.floor(Math.random() * 90) + 10}`,
            stock: Math.floor(Math.random() * 12) + 5,
          },
        })
        variantCount++
      }
    }
    console.log(`✓ product ${p.slug} (${variantCount} variants, XS–XXL)`)
  }

  // ——— 3. XXL for every existing apparel product ———
  const products = await db.product.findMany({
    include: { variants: { select: { size: true, color: true, colorHex: true, sku: true } } },
  })
  let xxlAdded = 0
  for (const product of products) {
    const hasApparel = product.variants.some((v) => v.size === 'XS')
    if (!hasApparel) continue
    const colours = new Map<string, string>()
    for (const v of product.variants) if (!colours.has(v.color)) colours.set(v.color, v.colorHex)
    for (const [color, colorHex] of colours) {
      const hasXxl = product.variants.some((v) => v.size === 'XXL' && v.color === color)
      if (hasXxl) continue
      await db.productVariant.create({
        data: {
          productId: product.id,
          size: 'XXL',
          color,
          colorHex,
          sku: `${skuBase(product.slug, color, 'XXL')}-${Math.floor(Math.random() * 90) + 10}`,
          stock: Math.floor(Math.random() * 9) + 4,
        },
      })
      xxlAdded++
    }
  }
  console.log(`✓ XXL variants added: ${xxlAdded}`)

  const counts = await Promise.all([
    db.category.count(),
    db.product.count(),
    db.productVariant.count({ where: { size: 'XXL' } }),
    db.order.count(),
  ])
  console.log(`— categories: ${counts[0]}, products: ${counts[1]}, XXL variants: ${counts[2]}, orders (untouched): ${counts[3]}`)
  console.log('\nMigration complete ✔')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
