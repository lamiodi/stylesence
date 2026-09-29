/**
 * One-off quality test: generate a NEW ANGLE of The Ariella Long Dress (powder blue).
 * Complements the existing back-view street photo with a clean studio-front e-commerce shot.
 * Run: npx tsx scripts/gen-one-angle.ts
 */
import ZAI from 'z-ai-web-dev-sdk'
import fs from 'fs'
import path from 'path'

const ROOT = path.resolve(__dirname, '..')

const PROMPT =
  'High-end e-commerce fashion photograph, vertical full-body studio shot, model facing the camera. ' +
  'She wears a two-piece occasion set in crisp pale powder-blue poplin with a soft sheen: ' +
  'a halter-neck crop top with a shirred smocked bandeau bodice, horizontal ruching, a short ruffled peplum hem, ' +
  'and long self-fabric sashes tied behind the neck; and a dramatic full-length maxi skirt with extreme bubble-hem ' +
  'construction — multiple tiers of sculptural cloud-like gathered puffs from hip to floor, dense ruching, voluminous ' +
  'balloon silhouette tapering slightly at the ankle. Modest skin tone, elegant posture, one hand relaxed at her side. ' +
  'Warm ivory seamless studio backdrop, soft diffused natural window light, muted palette, subtle film grain, ' +
  'photorealistic, high quality, detailed fabric texture, no text, no watermark, no logos'

const OUT = 'public/images/generated/ariella-long-front-studio.png'

async function main() {
  const zai = await ZAI.create()
  console.log('generating…')
  const res = await zai.images.generations.create({ prompt: PROMPT, size: '864x1152' })
  const b64 = res?.data?.[0]?.base64
  if (!b64) throw new Error('empty response')
  const outPath = path.join(ROOT, OUT)
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, Buffer.from(b64, 'base64'))
  console.log(`✓ wrote ${outPath} (${Math.round(b64.length * 0.75 / 1024)} KB)`)
}

main().catch((e) => {
  console.error('FATAL', e)
  process.exit(1)
})
