import { z } from 'zod'

/**
 * Zod schemas for every mutating endpoint (API contract v1).
 * Money values are integer whole Naira.
 */

/** Required email — trimmed + lowercased. */
const emailInput = z.preprocess(
  (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
  z.email('Please enter a valid email address')
)

/** Optional email — empty/null becomes undefined. */
const optionalEmailInput = z.preprocess(
  (v) => {
    if (v === null || v === undefined) return undefined
    if (typeof v === 'string' && v.trim() === '') return undefined
    if (typeof v === 'string') return v.trim().toLowerCase()
    return v
  },
  z.email('Please enter a valid email address').optional()
)

/** Optional free text — empty string becomes undefined. */
const optionalText = (max: number, label: string) =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().trim().max(max, `${label} must be at most ${max} characters`).optional()
  )

/** Optional-or-clearable free text — empty string/null becomes null (clears the column); absent key = not patched. */
const nullableText = (max: number, label: string) =>
  z.preprocess(
    (v) => {
      if (v === null || v === undefined) return v
      if (typeof v === 'string' && v.trim() === '') return null
      return v
    },
    z
      .string()
      .trim()
      .max(max, `${label} must be at most ${max} characters`)
      .nullable()
      .optional()
  )

const requiredText = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(min, `${label} must be at least ${min} characters`)
    .max(max, `${label} must be at most ${max} characters`)

/* ------------------------------------------------------------------ *
 * Storefront
 * ------------------------------------------------------------------ */

export const reviewInput = z.object({
  author: requiredText(2, 80, 'Author name'),
  email: optionalEmailInput,
  rating: z
    .number()
    .int('Rating must be a whole number')
    .min(1, 'Rating must be between 1 and 5')
    .max(5, 'Rating must be between 1 and 5'),
  title: optionalText(120, 'Title'),
  body: requiredText(10, 2000, 'Review'),
})

export const checkoutInput = z.object({
  email: emailInput,
  fullName: requiredText(2, 120, 'Full name'),
  phone: optionalText(40, 'Phone'),
  address: requiredText(4, 200, 'Address'),
  city: requiredText(2, 80, 'City'),
  state: requiredText(2, 80, 'State'),
  notes: optionalText(500, 'Notes'),
  shippingMethod: z.enum(['standard', 'express']),
  promoCode: z
    .string()
    .trim()
    .max(40, 'Promo code is too long')
    .optional()
    .transform((v) => (v === '' ? undefined : v)),
})

export const promoValidateInput = z.object({
  code: z.string().trim().min(1, 'Promo code is required').max(40, 'Promo code is too long'),
  subtotal: z.number().int('Subtotal must be a whole number').min(0).max(100_000_000),
})

export const promoInput = z.object({
  code: z
    .string()
    .trim()
    .min(2, 'Code needs at least 2 characters')
    .max(40, 'Code is too long')
    .transform((v) => v.toUpperCase().replace(/\s+/g, '-')),
  label: optionalText(200, 'Label'),
  type: z.enum(['PERCENT', 'AMOUNT', 'SHIPPING']),
  value: z
    .number()
    .int('Value must be a whole number')
    .min(0, 'Value cannot be negative')
    .max(10_000_000, 'Value is too large'),
  minSubtotal: z.number().int('Minimum subtotal must be a whole number').min(0).max(100_000_000),
  maxUsage: z
    .number()
    .int('Max usage must be a whole number')
    .min(1, 'Max usage must be at least 1')
    .nullable()
    .optional()
    .transform((v) => (v === undefined ? null : v)),
  isActive: z.boolean().optional(),
  expiresAt: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v !== '' ? new Date(v) : null))
    .refine((v) => v === null || !Number.isNaN(v.getTime()), { message: 'Invalid expiry date' }),
})

export const promoPatchInput = z.object({
  label: nullableText(200, 'Label'),
  type: z.enum(['PERCENT', 'AMOUNT', 'SHIPPING']).optional(),
  value: z.number().int('Value must be a whole number').min(0).max(10_000_000).optional(),
  minSubtotal: z.number().int('Minimum subtotal must be a whole number').min(0).max(100_000_000).optional(),
  maxUsage: z
    .number()
    .int('Max usage must be a whole number')
    .min(1, 'Max usage must be at least 1')
    .nullable()
    .optional(),
  isActive: z.boolean().optional(),
  expiresAt: z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((v) => (v && v !== '' ? new Date(v) : v === '' ? null : v)),
})

export const newsletterInput = z.object({
  email: emailInput,
})

export const cartAddInput = z.object({
  variantId: z.string().min(1, 'variantId is required'),
  qty: z
    .number()
    .int('Quantity must be a whole number')
    .min(1, 'Quantity must be between 1 and 10')
    .max(10, 'Quantity must be between 1 and 10'),
})

export const cartPatchInput = z.object({
  itemId: z.string().min(1, 'itemId is required'),
  qty: z
    .number()
    .int('Quantity must be a whole number')
    .min(0, 'Quantity must be between 0 and 10')
    .max(10, 'Quantity must be between 0 and 10'),
})

/* ------------------------------------------------------------------ *
 * Admin auth
 * ------------------------------------------------------------------ */

export const loginInput = z.object({
  email: emailInput,
  password: z.string().min(1, 'Password is required').max(200, 'Password must be at most 200 characters'),
})

export const orderPatchInput = z.object({
  status: z.enum(['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']),
})

export const reviewPatchInput = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']),
})

/* ------------------------------------------------------------------ *
 * Admin products
 * ------------------------------------------------------------------ */

const slugField = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase letters, numbers and hyphens')
    .max(120, 'Slug must be at most 120 characters')
    .optional()
)

export const productInput = z.object({
  name: requiredText(1, 200, 'Name'),
  slug: slugField,
  subtitle: optionalText(200, 'Subtitle'),
  description: requiredText(1, 6000, 'Description'),
  details: optionalText(6000, 'Details'),
  material: optionalText(500, 'Material'),
  care: optionalText(500, 'Care'),
  price: z.number().int('Price must be a whole number of naira').min(1, 'Price must be greater than 0'),
  compareAtPrice: z
    .number()
    .int('Compare-at price must be a whole number')
    .min(1, 'Compare-at price must be greater than 0')
    .nullable()
    .optional(),
  categoryId: optionalText(64, 'categoryId'),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  images: z
    .array(
      z.object({
        url: z.string().trim().min(1, 'Image URL is required').max(500, 'Image URL must be at most 500 characters'),
        alt: optionalText(200, 'Image alt text'),
      })
    )
    .max(12, 'At most 12 images')
    .optional(),
  variants: z
    .array(
      z.object({
        size: requiredText(1, 40, 'Size'),
        color: requiredText(1, 40, 'Color'),
        colorHex: optionalText(20, 'colorHex'),
        stock: z.number().int('Stock must be a whole number').min(0, 'Stock cannot be negative').max(100000),
      })
    )
    .max(50, 'At most 50 variants')
    .optional(),
})

export const productPatchInput = z.object({
  name: productInput.shape.name.optional(),
  slug: slugField,
  subtitle: nullableText(200, 'Subtitle'),
  description: productInput.shape.description.optional(),
  details: nullableText(6000, 'Details'),
  material: nullableText(500, 'Material'),
  care: nullableText(500, 'Care'),
  price: productInput.shape.price.optional(),
  compareAtPrice: z
    .number()
    .int('Compare-at price must be a whole number')
    .min(1, 'Compare-at price must be greater than 0')
    .nullable()
    .optional(),
  categoryId: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
    z.string().trim().min(1, 'categoryId cannot be empty').max(64).nullable().optional()
  ),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  variantStocks: z
    .array(
      z.object({
        id: z.string().min(1, 'Variant id is required'),
        stock: z.number().int('Stock must be a whole number').min(0, 'Stock cannot be negative').max(100000),
      })
    )
    .optional(),
})

/* ------------------------------------------------------------------ *
 * Inferred types
 * ------------------------------------------------------------------ */

export type ReviewInput = z.infer<typeof reviewInput>
export type CheckoutInput = z.infer<typeof checkoutInput>
export type NewsletterInput = z.infer<typeof newsletterInput>
export type LoginInput = z.infer<typeof loginInput>
export type ProductInput = z.infer<typeof productInput>
export type ProductPatchInput = z.infer<typeof productPatchInput>
export type OrderPatchInput = z.infer<typeof orderPatchInput>
export type ReviewPatchInput = z.infer<typeof reviewPatchInput>
export type CartAddInput = z.infer<typeof cartAddInput>
export type CartPatchInput = z.infer<typeof cartPatchInput>
export type PromoValidateInput = z.infer<typeof promoValidateInput>
export type PromoInput = z.infer<typeof promoInput>
export type PromoPatchInput = z.infer<typeof promoPatchInput>
