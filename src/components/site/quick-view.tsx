'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Eye, ArrowRight } from 'lucide-react'
import { Link } from '@/lib/router'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAddToCart } from '@/lib/cart-client'
import { ProductImage, Price } from './price'
import { RatingStars } from './rating-stars'
import { useMounted } from '@/hooks/use-mounted'
import { useRecentlyViewed } from '@/lib/store/recently-viewed'
import type { ProductDetail } from '@/lib/types'

/** Client-safe copy of the size ranking (server twin lives in api-helpers). */
const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'One Size'] as const

/**
 * Quick view — hover-revealed pill on product cards opens a dialog with the
 * piece's image, price, colour/size selection and add-to-bag, without leaving
 * the grid. Fetches the full detail only while open.
 */
export function QuickViewButton({
  slug,
  name,
  compact = false,
}: {
  slug: string
  name: string
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={`Quick view ${name}`}
        className={cn(
          'pointer-events-auto absolute bottom-3 left-3 flex items-center gap-1.5 bg-background/90 px-3 py-2 backdrop-blur-sm transition-all duration-500',
          'text-[0.58rem] font-medium uppercase tracking-[0.18em] text-foreground/85 hover:text-espresso',
          'focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-ring',
          'translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100',
          '[@media(hover:none)]:translate-y-0 [@media(hover:none)]:opacity-100',
          compact && 'px-2.5 py-1.5',
        )}
      >
        <Eye className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
        Quick view
      </button>

      <QuickViewDialog slug={slug} open={open} onOpenChange={setOpen} />
    </>
  )
}

function QuickViewDialog({
  slug,
  open,
  onOpenChange,
}: {
  slug: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['product', slug],
    queryFn: async () => {
      const res = await fetch(`/api/products/${slug}`)
      if (!res.ok) throw new Error('Could not load this piece')
      return (await res.json()) as { product: ProductDetail }
    },
    enabled: open,
    retry: false,
    staleTime: 60_000,
  })

  const product = data?.product

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="gap-0 overflow-hidden border-line bg-background p-0 sm:max-w-3xl [&>button]:z-20"
        aria-describedby={undefined}
      >
        {isLoading ? (
          <QuickViewSkeleton />
        ) : isError || !product ? (
          <div className="flex min-h-[16rem] flex-col items-center justify-center px-8 py-16 text-center">
            <p className="font-display text-xl font-light italic">The piece slipped away.</p>
            <p className="mt-2 text-sm text-muted-foreground">
              It could not be loaded — try the full page instead.
            </p>
            <Button
              variant="outline"
              className="mt-6 h-10 border-line-strong uppercase tracking-[0.16em] text-[0.62rem]"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
          </div>
        ) : (
          <QuickViewInner key={product.id} product={product} onDone={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function QuickViewSkeleton() {
  return (
    <div className="grid gap-0 sm:grid-cols-2" aria-busy>
      <div className="aspect-[3/4] animate-pulse bg-secondary sm:aspect-auto sm:h-full sm:min-h-[26rem]" />
      <div className="animate-pulse space-y-4 p-7">
        <div className="h-2.5 w-20 bg-secondary" />
        <div className="h-6 w-3/4 bg-secondary" />
        <div className="h-3 w-1/2 bg-secondary" />
        <div className="h-5 w-28 bg-secondary" />
        <div className="h-20 w-full bg-secondary" />
        <div className="h-9 w-1/2 bg-secondary" />
        <div className="h-11 w-full bg-secondary" />
      </div>
    </div>
  )
}

function QuickViewInner({
  product,
  onDone,
}: {
  product: ProductDetail
  onDone: () => void
}) {
  const addToCart = useAddToCart()
  const mounted = useMounted()
  const pushRecent = useRecentlyViewed((s) => s.push)

  const [color, setColor] = useState<string | null>(
    product.variants.find((v) => v.stock > 0)?.color ?? product.variants[0]?.color ?? null,
  )
  const [size, setSize] = useState<string | null>(
    product.variants.length === 1 ? product.variants[0]?.size ?? null : null,
  )
  const [imgIndex, setImgIndex] = useState(0)

  const colors = useMemo(() => {
    const seen = new Map<string, string>()
    for (const v of product.variants) if (!seen.has(v.color)) seen.set(v.color, v.colorHex)
    return [...seen.entries()].map(([name, hex]) => ({ name, hex }))
  }, [product])

  const sizesForColor = useMemo(() => {
    const rank = (s: string) => {
      const i = (SIZE_ORDER as readonly string[]).indexOf(s)
      return i === -1 ? SIZE_ORDER.length : i
    }
    return (color ? product.variants.filter((v) => v.color === color) : [])
      .slice()
      .sort((a, b) => rank(a.size) - rank(b.size))
  }, [product, color])

  const selectedVariant = useMemo(
    () => product.variants.find((v) => v.color === color && v.size === size) ?? null,
    [product, color, size],
  )

  const onSale = product.compareAtPrice && product.compareAtPrice > product.price
  const images = product.images.slice(0, 5)
  const currentImage = images[imgIndex] ?? images[0]

  const pickColor = (name: string) => {
    setColor(name)
    const stillThere = product.variants.some((v) => v.color === name && v.size === size)
    if (!stillThere) setSize(product.variants.length === 1 ? size : null)
  }

  const add = () => {
    if (!selectedVariant) return
    addToCart.mutate(
      { variantId: selectedVariant.id, qty: 1 },
      {
        onSuccess: () => {
          if (mounted)
            pushRecent({
              slug: product.slug,
              name: product.name,
              price: product.price,
              primaryImage: currentImage?.url ?? null,
            })
          onDone()
        },
      },
    )
  }

  return (
    <div className="grid gap-0 sm:grid-cols-2">
      <DialogDescription className="sr-only">
        Quick view of {product.name} — select a colour and size, then add to bag.
      </DialogDescription>

      {/* gallery */}
      <div className="relative bg-secondary">
        <ProductImage
          src={currentImage?.url ?? null}
          alt={currentImage?.alt ?? product.name}
          label={product.name}
          ratio="aspect-[3/4] sm:aspect-auto sm:h-full sm:min-h-[26rem]"
          eager
        />
        {onSale ? (
          <span className="eyebrow absolute left-3 top-3 bg-espresso px-2.5 py-1 !text-[0.55rem] text-background">
            Archive Price
          </span>
        ) : null}
        {images.length > 1 ? (
          <div className="absolute inset-x-3 bottom-3 flex gap-2">
            {images.map((img, i) => (
              <button
                key={img.url}
                type="button"
                onClick={() => setImgIndex(i)}
                aria-label={`Show image ${i + 1} of ${product.name}`}
                aria-current={i === imgIndex}
                className={cn(
                  'h-12 w-9 overflow-hidden border transition-colors',
                  i === imgIndex
                    ? 'border-foreground'
                    : 'border-transparent opacity-70 hover:opacity-100',
                )}
              >
                <img
                  src={img.url}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* details */}
      <div className="flex flex-col p-6 sm:p-7">
        {product.category ? (
          <Link
            to={`/shop?category=${product.category.slug}`}
            className="eyebrow !text-[0.58rem] hover:text-espresso"
            onClick={onDone}
          >
            {product.category.name}
          </Link>
        ) : null}
        <DialogTitle
          asChild
          className="mt-2 font-display text-2xl font-light leading-tight tracking-tight"
        >
          <h2>{product.name}</h2>
        </DialogTitle>
        {product.subtitle ? (
          <p className="mt-1 text-[0.82rem] italic text-muted-foreground">{product.subtitle}</p>
        ) : null}

        <div className="mt-3 flex items-center gap-3">
          <Price price={product.price} compareAtPrice={product.compareAtPrice} className="text-base" />
          {product.rating && product.reviewCount > 0 ? (
            <span className="flex items-center gap-1.5 text-[0.7rem] text-muted-foreground">
              <RatingStars rating={product.rating} size={11} />
              <span className="font-mono tabular-nums">{product.reviewCount}</span>
            </span>
          ) : null}
        </div>

        <p className="mt-4 line-clamp-4 text-[0.84rem] leading-relaxed text-muted-foreground">
          {product.description}
        </p>

        <div className="mt-5 border-t border-line pt-5">
          {colors.length > 1 ? (
            <>
              <p className="eyebrow !text-[0.58rem]">
                Colour — <span className="text-foreground">{color}</span>
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {colors.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => pickColor(c.name)}
                    aria-pressed={color === c.name}
                    aria-label={`Colour ${c.name}`}
                    className={cn(
                      'flex h-8 items-center gap-2 border px-2.5 text-[0.7rem] transition-colors',
                      color === c.name
                        ? 'border-foreground text-foreground'
                        : 'border-line-strong text-muted-foreground hover:border-foreground hover:text-foreground',
                    )}
                  >
                    <span
                      className="h-3.5 w-3.5 rounded-full border border-line-strong"
                      style={{ backgroundColor: c.hex }}
                      aria-hidden
                    />
                    {c.name}
                  </button>
                ))}
              </div>
            </>
          ) : null}

          <p className={cn('eyebrow !text-[0.58rem]', colors.length > 1 && 'mt-5')}>
            {sizesForColor.length === 1 && sizesForColor[0]?.size === 'One Size' ? 'One size' : 'Size'}
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {sizesForColor.map((v) => {
              const out = v.stock === 0
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setSize(v.size)}
                  disabled={out}
                  aria-pressed={size === v.size}
                  className={cn(
                    'h-9 min-w-11 border px-3 font-mono text-[0.72rem] transition-colors',
                    size === v.size
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-line-strong text-muted-foreground hover:border-foreground hover:text-foreground',
                    out &&
                      'cursor-not-allowed text-muted-foreground/40 line-through hover:border-line-strong hover:text-muted-foreground/40',
                  )}
                >
                  {v.size}
                </button>
              )
            })}
          </div>

          {selectedVariant && selectedVariant.stock > 0 && selectedVariant.stock <= 3 ? (
            <p className="mt-3 text-[0.72rem] text-espresso">
              Only {selectedVariant.stock} left in this colour & size
            </p>
          ) : null}
        </div>

        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
          <Button
            className="h-12 flex-1 uppercase tracking-[0.18em] text-[0.64rem]"
            disabled={!selectedVariant || selectedVariant.stock === 0 || addToCart.isPending}
            onClick={add}
          >
            {addToCart.isPending
              ? 'Adding…'
              : selectedVariant && selectedVariant.stock === 0
                ? 'Sold out'
                : size
                  ? 'Add to bag'
                  : 'Select a size'}
          </Button>
          <Button
            variant="outline"
            className="h-12 border-line-strong uppercase tracking-[0.18em] text-[0.64rem] hover:border-foreground"
            asChild
          >
            <Link to={`/product/${product.slug}`} onClick={onDone} aria-label={`Full details for ${product.name}`}>
              Details
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
            </Link>
          </Button>
        </div>

        {product.material ? (
          <p className="mt-4 text-[0.7rem] text-muted-foreground/80">
            <span className="eyebrow !text-[0.55rem]">Material</span>
            <span className="mx-2 text-muted-foreground/40" aria-hidden>
              ·
            </span>
            {product.material}
          </p>
        ) : null}
      </div>
    </div>
  )
}
