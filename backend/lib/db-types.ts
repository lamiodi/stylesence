/**
 * Row types for the public-schema tables (hand-maintained since Prisma was
 * removed — column names match the quoted camelCase identifiers in Postgres).
 * Money is integer Naira throughout; ids are cuid-style strings.
 */

export type AdminUser = {
  id: string
  email: string
  name: string
  passwordHash: string
  role: string
  createdAt: Date
}

export type AdminSession = {
  id: string
  token: string
  adminUserId: string
  expiresAt: Date
  createdAt: Date
}

export type Category = {
  id: string
  slug: string
  name: string
  tagline: string | null
  imageUrl: string | null
  position: number
}

export type Product = {
  id: string
  slug: string
  name: string
  subtitle: string | null
  description: string
  details: string | null
  material: string | null
  care: string | null
  price: number
  compareAtPrice: number | null
  categoryId: string | null
  isActive: boolean
  isFeatured: boolean
  createdAt: Date
  updatedAt: Date
}

export type ProductRelation = {
  id: string
  productId: string
  relatedId: string
  position: number
  createdAt: Date
}

export type ProductImage = {
  id: string
  productId: string
  url: string
  alt: string | null
  color: string | null
  position: number
}

export type ProductVariant = {
  id: string
  productId: string
  size: string
  color: string
  colorHex: string
  sku: string
  stock: number
}

export type Review = {
  id: string
  productId: string
  author: string
  email: string | null
  rating: number
  title: string | null
  body: string
  status: string
  createdAt: Date
}

export type Cart = {
  id: string
  cookieId: string
  createdAt: Date
  updatedAt: Date
}

export type CartItem = {
  id: string
  cartId: string
  variantId: string
  qty: number
  sizeMode: string
  customMeasurements: string | null
  notes: string | null
}

export type Order = {
  id: string
  orderNumber: string
  email: string
  fullName: string
  phone: string | null
  address: string
  city: string
  state: string
  country: string
  notes: string | null
  shippingMethod: string
  shipping: number
  subtotal: number
  discount: number
  promoCode: string | null
  promoCodes: string | null
  productionTier: string
  productionFee: number
  confirmedProduction: boolean
  total: number
  status: string
  paymentMethod: string
  paymentReference: string | null
  createdAt: Date
  updatedAt: Date
}

export type OrderItem = {
  id: string
  orderId: string
  variantId: string | null
  productName: string
  productSlug: string
  size: string
  color: string
  imageUrl: string | null
  unitPrice: number
  qty: number
  sizeMode: string
  customMeasurements: string | null
  notes: string | null
}

export type NewsletterSubscriber = {
  id: string
  email: string
  source: string
  createdAt: Date
}

export type PromoCode = {
  id: string
  code: string
  label: string | null
  type: string
  value: number
  minSubtotal: number
  maxUsage: number | null
  usageCount: number
  singleUsePerCustomer: boolean
  stackable: boolean
  isActive: boolean
  expiresAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export type Customer = {
  id: string
  email: string
  name: string
  passwordHash: string
  phone: string | null
  defaultAddress: string | null
  defaultCity: string | null
  defaultState: string | null
  resetTokenHash: string | null
  resetTokenAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export type CustomerSession = {
  id: string
  token: string
  customerId: string
  expiresAt: Date
  createdAt: Date
}

export type WishlistItem = {
  id: string
  customerId: string
  slug: string
  position: number
  createdAt: Date
}

export type JournalPost = {
  id: string
  slug: string
  title: string
  excerpt: string
  body: string
  category: string
  coverImage: string | null
  readTime: number
  isPublished: boolean
  publishedAt: Date
}

export type StockAlert = {
  id: string
  email: string
  variantId: string
  notifiedAt: Date | null
  createdAt: Date
}
