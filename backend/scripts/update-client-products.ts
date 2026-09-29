/**
 * Client product update — 2026-09-29 sheet from the owner.
 *
 * Applies to the 5 live products:
 *  - Àrẹ̀wà Set: price 365000 → 350000, colour → Red (custom-measurement piece)
 *  - Camille Skirt/Trouser Set: sizes → S/M/L/XXL (drops XS, XL), colour
 *    "Monochrome Polka Dot" → "Black & White", adds "Blue & Cream", per-size
 *    garment measurements (inches) + international pricing appended to details
 *  - Ariella Short/Long: adds Red + Off White colourways, drops
 *    "Other / Custom Colour", made-to-measure + international pricing details
 *
 * Idempotent: safe to re-run. In-place colour renames keep variant ids (and
 * the cart items pointing at them) intact; deletions are guarded by cart
 * references checked at run time.
 */
import { db } from '../lib/db'
import { generateSku } from '../lib/sku'

const NAIRA = {
  arewa: 350_000,
  camille: 149_999,
  ariella: 159_999,
} as const

const AREWA_RED = '#8E1B2C'
const BLUE_CREAM = '#3E5C76'
const ARIELLA_RED = '#B3222D'
const OFF_WHITE = '#EDE7DC'

async function appendDetails(slug: string, lines: string[]) {
  const p = await db.product.findUniqueOrThrow({ where: { slug }, select: { id: true, details: true } })
  const existing = p.details ? p.details.split('\n') : []
  const merged = [...existing]
  for (const line of lines) {
    if (!merged.some((l) => l.trim() === line)) merged.push(line)
  }
  await db.product.update({ where: { id: p.id }, data: { details: merged.join('\n') } })
  console.log(`  details: +${lines.length} line(s)`)
}

/** Rename a colourway in place (keeps variant ids, SKUs, cart references). */
async function renameColor(productId: string, from: string, to: string, hex: string) {
  const res = await db.productVariant.updateMany({
    where: { productId, color: from },
    data: { color: to, colorHex: hex },
  })
  console.log(`  colour rename: "${from}" → "${to}" (${res.count} variants)`)
}

async function deleteVariants(productId: string, where: { color?: string; sizes?: string[] }) {
  const refs = await db.cartItem.count({
    where: {
      variant: { productId, color: where.color, size: where.sizes ? { in: where.sizes } : undefined },
    },
  })
  if (refs > 0) {
    console.warn(`  ⚠️ SKIPPED delete (colour=${where.color}, sizes=${where.sizes?.join('/')}): ${refs} cart item(s) reference them`)
    return
  }
  const res = await db.productVariant.deleteMany({
    where: { productId, color: where.color, size: where.sizes ? { in: where.sizes } : undefined },
  })
  console.log(`  deleted ${res.count} variant(s) (colour=${where.color}, sizes=${where.sizes?.join('/') ?? 'all'})`)
}

/** Ensure every (colour, size) pair in the grid exists, creating what's missing. */
async function ensureVariants(
  productId: string,
  folderPrefix: string,
  colors: { name: string; hex: string }[],
  sizes: string[],
) {
  const existing = await db.productVariant.findMany({
    where: { productId },
    select: { color: true, size: true },
  })
  const taken = new Set(
    (await db.productVariant.findMany({ select: { sku: true } })).map((v) => v.sku),
  )
  let created = 0
  for (const c of colors) {
    for (const size of sizes) {
      if (existing.some((v) => v.color === c.name && v.size === size)) continue
      await db.productVariant.create({
        data: {
          productId,
          size,
          color: c.name,
          colorHex: c.hex,
          stock: 6,
          sku: generateSku(c.name, size, taken),
        },
      })
      created++
    }
  }
  console.log(`  variants: created ${created} (${colors.map((c) => c.name).join(', ')} × ${sizes.join('/')})`)
}

async function main() {
  console.log('--- Àrẹ̀wà Set ---')
  const arewa = await db.product.findUniqueOrThrow({ where: { slug: 'the-arewa-set' } })
  await db.product.update({
    where: { id: arewa.id },
    data: { price: NAIRA.arewa, compareAtPrice: null },
  })
  console.log(`  price: ${arewa.price} → ${NAIRA.arewa}`)
  await renameColor(arewa.id, 'Heritage Aso Oke Weave', 'Red', AREWA_RED)
  await appendDetails('the-arewa-set', [
    'Cut to your measurements — the size rail is a closest-fit reference for the atelier',
    'International pricing: $264 · £193 — settled by bank transfer on confirmation',
  ])

  const camilleSizes = ['S', 'M', 'L', 'XXL']
  for (const [slug, bottom] of [
    ['the-camille-skirt-set', 'skirt'],
    ['the-camille-trouser-set', 'trouser'],
  ] as const) {
    console.log(`\n--- Camille ${bottom === 'skirt' ? 'Skirt' : 'Trouser'} Set ---`)
    const p = await db.product.findUniqueOrThrow({ where: { slug } })
    await db.product.update({ where: { id: p.id }, data: { price: NAIRA.camille } })
    console.log(`  price: ${p.price} → ${NAIRA.camille}`)
    await renameColor(p.id, 'Monochrome Polka Dot', 'Black & White', '#1A1A1A')
    await deleteVariants(p.id, { sizes: ['XS', 'XL'] })
    await ensureVariants(p.id, 'CAM', [{ name: 'Blue & Cream', hex: BLUE_CREAM }], camilleSizes)
    await appendDetails(slug, [
      `Garment measurements (inches) — S & M: shoulder 17, blouse length 25, sleeve 27, ${bottom} length 44`,
      `Garment measurements (inches) — L & XXL: shoulder 18, blouse length 26, sleeve 27, ${bottom} length 45`,
      'International pricing: $113 · £84 — settled by bank transfer on confirmation',
    ])
  }

  const ariellaColors = [
    { name: 'Blush', hex: '#E8C5C8' },
    { name: 'Butter Yellow', hex: '#F4E7B5' },
    { name: 'Powder Blue', hex: '#B6CCE2' },
    { name: 'Red', hex: ARIELLA_RED },
    { name: 'Off White', hex: OFF_WHITE },
  ]
  const ariellaSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
  for (const slug of ['the-ariella-dress-short', 'the-ariella-dress-long']) {
    console.log(`\n--- ${slug} ---`)
    const p = await db.product.findUniqueOrThrow({ where: { slug } })
    await db.product.update({
      where: { id: p.id },
      data: { price: NAIRA.ariella, name: p.name.replace(/\s{2,}/g, ' ') },
    })
    console.log(`  price: ${p.price} → ${NAIRA.ariella}`)
    await deleteVariants(p.id, { color: 'Other / Custom Colour' })
    await ensureVariants(p.id, 'ARL', ariellaColors, ariellaSizes)
    await appendDetails(slug, [
      'Made to your measurements — each dress is cut to order; the size rail is a closest-fit reference',
      'International pricing: $120 · £90 — settled by bank transfer on confirmation',
    ])
  }

  console.log('\n✔ Client product updates applied.')
}

main()
  .catch((e) => {
    console.error('UPDATE FAILED:', e)
    process.exit(1)
  })
  .finally(() => process.exit(0))
