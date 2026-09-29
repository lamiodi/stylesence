import { fail, ok } from '@/lib/api-helpers'
import { requireAdmin } from '@/lib/auth'
import { cloudinary } from '@/lib/cloudinary'

/**
 * POST /api/admin/upload-sign
 * Issues short-lived Cloudinary signed-upload credentials so the browser can
 * push media straight to Cloudinary. Product videos are far too large to relay
 * through the Vercel proxy (120s external-rewrite timeout) or buffer as base64
 * on this server, so the admin UI uploads directly to api.cloudinary.com and
 * only asks this endpoint for the signature — a tiny, cookie-authed call that
 * rides the normal same-origin /api path.
 *
 * Body: { "resourceType": "image" | "video" } (defaults to image).
 * Returns { cloudName, apiKey, timestamp, signature, folder, resourceType }.
 * The signature binds folder + timestamp (+ filename-keeping flags); it is
 * useless to anyone without admin credentials to obtain it.
 */
export async function POST(req: Request) {
  const admin = await requireAdmin()
  if (!admin) return fail(401, 'Unauthorized')

  const cfg = cloudinary.config()
  if (!cfg.cloud_name || !cfg.api_key || !cfg.api_secret) {
    return fail(503, 'Cloudinary is not configured on this server.')
  }

  const body = (await req.json().catch(() => ({}))) as { resourceType?: unknown }
  const resourceType = body.resourceType === 'video' ? 'video' : 'image'

  // Values signed as strings — the browser echoes them back in FormData as
  // strings, and any mismatch would fail Cloudinary's signature check.
  const timestamp = Math.round(Date.now() / 1000)
  const paramsToSign = {
    folder: 'stylesence/products',
    timestamp,
    unique_filename: 'true',
    use_filename: 'true',
  }
  const signature = cloudinary.utils.api_sign_request(paramsToSign, cfg.api_secret)

  return ok({
    cloudName: cfg.cloud_name,
    apiKey: cfg.api_key,
    timestamp,
    signature,
    folder: paramsToSign.folder,
    resourceType,
  })
}
