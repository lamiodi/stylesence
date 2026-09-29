/**
 * Media audit — reports any product/journal media rows whose URL points at a
 * local /public asset instead of Cloudinary (run before removing fallback
 * media from frontend/public). Reads only; exits 1 when local URLs exist.
 *
 *   npx tsx scripts/check-local-media.ts
 */
import { db } from '../lib/db'

function isLocalUrl(url: string): boolean {
  return !/^https?:\/\//i.test(url)
}

async function main() {
  const images = await db.productImage.findMany({
    select: { url: true, product: { select: { slug: true } } },
  })
  const journals = await db.journalPost.findMany({
    select: { slug: true, coverImage: true },
  })

  const localImages = images.filter((i) => isLocalUrl(i.url))
  const localJournals = journals.filter((j) => j.coverImage && isLocalUrl(j.coverImage))

  console.log(`product images: ${images.length} total, ${localImages.length} local`)
  for (const i of localImages) console.log(`  LOCAL  ${i.product.slug}  ->  ${i.url}`)
  console.log(`journal covers: ${journals.length} total, ${localJournals.length} local`)
  for (const j of localJournals) console.log(`  LOCAL  ${j.slug}  ->  ${j.coverImage}`)

  if (localImages.length || localJournals.length) process.exit(1)
  console.log('clean — every media URL is absolute (Cloudinary); local fallbacks are unreferenced.')
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
