/**
 * Style Sence by SKR — editorial image generation.
 * Run: bun scripts/generate-images.ts   (background-safe, skips existing files)
 */
import ZAI from 'z-ai-web-dev-sdk'
import fs from 'fs'
import path from 'path'

const ROOT = path.resolve(__dirname, '..')

const STYLE =
  'editorial fashion photography for a luxury womenswear brand, warm ivory seamless studio backdrop, soft diffused natural window light, muted palette of ivory oat espresso taupe and charcoal only, subtle film grain, photorealistic, high quality, detailed, no text, no watermark, no logos'

type Job = { file: string; prompt: string; size: string }

const JOBS: Job[] = [
  // ——— editorial
  { file: 'public/images/editorial/hero-main.png', size: '1440x736', prompt: 'Wide cinematic editorial fashion scene: two elegant Black women models standing in a minimalist gallery space with raw plaster ivory walls, one in a bias-cut ivory silk slip dress, one in a charcoal tailored blazer and wide-leg trousers, long soft shadows from tall windows, quiet luxury mood, ' + STYLE },
  { file: 'public/images/editorial/look-1.png', size: '864x1152', prompt: 'Full-length editorial studio photograph of a model wearing an ivory relaxed cashmere crewneck sweater tucked into charcoal high-waist wide-leg trousers, hands relaxed, ' + STYLE },
  { file: 'public/images/editorial/look-2.png', size: '864x1152', prompt: 'Full-length editorial studio photograph of a model wearing a charcoal soft-shoulder one-button tailored blazer layered over an ivory bias-cut silk slip dress, ' + STYLE },
  { file: 'public/images/editorial/look-3.png', size: '864x1152', prompt: 'Full-length editorial studio photograph of a model wearing a taupe double-faced longline wool coat falling to mid-shin over an ivory ribbed knit skirt and turtleneck, collar up, ' + STYLE },
  { file: 'public/images/editorial/atelier.png', size: '1344x768', prompt: 'Documentary editorial photograph inside a serene tailoring atelier: close view of a tailor’s hands hand-padding a charcoal wool lapel over an ivory workbench, shears, thread spools and chalk in warm ivory light, ' + STYLE },

  // ——— journal covers
  { file: 'public/images/journal/j1.png', size: '864x1152', prompt: 'Editorial still life of a considered capsule wardrobe: neatly folded ivory and oat cashmere knits and an ivory poplin shirt stacked on a linen-covered surface with a sprig of dried olive branch, ' + STYLE },
  { file: 'public/images/journal/j2.png', size: '864x1152', prompt: 'Editorial close-up of a seamstress’s hands sewing a French seam on ivory silk with a fine needle and thread, tailor’s chalk marks visible, shallow depth of field, ' + STYLE },
  { file: 'public/images/journal/j3.png', size: '864x1152', prompt: 'Abstract editorial study of charcoal wool cloth draped over a wooden dress form, dramatic soft side light revealing texture and depth, ivory wall behind, ' + STYLE },

  // ——— products
  { file: 'public/images/products/silk-slip-dress.png', size: '864x1152', prompt: 'Full-length editorial studio photograph of a model wearing a bias-cut sandwashed ivory silk slip dress with delicate adjustable straps, fluid column silhouette falling to the ankle, ' + STYLE },
  { file: 'public/images/products/silk-slip-dress-detail.png', size: '864x1152', prompt: 'Macro detail photograph of sandwashed ivory silk fabric with a delicate strap and fine French seam, soft sheen, ' + STYLE },
  { file: 'public/images/products/wool-column-dress.png', size: '864x1152', prompt: 'Full-length editorial studio photograph of a model wearing a structured charcoal double-face wool column dress with a straight mid-calf hem and sculpted shoulder, ' + STYLE },
  { file: 'public/images/products/bias-satin-gown.png', size: '864x1152', prompt: 'Full-length editorial studio photograph of a model wearing a champagne heavyweight satin bias-cut floor-length evening gown with a cowl back, liquid drape, ' + STYLE },
  { file: 'public/images/products/cashmere-crewneck.png', size: '864x1152', prompt: 'Full-length editorial studio photograph of a model wearing a relaxed ivory two-ply cashmere crewneck sweater with slight drop shoulder and ribbed cuffs, ' + STYLE },
  { file: 'public/images/products/cashmere-crewneck-detail.png', size: '864x1152', prompt: 'Macro detail photograph of ivory two-ply cashmere knit texture with a ribbed cuff edge, soft halo of fibres, ' + STYLE },
  { file: 'public/images/products/merino-turtleneck.png', size: '864x1152', prompt: 'Full-length editorial studio photograph of a model wearing a charcoal fine-gauge sculpted merino turtleneck with a double-fold standing neck, ' + STYLE },
  { file: 'public/images/products/knitted-column-skirt.png', size: '864x1152', prompt: 'Full-length editorial studio photograph of a model wearing a charcoal ribbed merino knitted column midi skirt with an ivory tucked top, ' + STYLE },
  { file: 'public/images/products/atelier-blazer.png', size: '864x1152', prompt: 'Full-length editorial studio photograph of a model wearing a charcoal soft-shoulder one-button tailored blazer with hand-rolled lapel and slightly longer body over ivory wide-leg trousers, ' + STYLE },
  { file: 'public/images/products/atelier-blazer-detail.png', size: '864x1152', prompt: 'Macro detail photograph of a charcoal wool tailored lapel with a polished horn button and hand-padded chest, exquisite stitching visible, ' + STYLE },
  { file: 'public/images/products/pleated-midi-skirt.png', size: '864x1152', prompt: 'Full-length editorial studio photograph of a model wearing an ivory sunray-pleated midi skirt in gentle motion, pleats catching soft light, paired with a charcoal knit top, ' + STYLE },
  { file: 'public/images/products/wide-leg-trouser.png', size: '864x1152', prompt: 'Full-length editorial studio photograph of a model wearing charcoal high-waist wide-leg fluid trousers with a permanent centre crease and ivory poplin shirt, ' + STYLE },
  { file: 'public/images/products/poplin-shirt.png', size: '864x1152', prompt: 'Full-length editorial studio photograph of a model wearing a crisp ivory organic cotton poplin shirt with a self-standing collar, worn loose over ivory trousers, ' + STYLE },
  { file: 'public/images/products/longline-wool-coat.png', size: '864x1152', prompt: 'Full-length editorial studio photograph of a model wearing a taupe double-faced cashmere-wool longline coat to mid-shin with concealed placket, unstructured elegance, ' + STYLE },
  { file: 'public/images/products/quilted-linen-jacket.png', size: '864x1152', prompt: 'Full-length editorial studio photograph of a model wearing an ivory diamond-quilted linen jacket with a flip collar and throat latch, welt pockets, ' + STYLE },
  { file: 'public/images/products/cashmere-ribbed-scarf.png', size: '864x1152', prompt: 'Editorial studio photograph of a model with an espresso brushed cashmere ribbed scarf wrapped once around the neck, hand-knotted fringe visible, ivory sweater beneath, ' + STYLE },
  { file: 'public/images/products/leather-mini-tote.png', size: '864x1152', prompt: 'Editorial still life of a charcoal vegetable-tanned calfskin mini tote bag with polished brass hardware and hand-burnished edges, standing on an ivory plinth, ' + STYLE },

  // ——— Round 13: two-piece sets
  { file: 'public/images/products/sandwashed-silk-set.png', size: '864x1152', prompt: 'Full-length editorial studio photograph of a model wearing a two-piece sandwashed ivory silk set: a bias-cut shell camisole with delicate straps paired with a matching fluid bias midi skirt, ' + STYLE },
  { file: 'public/images/products/tailored-wool-set.png', size: '864x1152', prompt: 'Full-length editorial studio photograph of a model wearing a matching charcoal two-piece suit set: a soft-shoulder one-button tailored blazer with straight wide-leg trousers of the same wool, ' + STYLE },
  { file: 'public/images/products/satin-evening-set.png', size: '864x1152', prompt: 'Full-length editorial studio photograph of a model wearing a champagne satin two-piece evening set: a draped cowl-neck camisole with wide-leg floor-sweeping satin trousers, liquid sheen, ' + STYLE },
]

async function generateOne(zai: any, job: Job, attempt = 1): Promise<boolean> {
  const outPath = path.join(ROOT, job.file)
  if (fs.existsSync(outPath) && fs.statSync(outPath).size > 20000) {
    console.log(`↷ exists, skipping ${job.file}`)
    return true
  }
  try {
    const res = await zai.images.generations.create({ prompt: job.prompt, size: job.size })
    const b64 = res?.data?.[0]?.base64
    if (!b64) throw new Error('empty response')
    fs.mkdirSync(path.dirname(outPath), { recursive: true })
    fs.writeFileSync(outPath, Buffer.from(b64, 'base64'))
    console.log(`✓ ${job.file} (${job.size})`)
    return true
  } catch (e: any) {
    console.error(`✗ attempt ${attempt} ${job.file}: ${e?.message ?? e}`)
    if (attempt < 3) {
      await new Promise((r) => setTimeout(r, 2500 * attempt))
      return generateOne(zai, job, attempt + 1)
    }
    return false
  }
}

async function main() {
  console.log(`Generating ${JOBS.length} images → ${ROOT}/public/images …`)
  const zai = await ZAI.create()
  let ok = 0
  let fail = 0
  for (const job of JOBS) {
    const success = await generateOne(zai, job)
    if (success) ok++
    else fail++
  }
  console.log(`DONE ok=${ok} fail=${fail}`)
}

main().catch((e) => {
  console.error('FATAL', e)
  process.exit(1)
})
