import { randomUUID } from 'crypto'
import fs from 'fs'
import path from 'path'
import ZAI from 'z-ai-web-dev-sdk'
import { fail, ok, readValidated } from '@/lib/api-helpers'
import { requireAdmin } from '@/lib/auth'
import { z } from 'zod'

/**
 * POST /api/admin/generate-image — atelier image studio.
 * Admin-only. Generates one editorial image via the z-ai SDK, writes it to
 * `public/images/generated/`, and returns `{ url }` for the product form.
 * The house style is prepended server-side so every result stays on-brand.
 */

const HOUSE_STYLE =
  'editorial fashion photography for a luxury womenswear brand, warm ivory seamless studio backdrop, soft diffused natural window light, muted palette of ivory oat espresso taupe and charcoal only, subtle film grain, photorealistic, high quality, detailed, no text, no watermark, no logos'

const generateImageInput = z.object({
  prompt: z
    .string()
    .trim()
    .min(8, 'Describe the image — at least a short phrase')
    .max(600, 'Keep the description under 600 characters'),
  size: z.enum(['864x1152', '1152x864', '1024x1024']).default('864x1152'),
})

export async function POST(req: Request) {
  const admin = await requireAdmin()
  if (!admin) return fail(401, 'Unauthorized')

  const parsed = await readValidated(req, generateImageInput)
  if (!parsed.ok) return parsed.response
  const { prompt, size } = parsed.data

  let zai: Awaited<ReturnType<typeof ZAI.create>>
  try {
    zai = await ZAI.create()
  } catch {
    return fail(503, 'The image service is unavailable right now — try again shortly.')
  }

  const fullPrompt = `${prompt}, ${HOUSE_STYLE}`

  let base64: string | undefined
  try {
    const res = await zai.images.generations.create({ prompt: fullPrompt, size })
    base64 = res?.data?.[0]?.base64
  } catch {
    return fail(502, 'Image generation failed — please retry in a moment.')
  }
  if (!base64) return fail(502, 'Image generation returned an empty result — please retry.')

  // Persist under public/images/generated/ so the URL is servable statically.
  const fileName = `atelier-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}.png`
  const dir = path.join(process.cwd(), 'public', 'images', 'generated')
  try {
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, fileName), Buffer.from(base64, 'base64'))
  } catch {
    return fail(500, 'Could not save the generated image — check server storage.')
  }

  return ok({ url: `/images/generated/${fileName}`, size })
}
