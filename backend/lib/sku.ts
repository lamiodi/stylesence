import { slugify } from '@/lib/api-helpers'

/** Unique SKU in the shape `SS-XXXX-color-size` (random suffix; retries on collision). */
export function generateSku(color: string, size: string, taken: Set<string>): string {
  const colorPart = slugify(color) || 'color'
  const sizePart = slugify(size) || 'size'
  for (let attempt = 0; attempt < 50; attempt++) {
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
    const candidate = `SS-${rand}-${colorPart}-${sizePart}`
    if (!taken.has(candidate)) {
      taken.add(candidate)
      return candidate
    }
  }
  const fallback = `SS-${Date.now().toString(36).toUpperCase()}-${colorPart}-${sizePart}`
  taken.add(fallback)
  return fallback
}
