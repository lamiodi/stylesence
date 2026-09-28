import fs from 'fs'
import path from 'path'
import { db } from '../lib/db'
import { cloudinary } from '../lib/cloudinary'

/**
 * Replaces AI/mockup imagery with the real collection photos from
 * frontend/public/IMAGESS. Uploads each photo to Cloudinary with a clean
 * public id, then updates DB references (category tiles, product galleries,
 * journal covers). Prints a URL map consumed by the home/about page edits.
 */

const IMAGESS_DIR = path.resolve(__dirname, '../../frontend/public/IMAGESS')

const PHOTOS: { file: string; key: string; folder: string }[] = [
  { file: 'IMG_2413.JPG.jpeg', key: 'camille-duo-cafe', folder: 'stylesence/products' },
  { file: 'IMG_2415.JPG.jpeg', key: 'camille-duo-seated', folder: 'stylesence/products' },
  { file: 'IMG_2416.JPG (2).jpeg', key: 'camille-duo-cream', folder: 'stylesence/editorial' },
  { file: 'IMG_2417.JPG.jpeg', key: 'camille-bomber-shorts', folder: 'stylesence/editorial' },
  { file: 'IMG_2418.JPG (2).jpeg', key: 'camille-skirt-slate', folder: 'stylesence/products' },
  { file: 'IMG_2419.JPG.jpeg', key: 'ariella-gown-blue', folder: 'stylesence/products' },
  { file: 'IMG_2420.JPG.jpeg', key: 'camille-crop-set-blue', folder: 'stylesence/editorial' },
  { file: 'IMG_2426 (4).PNG', key: 'ariella-set-back', folder: 'stylesence/editorial' },
  { file: 'IMG_2432.JPG (4).jpeg', key: 'ariella-halter-set', folder: 'stylesence/editorial' },
  { file: 'IMG_2434.JPG.jpeg', key: 'polka-shirt-dress', folder: 'stylesence/editorial' },
]

/** Insert Cloudinary transformation params into a delivery URL. */
function transform(url: string, params: string): string {
  return url.replace('/image/upload/', `/image/upload/${params}/`)
}

async function main() {
  if (!process.env.CLOUDINARY_URL) {
    console.error('CLOUDINARY_URL not set — cannot upload.')
    process.exit(1)
  }

  // 1. Upload every photo (idempotent: explicit public_id overwrites itself on re-run)
  const urls: Record<string, string> = {}
  for (const p of PHOTOS) {
    const src = path.join(IMAGESS_DIR, p.file)
    if (!fs.existsSync(src)) {
      console.error(`Missing file: ${src}`)
      process.exit(1)
    }
    const res = await cloudinary.uploader.upload(src, {
      folder: p.folder,
      public_id: p.key,
      resource_type: 'image',
      overwrite: true,
    })
    urls[p.key] = res.secure_url
    console.log(`✔ ${p.key}: ${urls[p.key]}`)
  }

  const T = {
    hero: (k: string) => transform(urls[k], 'w_2000,q_auto,f_auto'),
    large: (k: string) => transform(urls[k], 'w_1600,q_auto,f_auto'),
    mid: (k: string) => transform(urls[k], 'w_1400,q_auto,f_auto'),
    journal: (k: string) => transform(urls[k], 'w_1200,q_auto,f_auto'),
    tile: (k: string) => transform(urls[k], 'w_900,q_auto,f_auto'),
  }

  // 2. Category tiles — real photos for the two categories we have garments for
  const tileUpdates = [
    { slug: 'two-piece-sets', key: 'camille-duo-cream' },
    { slug: 'dresses', key: 'polka-shirt-dress' },
  ]
  for (const t of tileUpdates) {
    const r = await db.category.updateMany({ where: { slug: t.slug }, data: { imageUrl: T.tile(t.key) } })
    console.log(`category ${t.slug} → ${T.tile(t.key)} (${r.count} row)`)
  }

  // 3. Product galleries — keep existing stills, append new stills, videos last
  const galleryUpdates: { slug: string; append: { url: string; alt: string }[] }[] = [
    {
      slug: 'the-camille-skirt-set',
      append: [
        { url: T.large('camille-duo-seated'), alt: 'The Camille Skirt Set — styled in the café, two ways' },
        { url: T.large('camille-duo-cafe'), alt: 'The Camille Skirt Set with the Camille Trouser Set' },
      ],
    },
    {
      slug: 'the-camille-trouser-set',
      append: [
        { url: T.large('camille-duo-cafe'), alt: 'The Camille Trouser Set with the Camille Skirt Set' },
      ],
    },
    {
      slug: 'the-ariella-dress-long',
      append: [{ url: T.large('ariella-gown-blue'), alt: 'The Ariella Dress (Long) — powder blue' }],
    },
  ]
  for (const g of galleryUpdates) {
    const product = await db.product.findUnique({
      where: { slug: g.slug },
      include: { images: { orderBy: { position: 'asc' } } },
    })
    if (!product) {
      console.warn(`!! product ${g.slug} not found — skipped`)
      continue
    }
    const existingUrls = new Set(product.images.map((i) => i.url))
    const stills = product.images.filter((i) => !/\.(mp4|webm|mov)(\?|$)/i.test(i.url))
    const videos = product.images.filter((i) => /\.(mp4|webm|mov)(\?|$)/i.test(i.url))
    const appended = g.append.filter((a) => !existingUrls.has(a.url))
    const all = [
      ...stills.map((i) => ({ url: i.url, alt: i.alt })),
      ...appended,
      ...videos.map((i) => ({ url: i.url, alt: i.alt })),
    ]
    await db.$transaction([
      db.productImage.deleteMany({ where: { productId: product.id } }),
      db.productImage.createMany({
        data: all.map((img, position) => ({
          productId: product.id,
          url: img.url,
          alt: img.alt,
          position,
        })),
      }),
    ])
    console.log(`gallery ${g.slug}: ${all.length} images (${appended.length} added)`)
  }

  // 4. Journal covers
  const journalUpdates = [
    { slug: 'the-ivory-edit', key: 'camille-duo-cream' },
    { slug: 'atelier-notes-volume-02', key: 'camille-bomber-shorts' },
    { slug: 'on-charcoal', key: 'camille-skirt-slate' },
  ]
  for (const j of journalUpdates) {
    const r = await db.journalPost.updateMany({ where: { slug: j.slug }, data: { coverImage: T.journal(j.key) } })
    console.log(`journal ${j.slug} → ${T.journal(j.key)} (${r.count} row)`)
  }

  // 5. Persist the URL map for the page-code edits
  const map = {
    hero: T.hero('camille-duo-cafe'),
    look1: T.mid('camille-skirt-slate'),
    atelier: T.mid('camille-duo-seated'),
    aboutLook2: T.mid('camille-crop-set-blue'),
    aboutLook3: T.mid('ariella-gown-blue'),
  }
  fs.writeFileSync(path.join(__dirname, 'mockup-replacement-map.json'), JSON.stringify(map, null, 2))
  console.log('\nURL map for page edits:')
  console.log(JSON.stringify(map, null, 2))
  console.log('\n✔ Mockup replacement complete.')

  await db.$disconnect()
}

main()
  .catch((err) => {
    console.error('Replacement script failed:', err)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
