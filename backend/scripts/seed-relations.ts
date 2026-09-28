/**
 * Seed curated "Complete the look" relations for the hero pieces — idempotent:
 * products that already have ANY curated relations are skipped untouched
 * (admin curation wins over re-seeding). Run: bun scripts/seed-relations.ts
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

/**
 * The house styling, mirrored from the editorial looks (Quiet Uniform /
 * Evening, Considered / The Long Line) and the atelier's own pairing notes.
 * Order = display order on the PDP (first 4 slots; max 8 via admin).
 */
const LOOKS: { slug: string; name: string; related: string[] }[] = [
  {
    slug: 'silk-slip-dress',
    name: 'The Ivory Silk Slip Dress',
    related: [
      'atelier-blazer', // "Evening, Considered" — the blazer over the slip
      'leather-mini-tote', // the evening bag
      'cashmere-ribbed-scarf', // a wrap for cooler galleries
      'merino-turtleneck', // slips beautifully over a fine merino
    ],
  },
  {
    slug: 'atelier-blazer',
    name: 'The Atelier Blazer',
    related: [
      'wide-leg-trouser', // "my uniform now" — the house trousing
      'silk-slip-dress', // "Evening, Considered" — over the ivory slip
      'merino-turtleneck', // the sculpted layer beneath
      'poplin-shirt', // shirting with the self-standing collar
    ],
  },
  {
    slug: 'cashmere-crewneck',
    name: 'Relaxed Cashmere Crewneck',
    related: [
      'wide-leg-trouser', // "The Quiet Uniform"
      'knitted-column-skirt', // the knit-on-knit column
      'cashmere-ribbed-scarf', // espresso against ivory knit
      'leather-mini-tote', // the day bag
    ],
  },
  {
    slug: 'longline-wool-coat',
    name: 'Longline Wool Coat',
    related: [
      'merino-turtleneck', // "The Long Line"
      'wide-leg-trouser', // the trouser beneath the coat
      'silk-slip-dress', // the long line over the slip
      'cashmere-ribbed-scarf', // at the collar
    ],
  },
  {
    slug: 'bias-satin-gown',
    name: 'Bias-Cut Satin Gown',
    related: [
      'leather-mini-tote', // the evening bag that is also a day bag
      'cashmere-ribbed-scarf', // a wrap between venue and car
      'atelier-blazer', // ivory blazer over the champagne gown
      'silk-slip-dress', // its daytime sister
    ],
  },
]

async function main() {
  const products = await db.product.findMany({ select: { id: true, slug: true } })
  const bySlug = new Map(products.map((p) => [p.slug, p.id]))

  // Validate every slug referenced by the seed before writing anything.
  for (const look of LOOKS) {
    if (!bySlug.has(look.slug)) {
      throw new Error(`Unknown hero slug in seed: "${look.slug}"`)
    }
    for (const slug of look.related) {
      if (!bySlug.has(slug)) throw new Error(`Unknown related slug in seed: "${slug}" (for ${look.slug})`)
      if (slug === look.slug) throw new Error(`Self-relation in seed: "${slug}"`)
    }
  }

  let created = 0
  for (const look of LOOKS) {
    const productId = bySlug.get(look.slug) as string
    const existing = await db.productRelation.count({ where: { productId } })
    if (existing > 0) {
      console.log(`↷ ${look.name} — already has ${existing} curated relation(s), skipped`)
      continue
    }
    // Defensive clean slate (only reachable when zero rows exist).
    await db.productRelation.deleteMany({ where: { productId } })
    await db.productRelation.createMany({
      data: look.related.map((slug, position) => ({
        productId,
        relatedId: bySlug.get(slug) as string,
        position,
      })),
    })
    created += look.related.length
    console.log(`✓ ${look.name} → ${look.related.join(', ')}`)
  }
  console.log(`Curated relations seeded ✔ (${created} rows created, idempotent skips preserved)`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
