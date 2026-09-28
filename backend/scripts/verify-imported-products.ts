import { db } from '../lib/db'

async function main() {
  const slugs = [
    'the-camille-skirt-set',
    'the-camille-trouser-set',
    'the-ariella-dress-short',
    'the-ariella-dress-long',
    'the-arewa-set',
  ]
  const products = await db.product.findMany({
    where: { slug: { in: slugs } },
    include: {
      category: { select: { name: true } },
      images: { orderBy: { position: 'asc' } },
      variants: { select: { id: true, stock: true } },
    },
  })
  console.log(`Found ${products.length} of ${slugs.length} products:\n`)
  for (const p of products) {
    const totalStock = p.variants.reduce((s, v) => s + v.stock, 0)
    console.log(`${p.name}`)
    console.log(`  slug=${p.slug} | price=${p.price} | compareAt=${p.compareAtPrice ?? '—'} | active=${p.isActive} | featured=${p.isFeatured}`)
    console.log(`  category=${p.category?.name ?? 'NONE'} | variants=${p.variants.length} | stock=${totalStock}`)
    console.log(`  material="${p.material ?? ''}" | care="${(p.care ?? '').slice(0, 50)}..."`)
    console.log(`  subtitle="${p.subtitle ?? ''}"`)
    console.log(`  description: ${p.description.length} chars`)
    p.images.forEach((img, i) => console.log(`  [${i}] ${img.url}`))
    console.log('')
  }
  await db.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
