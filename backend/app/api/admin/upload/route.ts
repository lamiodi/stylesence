import { NextResponse } from 'next/server'
import { fail, ok } from '@/lib/api-helpers'
import { requireAdmin } from '@/lib/auth'
import { uploadToCloudinary } from '@/lib/cloudinary'

/**
 * POST /api/admin/upload
 * Direct media upload endpoint for admins.
 * Accepts multipart/form-data (field: "file") or JSON ({ "file": "data:..." }).
 * Uploads to Cloudinary (under stylesence/products) and returns the secure CDN URL.
 */
export async function POST(req: Request) {
  const admin = await requireAdmin()
  if (!admin) return fail(401, 'Unauthorized')

  if (!process.env.CLOUDINARY_URL && !process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME) {
    return fail(503, 'Cloudinary is not configured on this server.')
  }

  const contentType = req.headers.get('content-type') || ''

  try {
    let fileToUpload: string
    let resourceType: 'image' | 'video' | 'auto' = 'auto'

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      const file = formData.get('file') as File | null
      if (!file) {
        return fail(400, 'No file provided in form data (expected field "file")')
      }

      if (file.type.startsWith('video/')) {
        resourceType = 'video'
      } else if (file.type.startsWith('image/')) {
        resourceType = 'image'
      }

      // Cap uploads before buffering into memory. Videos get Cloudinary's own
      // per-file ceiling; this relay path is the fallback — the admin UI
      // uploads large media directly to Cloudinary via /api/admin/upload-sign.
      const isVideo = resourceType === 'video'
      const MAX_BYTES = isVideo ? 100 * 1024 * 1024 : 10 * 1024 * 1024
      if (file.size > MAX_BYTES) {
        return fail(413, isVideo ? 'File too large — the limit is 100 MB for video.' : 'File too large — the limit is 10 MB for images.')
      }

      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      fileToUpload = `data:${file.type || 'application/octet-stream'};base64,${buffer.toString('base64')}`
    } else {
      const body = await req.json().catch(() => ({}))
      if (!body.file || typeof body.file !== 'string') {
        return fail(400, 'Expected "file" string (base64 data URI or remote URL)')
      }
      fileToUpload = body.file
      if (body.resourceType === 'image' || body.resourceType === 'video') {
        resourceType = body.resourceType
      }
    }

    const result = await uploadToCloudinary(fileToUpload, 'stylesence/products', resourceType)

    return ok({
      url: result.secure_url,
      publicId: result.public_id,
      format: result.format,
      resourceType: result.resource_type,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Upload to Cloudinary failed'
    console.error('Cloudinary upload error:', err)
    return fail(500, message)
  }
}
