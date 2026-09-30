/** Validate assignments against the final variant set before any product write. */
export function galleryColorError(
  images: readonly { color?: string | null }[],
  variants: readonly { color: string; size: string }[],
): string | null {
  const colors = new Set(variants.map(v => v.color))
  for (const image of images) {
    if (image.color && !colors.has(image.color)) {
      return `Assign images for "${image.color}" to an available colour before saving`
    }
  }
  const combinations = new Set<string>()
  const spelling = new Map<string, string>()
  for (const variant of variants) {
    const normalized = variant.color.toLowerCase()
    if (spelling.has(normalized) && spelling.get(normalized) !== variant.color) {
      return 'Use the same spelling for each colour across all sizes'
    }
    spelling.set(normalized, variant.color)
    const key = `${normalized}|${variant.size.toLowerCase()}`
    if (combinations.has(key)) return `Duplicate size ${variant.size} for ${variant.color}`
    combinations.add(key)
  }
  return null
}
