import { db } from '../lib/db'

/**
 * Production cleanup — aligns the database with the real catalogue:
 *  1. Deactivates the seeded demo products (fake wool/cashmere pieces) so the
 *     storefront shows only the real made-to-order pieces.
 *  2. Rewrites the three placeholder journal posts with product-related
 *     stories (Camille sets, Àrẹ̀wà Aso Oke, made-to-measure sizing).
 *  3. Updates category taglines to match the real assortment.
 */

const REAL_SLUGS = [
  'the-camille-skirt-set',
  'the-camille-trouser-set',
  'the-ariella-dress-short',
  'the-ariella-dress-long',
  'the-arewa-set',
]

const POSTS = [
  {
    where: 'the-ivory-edit',
    data: {
      slug: 'the-camille-edit',
      title: 'The Camille Edit — Polka Dots, Two Ways',
      category: 'Styling',
      readTime: 4,
      excerpt:
        'One draped polka-dot top, two silhouettes: the Camille skirt set and its trouser sibling. How to wear the signature print as a set — and as separates.',
      body: [
        'The Camille started as a single question: what if a coordinate did not have to stay a coordinate? The answer is one softly draped polka-dot top — collar, half-zip, sleeves that gather into cuffs — cut in a lightweight crepe-silk blend that moves like it remembers you.',
        'Worn with the matching flowing skirt, it reads romantic and unbroken, the print travelling from shoulder to hem. Swap the skirt for the high-waisted wide-leg trousers and the same top turns tailored — fluid from hip to hem, day into evening without a change of clothes.',
        'Both sets are cut to your measure — standard sizes XS to XXL, or bespoke measurements taken at order. Skirt length, waistband fit and neckline are all adjustable; tell the studio what you want and it is cut that way.',
        'The monochrome polka dot keeps everything in one register: high contrast, no shouting. Wear the set as intended, then let the top earn its keep with denim for months after. That is the point of good coordinates — nothing orphaned, everything employed.',
      ].join('\n\n'),
    },
  },
  {
    where: 'atelier-notes-volume-02',
    data: {
      slug: 'aso-oke-loom-to-body',
      title: 'Aso Oke, Loom to Body — Making the Àrẹ̀wà Set',
      category: 'Atelier',
      readTime: 6,
      excerpt:
        'Hand-loomed by master weavers and finished in our Lagos studio, the Àrẹ̀wà Set takes ten to fourteen days to make. This is why.',
      body: [
        'Aso Oke — the hand-woven cloth of the Yoruba — cannot be hurried. The loom keeps a rhythm no machine can hold: warp by warp, weft by weft, the weaver builds a fabric with a texture you can feel with your eyes closed. It is cloth with a pulse.',
        'The Àrẹ̀wà Set begins on that loom. Master weavers work the cotton with metallic thread, producing a fabric with genuine weight and a quiet sheen — no two bolts identical, because no two days of weaving are. That irregularity is not a flaw; it is the signature of a human hand.',
        'From the loom, the cloth comes to our Lagos studio to be cut and finished into a structured skirt set that honours the weaving rather than fighting it. Seams are placed to respect the weave; the silhouette is sculpted, contemporary, meant to be worn to occasions that deserve it.',
        'Ten to fourteen working days is what honesty costs. Specialist dry cleaning only — this cloth is never machine-washed — stored flat or on a structured hanger, and it will outlive trends with its dignity intact. Àrẹ̀wà means “the one to look at.” We named it deliberately.',
      ].join('\n\n'),
    },
  },
  {
    where: 'on-charcoal',
    data: {
      slug: 'made-to-your-measure',
      title: 'Made to Your Measure — Sizing at Style Sence',
      category: 'Guide',
      readTime: 3,
      excerpt:
        'Standard sizes XS–XXL or full bespoke measurements — how made-to-order sizing works, and what happens in the days after you order.',
      body: [
        'Every piece we sell is made to order — cut for one body, yours. Standard sizes run XS to XXL, and for most pieces that is all you need: our patterns are drafted for real proportions and refined with every order the studio completes.',
        'Prefer exact? Choose custom measurements at checkout. Depending on the piece we take bust, waist, hips, shoulder, sleeve length, skirt or trouser length and height — for gowns, heel height too, so the hem kisses the floor at exactly the right point. WhatsApp the studio before ordering if you would like help taking them; a two-minute conversation prevents a two-week disappointment.',
        'Standard production runs seven to ten working days. In a hurry? Express production takes two to three days on most pieces — the Àrẹ̀wà Set, which depends on the loom, asks for a conversation with the studio instead.',
        'When your order ships, you will hear from us by email, and tracking appears on your order page. Until then, the piece is on a cutting table in Lagos with your name on it.',
      ].join('\n\n'),
    },
  },
]

async function main() {
  // 1. Deactivate demo products
  const deactivated = await db.product.updateMany({
    where: { slug: { notIn: REAL_SLUGS } },
    data: { isActive: false },
  })
  console.log(`Deactivated ${deactivated.count} demo products.`)

  const active = await db.product.findMany({
    where: { isActive: true },
    select: { slug: true, name: true },
    orderBy: { createdAt: 'asc' },
  })
  console.log(`Active catalogue (${active.length}):`)
  active.forEach((p) => console.log(`  ${p.slug} — ${p.name}`))

  // 2. Rewrite journal posts (slug change included; ids preserved)
  for (const post of POSTS) {
    const existing = await db.journalPost.findUnique({ where: { slug: post.where } })
    if (!existing) {
      console.warn(`!! journal post "${post.where}" not found — skipped`)
      continue
    }
    await db.journalPost.update({ where: { id: existing.id }, data: post.data })
    console.log(`journal "${post.where}" → "${post.data.slug}" — ${post.data.title}`)
  }

  // 3. Category taglines
  const taglines = [
    { slug: 'dresses', tagline: 'Minis to floor-sweeping gowns' },
    { slug: 'two-piece-sets', tagline: 'Coordinates, worn together or apart' },
  ]
  for (const t of taglines) {
    const r = await db.category.updateMany({ where: { slug: t.slug }, data: { tagline: t.tagline } })
    console.log(`category ${t.slug}: "${t.tagline}" (${r.count} row)`)
  }

  console.log('\n✔ Production cleanup complete.')
  await db.$disconnect()
}

main()
  .catch((err) => {
    console.error('Cleanup failed:', err)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
