/**
 * One-off (2026-09-30): assign each gallery image of the 4 multi-colour
 * products to its colourway so the PDP filters per selected colour.
 *
 * Colour decisions came from visually auditing every asset:
 *  - the 14 new lifestyle/detail uploads (upload-receipts.json carries colour)
 *  - the pre-existing studio photos/videos: Camille sets are polka-dot
 *    Black & White (one Blue & Cream trouser shot), Ariella shoots are Red,
 *    camille-duo-cafe.jpg shows BOTH Camille colourways → stays shared (null).
 *
 * Shared (null) images show for every colour; assigned ones only for theirs.
 * Run from backend/: npx tsx --env-file=.env scripts/assign-image-colors.ts
 */
import { sql } from '../lib/db'

/** url-fragment → colour (null = deliberately shared across colours). */
const ASSIGNMENTS: Record<string, Record<string, string | null>> = {
  'the-camille-trouser-set': {
    IMG_2416_mfhure: 'Black & White',
    IMG_9738_lnw9tk: 'Blue & Cream',
    'camille-duo-cafe': null,
    IMG_6843_b7eomt: 'Black & White',
    aqzzlaowvm4jtfhtfjqm: 'Black & White',
    fyfaep8aqjwyounguvu3: 'Black & White',
    'camille-trouser-blue-cream-lifestyle': 'Blue & Cream',
    'camille-trouser-black-white-detail': 'Black & White',
  },
  'the-camille-skirt-set': {
    IMG_2418_bxyfvx: 'Black & White',
    xfpgs9yjfc4bq6retxau: 'Black & White',
    hhif06xgc1xmfiw2sdyu: 'Black & White',
    'camille-skirt-black-white-lifestyle': 'Black & White',
    'camille-skirt-blue-cream-detail': 'Blue & Cream',
  },
  'the-ariella-dress-long': {
    IMG_2426_hkgkfv: 'Red',
    IMG_2432_ltticl: 'Red',
    sygvfoqdincxbb36uksp: 'Red',
    'ariella-long-off-white-lifestyle': 'Off White',
    'ariella-long-red-lifestyle': 'Red',
    'ariella-long-blush-lifestyle': 'Blush',
    'ariella-long-butter-yellow-lifestyle': 'Butter Yellow',
    'ariella-long-powder-blue-detail': 'Powder Blue',
  },
  'the-ariella-dress-short': {
    IMG_6842_wlfho7: 'Red',
    m0frufetagfzmr8jpyhz: 'Red',
    'WhatsApp_Image_2026-09-29_at_11.18.10_AM_ogfbs7': 'Red',
    'ariella-short-off-white-lifestyle': 'Off White',
    'ariella-short-red-lifestyle': 'Red',
    'ariella-short-butter-yellow-lifestyle': 'Butter Yellow',
    'ariella-short-powder-blue-lifestyle': 'Powder Blue',
    'ariella-short-blush-detail': 'Blush',
  },
}

/** Last path segment without extension — the stable Cloudinary public-id tail. */
function fragmentOf(url: string): string | null {
  const m = url.match(/\/([^/.]+)\.[a-z0-9]+$/i)
  return m ? m[1] : null
}

async function main() {
  // Probe: this select fails loudly if the colour column is missing.
  const probe = await sql`SELECT id, url, color FROM "ProductImage" LIMIT 1`
  console.log(`probe ok — ${probe.length} row(s), colour column present`)

  for (const [slug, map] of Object.entries(ASSIGNMENTS)) {
    const rows = await sql<{ id: string; url: string; color: string | null }[]>`
      SELECT pi.id, pi.url, pi.color
      FROM "ProductImage" pi
      JOIN "Product" p ON p.id = pi."productId"
      WHERE p.slug = ${slug}
      ORDER BY pi.position ASC
    `
    if (rows.length === 0) throw new Error(`no images found for ${slug}`)
    console.log(`\n=== ${slug}`)
    for (const img of rows) {
      const frag = fragmentOf(img.url)
      const target = frag !== null && frag in map ? map[frag] : undefined
      if (target === undefined) {
        console.log(`  [keep]   ${frag} → ${img.color ?? 'null'}`)
        continue
      }
      if (img.color === target) {
        console.log(`  [same]   ${frag} → ${target}`)
        continue
      }
      await sql`UPDATE "ProductImage" SET color = ${target} WHERE id = ${img.id}`
      console.log(`  [set]    ${frag}: ${img.color ?? 'null'} → ${target ?? 'null (shared)'}`)
    }
  }
  console.log('\ndone.')
  await sql.end()
}

main().catch((e) => {
  console.error('ASSIGN FAILED:', e)
  process.exitCode = 1
  sql.end().then(() => process.exit(process.exitCode ?? 1))
})
