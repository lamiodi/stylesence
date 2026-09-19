import { v2 as cloudinary } from 'cloudinary'

// Cloudinary automatically parses CLOUDINARY_URL from environment variables if present.
// We also ensure cloud_name fallback if set separately.
if (process.env.CLOUDINARY_URL) {
  cloudinary.config({
    secure: true,
  })
} else if (process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    secure: true,
  })
}

export { cloudinary }

export interface CloudinaryUploadResult {
  url: string
  secure_url: string
  public_id: string
  format: string
  width?: number
  height?: number
  resource_type: string
}

/**
 * Upload an image or media asset to Cloudinary under the 'stylesence' folder.
 */
export async function uploadToCloudinary(
  fileInput: string,
  folder: string = 'stylesence/products',
  resourceType: 'image' | 'video' | 'auto' = 'auto'
): Promise<CloudinaryUploadResult> {
  const result = await cloudinary.uploader.upload(fileInput, {
    folder,
    resource_type: resourceType,
    use_filename: true,
    unique_filename: true,
  })

  return {
    url: result.url,
    secure_url: result.secure_url,
    public_id: result.public_id,
    format: result.format,
    width: result.width,
    height: result.height,
    resource_type: result.resource_type,
  }
}
