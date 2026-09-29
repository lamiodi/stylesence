/** One-off: dump the 5 client products + their image URLs (for angle-study). */
import { db } from '../lib/db'

async function main() {
  const products = await db.product.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
    include: { images: { orderBy: { position: 'asc' } } },
  })
  for (const p of products) {
    console.log(`\n=== ${p.name} (${p.slug}) price=${p.price} desc="${(p.description ?? '').slice(0, 120)}"`)
    for (const img of p.images) {
      console.log(`  [${img.position}] alt="${img.alt ?? ''}" ${img.url}`)
    }
  }
}

main()
  .catch((e) => {
    console.error('DUMP FAILED:', e)
    process.exit(1)
  })
  .finally(() => process.exit(0))
