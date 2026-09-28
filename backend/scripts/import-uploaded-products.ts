import fs from 'fs'
import path from 'path'
import { db } from '../lib/db'
import { uploadToCloudinary } from '../lib/cloudinary'

interface ParsedProduct {
  folder: string
  name: string
  slug: string
  price: number
  compareAtPrice?: number
  categorySlug: string
  subtitle: string
  description: string
  details: string[]
  material: string
  care: string
  colors: { name: string; hex: string }[]
  sizes: string[]
  images: string[]
  videos: string[]
}

function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[—–]/g, '-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function parsePrice(text: string): number {
  const match = text.replace(/,/g, '').match(/\d+/)
  return match ? parseInt(match[0], 10) : 0
}

function parseHex(text: string, defaultHex = '#1A1A1A'): string {
  const match = text.match(/#[0-9A-Fa-f]{6}/)
  return match ? match[0] : defaultHex
}

function parseProductFile(folderPath: string, folderName: string): ParsedProduct | null {
  const txtFiles = fs.readdirSync(folderPath).filter((f) => f.endsWith('.txt'))
  if (txtFiles.length === 0) return null

  const content = fs.readFileSync(path.join(folderPath, txtFiles[0]), 'utf8')

  // Extract fields
  const nameMatch = content.match(/PRODUCT NAME:\s*\n([^\n]+)/i)
  if (!nameMatch || !nameMatch[1].trim() || nameMatch[1].includes('[')) return null
  const name = nameMatch[1].trim()

  const priceMatch = content.match(/PRICE:\s*\n([^\n]+)/i)
  if (!priceMatch) return null
  const price = parsePrice(priceMatch[1])
  if (!price) return null

  const compareMatch = content.match(/COMPARE AT [^\n]*:\s*\n([^\n]+)/i)
  const compareAtPrice = compareMatch && !compareMatch[1].includes('[') ? parsePrice(compareMatch[1]) : undefined

  // Scan media files first — only process folders with actual image/video files
  const mediaDir = path.join(folderPath, 'media')
  const imageFiles: string[] = []
  const videoFiles: string[] = []
  if (fs.existsSync(mediaDir)) {
    const scanDir = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          scanDir(full)
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase()
          if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
            imageFiles.push(full)
          } else if (['.mp4', '.webm', '.mov'].includes(ext)) {
            videoFiles.push(full)
          }
        }
      }
    }
    scanDir(mediaDir)
  }

  if (imageFiles.length === 0 && videoFiles.length === 0) {
    return null
  }

  const baseTitle = name.split('—')[0].trim()
  const slug = slugify(baseTitle)

  const catMatch = content.match(/CATEGORY[^\n]*:\s*\n([^\n]+)/i)
  let categorySlug = 'two-piece-sets'
  if (catMatch) {
    const rawCat = catMatch[1].toLowerCase()
    if (rawCat.includes('dress')) categorySlug = 'dresses'
    else if (rawCat.includes('two-piece') || rawCat.includes('set')) categorySlug = 'two-piece-sets'
    else if (rawCat.includes('knit')) categorySlug = 'knitwear'
    else if (rawCat.includes('outer')) categorySlug = 'outerwear'
    else if (rawCat.includes('accessories')) categorySlug = 'accessories'
  }

  const subMatch = content.match(/SUBTITLE [^\n]*:\s*\n([^\n]+)/i)
  const subtitle = subMatch && !subMatch[1].includes('[') ? subMatch[1].trim() : ''

  // Description
  const descSection = content.match(/DESCRIPTION & HIGHLIGHTS\s*\n-+([\s\S]*?)(?=-{20,}|$)/i)
  let description = ''
  if (descSection) {
    description = descSection[1].replace(/\[Paste product description here\]/gi, '').trim()
  }

  // Details & highlights from additional notes
  const details: string[] = []
  if (name.includes('—')) {
    details.push(name.split('—')[1].trim())
  }
  const notesSection = content.match(/ADDITIONAL NOTES [^\n]*\s*\n-+([\s\S]*?)(?=={20,}|$)/i)
  if (notesSection) {
    const lines = notesSection[1].split('\n')
    for (const l of lines) {
      const clean = l.replace(/^[-*•]\s*/, '').trim()
      if (clean && !clean.includes('[') && !clean.startsWith('=')) {
        details.push(clean)
      }
    }
  }

  // Material & Care — use multiline anchor to avoid matching "MATERIAL & CARE:"
  const matMatch = content.match(/^\s*[-*•]?\s*Material:\s*([^\n]+)/im)
  const material = matMatch && !matMatch[1].includes('[') ? matMatch[1].trim() : ''

  const careMatch = content.match(/^\s*[-*•]?\s*Care:\s*([^\n]+)/im)
  const care = careMatch && !careMatch[1].includes('[') ? careMatch[1].trim() : ''

  // Colours
  const colors: { name: string; hex: string }[] = []
  const colMatch = content.match(/COLOUR OPTIONS:\s*\n([\s\S]*?)(?=SIZE OPTIONS:|$)/i)
  if (colMatch) {
    const lines = colMatch[1].split('\n')
    for (const l of lines) {
      const clean = l.replace(/^[-*•]\s*/, '').trim()
      if (clean && clean.length > 2) {
        const hex = parseHex(clean, '#1A1A1A')
        const colName = clean.replace(/\([^)]*\)/g, '').trim() || 'Monochrome Polka Dot'
        colors.push({ name: colName, hex })
      }
    }
  }
  if (colors.length === 0) {
    colors.push({ name: 'Monochrome Polka Dot', hex: '#1A1A1A' })
  }

  // Sizes
  let sizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
  const sizeMatch = content.match(/Standard Sizes:\s*([^\n]+)/i)
  if (sizeMatch) {
    const rawSizes = sizeMatch[1]
      .split(/[,/ ]+/)
      .map((s) => s.trim().toUpperCase())
      .filter((s) => ['XS', 'S', 'M', 'L', 'XL', 'XXL'].includes(s))
    if (rawSizes.length > 0) sizes = rawSizes
  }

  return {
    folder: folderName,
    name,
    slug,
    price,
    compareAtPrice,
    categorySlug,
    subtitle,
    description,
    details,
    material,
    care,
    colors,
    sizes,
    images: imageFiles,
    videos: videoFiles,
  }
}

async function main() {
  console.log('--- Scanning products_to_upload ---')
  const rootDir = path.resolve(__dirname, '../../')
  const uploadDir = path.join(rootDir, 'products_to_upload')
  const frontendPublicDir = path.join(rootDir, 'frontend/public')
  const targetImgDir = path.join(frontendPublicDir, 'images/products')
  const targetVideoDir = path.join(frontendPublicDir, 'videos/products')

  fs.mkdirSync(targetImgDir, { recursive: true })
  fs.mkdirSync(targetVideoDir, { recursive: true })

  // Also root public if present
  const rootPublicDir = path.join(rootDir, 'public')
  if (fs.existsSync(rootPublicDir)) {
    fs.mkdirSync(path.join(rootPublicDir, 'images/products'), { recursive: true })
    fs.mkdirSync(path.join(rootPublicDir, 'videos/products'), { recursive: true })
  }

  if (!fs.existsSync(uploadDir)) {
    console.error('products_to_upload directory not found at', uploadDir)
    process.exit(1)
  }

  const entries = fs.readdirSync(uploadDir, { withFileTypes: true })
  const products: ParsedProduct[] = []

  for (const entry of entries) {
    if (entry.isDirectory() && entry.name.startsWith('product_')) {
      const folderPath = path.join(uploadDir, entry.name)
      const parsed = parseProductFile(folderPath, entry.name)
      if (parsed) {
        products.push(parsed)
      }
    }
  }

  console.log(`Found ${products.length} ready products with media to upload.`)

  for (const p of products) {
    console.log(`\nProcessing: ${p.name} (Slug: ${p.slug})`)
    console.log(`  Price: ₦${p.price.toLocaleString()} | Category: ${p.categorySlug}`)

    // 1. Process and upload media (Cloudinary first, local copy as fallback/backup)
    const productMediaList: { url: string; alt: string; position: number }[] = []
    const hasCloudinary = Boolean(process.env.CLOUDINARY_URL)

    for (let idx = 0; idx < p.images.length; idx++) {
      const srcPath = p.images[idx]
      const ext = path.extname(srcPath).toLowerCase()
      const destFileName = `${p.slug}-${idx + 1}${ext}`
      const destPath = path.join(targetImgDir, destFileName)
      fs.copyFileSync(srcPath, destPath)
      if (fs.existsSync(rootPublicDir)) {
        fs.copyFileSync(srcPath, path.join(rootPublicDir, 'images/products', destFileName))
      }
      let mediaUrl = `/images/products/${destFileName}`

      if (hasCloudinary) {
        try {
          console.log(`  Uploading image to Cloudinary: ${path.basename(srcPath)}...`)
          const uploadRes = await uploadToCloudinary(srcPath, 'stylesence/products', 'image')
          mediaUrl = uploadRes.secure_url
          console.log(`  ✔ Cloudinary image ready: ${mediaUrl}`)
        } catch (err) {
          console.warn(`  ⚠️ Cloudinary upload failed for ${srcPath}, falling back to local URL:`, err)
        }
      }

      productMediaList.push({
        url: mediaUrl,
        alt: `${p.name} — view ${idx + 1}`,
        position: productMediaList.length,
      })
    }

    for (let idx = 0; idx < p.videos.length; idx++) {
      const srcPath = p.videos[idx]
      const ext = path.extname(srcPath).toLowerCase()
      const destFileName = `${p.slug}${idx > 0 ? `-${idx + 1}` : ''}${ext}`
      const destPath = path.join(targetVideoDir, destFileName)
      fs.copyFileSync(srcPath, destPath)
      if (fs.existsSync(rootPublicDir)) {
        fs.copyFileSync(srcPath, path.join(rootPublicDir, 'videos/products', destFileName))
      }
      let mediaUrl = `/videos/products/${destFileName}`
      let cloudinaryVideoUrl: string | null = null

      if (hasCloudinary) {
        try {
          console.log(`  Uploading video to Cloudinary: ${path.basename(srcPath)}...`)
          const uploadRes = await uploadToCloudinary(srcPath, 'stylesence/products', 'video')
          mediaUrl = uploadRes.secure_url
          cloudinaryVideoUrl = uploadRes.secure_url
          console.log(`  ✔ Cloudinary video ready: ${mediaUrl}`)
        } catch (err) {
          console.warn(`  ⚠️ Cloudinary upload failed for ${srcPath}, falling back to local URL:`, err)
        }
      }

      // Video-only piece: Cloudinary can serve a still frame of the video as a
      // JPEG (so_1 = frame at 1s, f_jpg = JPEG output) — use it as the primary
      // shop-card image so the grid tile is never blank.
      if (cloudinaryVideoUrl && productMediaList.length === 0) {
        const posterUrl = cloudinaryVideoUrl
          .replace('/video/upload/', '/video/upload/so_1,q_auto,f_jpg/')
          .replace(/\.[a-zA-Z0-9]+$/, '.jpg')
        productMediaList.push({
          url: posterUrl,
          alt: `${p.name} — poster frame`,
          position: productMediaList.length,
        })
        console.log(`  ✔ Poster frame derived from video: ${posterUrl}`)
      }

      productMediaList.push({
        url: mediaUrl,
        alt: `${p.name} — movement & tailoring video`,
        position: productMediaList.length,
      })
    }

    const allMediaUrls = productMediaList

    // 2. Find or create Category in DB
    const category = await db.category.findUnique({
      where: { slug: p.categorySlug },
    })

    if (!category) {
      console.warn(`  Warning: Category ${p.categorySlug} not found in DB!`)
    }

    // 3. Upsert Product
    const upserted = await db.product.upsert({
      where: { slug: p.slug },
      update: {
        name: p.name,
        subtitle: p.subtitle || undefined,
        description: p.description,
        details: p.details.join('\n'),
        material: p.material || undefined,
        care: p.care || undefined,
        price: p.price,
        compareAtPrice: p.compareAtPrice || null,
        categoryId: category ? category.id : undefined,
        isActive: true,
        isFeatured: true,
      },
      create: {
        slug: p.slug,
        name: p.name,
        subtitle: p.subtitle || undefined,
        description: p.description,
        details: p.details.join('\n'),
        material: p.material || undefined,
        care: p.care || undefined,
        price: p.price,
        compareAtPrice: p.compareAtPrice || null,
        categoryId: category ? category.id : undefined,
        isActive: true,
        isFeatured: true,
      },
    })

    // 4. Update Images in DB
    await db.productImage.deleteMany({
      where: { productId: upserted.id },
    })

    if (allMediaUrls.length > 0) {
      await db.productImage.createMany({
        data: allMediaUrls.map((m) => ({
          productId: upserted.id,
          url: m.url,
          alt: m.alt,
          position: m.position,
        })),
      })
      console.log(`  Saved ${allMediaUrls.length} media records in DB.`)
    }

    // 5. Update Variants in DB
    await db.productVariant.deleteMany({
      where: { productId: upserted.id },
    })

    const folderPrefix = p.folder.toUpperCase().replace(/[^A-Z0-9]/g, '')
    const variantData = []
    for (let cIdx = 0; cIdx < p.colors.length; cIdx++) {
      const color = p.colors[cIdx]
      const colorCode = color.name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase() || `C${cIdx + 1}`
      for (const size of p.sizes) {
        const sku = `${folderPrefix}-${colorCode}-${size}`
        variantData.push({
          productId: upserted.id,
          size,
          color: color.name,
          colorHex: color.hex,
          stock: 6,
          sku,
        })
      }
    }

    await db.productVariant.createMany({
      data: variantData,
    })
    console.log(`  Saved ${variantData.length} variant records (${p.sizes.join(', ')}) in DB.`)
  }

  console.log('\n✔ All products from products_to_upload uploaded successfully!')
}

main()
  .catch((err) => {
    console.error('Upload script failed:', err)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
