'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Heart, Truck, RefreshCcw, Ruler, ChevronRight, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { Link, navigate } from '@/lib/router'
import { cn } from '@/lib/utils'
import { formatDate, formatNaira } from '@/lib/money'
import { Button } from '@/components/ui/button'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ProductImage, Price } from '@/components/site/price'
import { RatingStars } from '@/components/site/rating-stars'
import { QuantityStepper } from '@/components/site/quantity-stepper'
import { DevPlaceholder } from '@/components/site/dev-placeholder'
import { ProductCard } from '@/components/site/product-card'
import { RecentlyViewedStrip } from '@/components/site/recently-viewed'
import { Reveal } from '@/components/site/reveal'
import { useAddToCart } from '@/lib/cart-client'
import { useWishlist } from '@/lib/store/wishlist'
import { useRecentlyViewed } from '@/lib/store/recently-viewed'
import { useMounted } from '@/hooks/use-mounted'
import type { ProductDetail } from '@/lib/types'

const SIZE_GUIDE = [
  ['XS', '32–34', '84', '66', '92'],
  ['S', '35–37', '88', '70', '96'],
  ['M', '38–40', '94', '76', '102'],
  ['L', '41–43', '100', '82', '108'],
  ['XL', '44–46', '106', '88', '114'],
] as const

function SizeGuideDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground underline decoration-line-strong underline-offset-4 transition-colors hover:text-foreground"
        >
          <Ruler className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
          Size guide
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md rounded-[--radius] border-line bg-background">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-light">Size guide</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Measurements in centimetres. Between sizes? Our cuts run generous — size down for
            tailoring, stay true for knits.
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="eyebrow py-2 pr-4">Size</th>
                <th className="eyebrow py-2 pr-4">UK/EU</th>
                <th className="eyebrow py-2 pr-4">Bust</th>
                <th className="eyebrow py-2 pr-4">Waist</th>
                <th className="eyebrow py-2">Hip</th>
              </tr>
            </thead>
            <tbody className="font-mono text-[0.8rem] tabular-nums">
              {SIZE_GUIDE.map((row) => (
                <tr key={row[0]} className="border-b border-line last:border-0">
                  {row.map((cell, i) => (
                    <td key={i} className={cn('py-2 pr-4', i === 0 && 'font-medium font-sans')}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <DevPlaceholder compact title="Fit consultations">
          Video fit consultations are simulated in this preview.
        </DevPlaceholder>
      </DialogContent>
    </Dialog>
  )
}

function WriteReviewDialog({ slug, product }: { slug: string; product: string }) {
  const [rating, setRating] = useState(5)
  const [author, setAuthor] = useState('')
  const [email, setEmail] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (author.trim().length < 2) return toast.error('Please add your name.')
    if (body.trim().length < 10) return toast.error('Please write at least a sentence or two.')
    setBusy(true)
    try {
      const res = await fetch(`/api/products/${slug}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author: author.trim(),
          email: email.trim() || undefined,
          rating,
          title: title.trim() || undefined,
          body: body.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not submit review')
      toast.success('Thank you — your review is awaiting moderation.')
      setOpen(false)
      setAuthor('')
      setEmail('')
      setTitle('')
      setBody('')
      setRating(5)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not submit review')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="h-11 border-line-strong px-6 uppercase tracking-[0.18em] text-[0.62rem] hover:border-foreground"
        >
          Write a review
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg rounded-[--radius] border-line bg-background">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-light">{product}</DialogTitle>
          <DialogDescription>Your honest impressions — on the record.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label className="eyebrow">Your rating</Label>
            <div className="mt-2 flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  aria-label={`${star} star${star > 1 ? 's' : ''}`}
                  aria-pressed={rating === star}
                  className={cn(
                    'flex h-9 w-9 items-center justify-center border transition-colors focus-visible:outline-2 focus-visible:outline-ring',
                    rating >= star ? 'border-espresso' : 'border-line-strong',
                  )}
                >
                  <span className={cn('text-sm', rating >= star ? 'text-espresso' : 'text-muted-foreground/50')}>
                    ★
                  </span>
                </button>
              ))}
              <span className="ml-2 font-mono text-sm tabular-nums text-muted-foreground">{rating}.0</span>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="rv-name" className="eyebrow">Name *</Label>
              <Input id="rv-name" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Adaeze O." className="h-10 border-line-strong" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rv-email" className="eyebrow">Email (optional)</Label>
              <Input id="rv-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="h-10 border-line-strong" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rv-title" className="eyebrow">Title</Label>
            <Input id="rv-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="It moves like water" className="h-10 border-line-strong" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rv-body" className="eyebrow">Your review *</Label>
            <Textarea id="rv-body" value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="Fit, feel, fabric — tell it as it is." className="border-line-strong" />
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="uppercase tracking-[0.16em] text-[0.62rem]">
              Cancel
            </Button>
            <Button type="submit" disabled={busy} className="uppercase tracking-[0.16em] text-[0.62rem]">
              {busy ? 'Sending…' : 'Submit review'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function ProductDetailPage({ slug }: { slug: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['product', slug],
    queryFn: async () => {
      const res = await fetch(`/api/products/${slug}`)
      if (!res.ok) throw new Error('Not found')
      return (await res.json()) as { product: ProductDetail }
    },
    retry: false,
  })

  const product = data?.product

  useEffect(() => {
    if (product) document.title = `${product.name} — Style Sence`
  }, [product])

  if (isLoading) {
    return (
      <div className="container-site grid gap-10 py-14 lg:grid-cols-2 lg:gap-16" aria-busy>
        <div className="animate-pulse">
          <div className="aspect-[3/4] bg-secondary" />
          <div className="mt-3 flex gap-3">
            {[0, 1].map((i) => <div key={i} className="h-20 w-16 bg-secondary" />)}
          </div>
        </div>
        <div className="animate-pulse space-y-4 pt-6">
          <div className="h-3 w-24 bg-secondary" />
          <div className="h-9 w-3/4 bg-secondary" />
          <div className="h-4 w-1/2 bg-secondary" />
          <div className="h-6 w-32 bg-secondary" />
          <div className="h-24 w-full bg-secondary" />
          <div className="h-11 w-full bg-secondary" />
        </div>
      </div>
    )
  }

  if (isError || !product) {
    return (
      <div className="container-site flex flex-col items-center py-32 text-center">
        <p className="font-display text-4xl font-light italic">This piece has left the rail.</p>
        <p className="mt-3 text-sm text-muted-foreground">
          It may have been retired or the link is mistaken.
        </p>
        <Button
          className="mt-8 h-12 px-8 uppercase tracking-[0.2em] text-[0.66rem]"
          onClick={() => navigate('/shop')}
        >
          Back to the collection
        </Button>
      </div>
    )
  }

  // key resets all selection state when the product changes
  return <ProductInner key={product.id} product={product} />
}

function ProductInner({ product }: { product: ProductDetail }) {
  const [color, setColor] = useState<string | null>(product.variants[0]?.color ?? null)
  const [size, setSize] = useState<string | null>(
    product.variants.length === 1 ? product.variants[0]?.size ?? null : null,
  )
  const [qty, setQty] = useState(1)
  const [imgIndex, setImgIndex] = useState(0)
  const addToCart = useAddToCart()
  const toggleWish = useWishlist((s) => s.toggle)
  const hasWish = useWishlist((s) => s.has)
  const pushRecent = useRecentlyViewed((s) => s.push)
  const mounted = useMounted()

  // sticky mobile buy bar — appears once the main actions scroll out above
  const actionsRef = useRef<HTMLDivElement>(null)
  const [showStickyBar, setShowStickyBar] = useState(false)
  useEffect(() => {
    const el = actionsRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      ([entry]) => {
        // only when the actions left the viewport upwards (scrolled past, not approaching)
        setShowStickyBar(!entry.isIntersecting && entry.boundingClientRect.top < 0)
      },
      { threshold: 0 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // record the visit once per product (external store — safe inside an effect)
  useEffect(() => {
    pushRecent({
      slug: product.slug,
      name: product.name,
      price: product.price,
      primaryImage: product.images[0]?.url ?? null,
      secondaryImage: product.images[1]?.url ?? null,
    })
  }, [product, pushRecent])

  const colors = useMemo(() => {
    const seen = new Map<string, string>()
    for (const v of product.variants) if (!seen.has(v.color)) seen.set(v.color, v.colorHex)
    return [...seen.entries()].map(([name, hex]) => ({ name, hex }))
  }, [product])

  const sizesForColor = useMemo(
    () => (color ? product.variants.filter((v) => v.color === color) : []),
    [product, color],
  )

  const selectedVariant = useMemo(
    () => product.variants.find((v) => v.color === color && v.size === size) ?? null,
    [product, color, size],
  )

  const wished = mounted && hasWish(product.slug)
  const oneSize = product.variants.every((v) => v.size === 'One Size')
  const stockNote =
    selectedVariant && selectedVariant.stock === 0
      ? 'Sold out — join the waitlist below'
      : selectedVariant && selectedVariant.stock <= 3
        ? `Only ${selectedVariant.stock} left in this colour & size`
        : null

  const distribution = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: product.reviews.filter((r) => r.rating === star).length,
  }))
  const maxCount = Math.max(1, ...distribution.map((d) => d.count))

  return (
    <div className="container-site py-8 sm:py-12">
      {/* breadcrumb */}
      <nav aria-label="Breadcrumb" className="eyebrow !text-[0.58rem]">
        <Link to="/shop" className="hover:text-foreground">Shop</Link>
        {product.category ? (
          <>
            <ChevronRight className="mx-1.5 inline h-2.5 w-2.5" aria-hidden />
            <Link to={`/shop?category=${product.category.slug}`} className="hover:text-foreground">
              {product.category.name}
            </Link>
          </>
        ) : null}
        <ChevronRight className="mx-1.5 inline h-2.5 w-2.5" aria-hidden />
        <span className="text-foreground">{product.name}</span>
      </nav>

      <div className="mt-6 grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
        {/* ————— gallery ————— */}
        <div>
          <div className="relative">
            <ProductImage
              key={product.images[imgIndex]?.url ?? 'none'}
              src={product.images[imgIndex]?.url}
              alt={product.images[imgIndex]?.alt ?? product.name}
              label={product.name}
              ratio="aspect-[3/4]"
              eager
              className="w-full"
            />
            {product.compareAtPrice && product.compareAtPrice > product.price ? (
              <span className="eyebrow absolute left-4 top-4 bg-espresso px-2.5 py-1 !text-[0.55rem] text-background">
                Archive price
              </span>
            ) : null}
          </div>
          {product.images.length > 1 ? (
            <div className="mt-3 flex gap-3">
              {product.images.map((img, i) => (
                <button
                  key={img.url}
                  type="button"
                  onClick={() => setImgIndex(i)}
                  aria-label={`View image ${i + 1} of ${product.images.length}`}
                  aria-pressed={imgIndex === i}
                  className={cn(
                    'w-20 border transition-colors focus-visible:outline-2 focus-visible:outline-ring',
                    imgIndex === i ? 'border-foreground' : 'border-transparent hover:border-line-strong',
                  )}
                >
                  <ProductImage src={img.url} alt={img.alt ?? product.name} label="" ratio="aspect-[3/4]" />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {/* ————— info ————— */}
        <div className="lg:pt-2">
          {product.category ? <p className="eyebrow">{product.category.name}</p> : null}
          <h1 className="mt-2 font-display text-3xl font-light leading-tight tracking-tight text-balance sm:text-4xl">
            {product.name}
          </h1>
          {product.subtitle ? (
            <p className="mt-1.5 font-display text-lg italic text-muted-foreground">{product.subtitle}</p>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <Price price={product.price} compareAtPrice={product.compareAtPrice} size="lg" />
            {product.rating ? (
              <a
                href="#reviews"
                className="flex items-center gap-2 text-[0.72rem] text-muted-foreground transition-colors hover:text-foreground"
                onClick={(e) => {
                  e.preventDefault()
                  document.getElementById('reviews')?.scrollIntoView({ behavior: 'smooth' })
                }}
              >
                <RatingStars rating={product.rating} />
                {product.rating.toFixed(1)} · {product.reviewCount} reviews
              </a>
            ) : (
              <span className="text-[0.72rem] text-muted-foreground">No reviews yet — be first</span>
            )}
          </div>

          <div className="mt-5 border-t border-line pt-5">
            {product.description.split('\n\n').map((para, i) => (
              <p key={i} className="mb-3 text-sm leading-relaxed text-muted-foreground last:mb-0">
                {para}
              </p>
            ))}
          </div>

          {/* colour */}
          <div className="mt-6">
            <p className="eyebrow">
              Colour — <span className="text-foreground">{color ?? 'Select'}</span>
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2.5" role="radiogroup" aria-label="Colour">
              {colors.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  role="radio"
                  aria-checked={color === c.name}
                  onClick={() => {
                    setColor(c.name)
                    if (oneSize) setSize('One Size')
                  }}
                  className={cn(
                    'flex items-center gap-2 border px-3 py-2 text-[0.72rem] transition-colors focus-visible:outline-2 focus-visible:outline-ring',
                    color === c.name
                      ? 'border-foreground text-foreground'
                      : 'border-line-strong text-muted-foreground hover:border-foreground hover:text-foreground',
                  )}
                >
                  <span
                    className="h-4 w-4 rounded-full border border-line-strong"
                    style={{ backgroundColor: c.hex }}
                    aria-hidden
                  />
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {/* size */}
          {!oneSize ? (
            <div className="mt-6">
              <div className="flex items-baseline justify-between">
                <p className="eyebrow">
                  Size — <span className="text-foreground">{size ?? 'Select'}</span>
                </p>
                <SizeGuideDialog />
              </div>
              <div className="mt-2.5 flex flex-wrap gap-2" role="radiogroup" aria-label="Size">
                {sizesForColor.map((v) => {
                  const soldOut = v.stock === 0
                  return (
                    <button
                      key={v.id}
                      type="button"
                      role="radio"
                      aria-checked={size === v.size}
                      disabled={soldOut}
                      onClick={() => setSize(v.size)}
                      className={cn(
                        'h-11 min-w-14 border px-4 font-mono text-[0.78rem] transition-colors focus-visible:outline-2 focus-visible:outline-ring',
                        size === v.size
                          ? 'border-foreground bg-foreground text-background'
                          : soldOut
                            ? 'cursor-not-allowed border-line text-muted-foreground/40 line-through'
                            : 'border-line-strong text-muted-foreground hover:border-foreground hover:text-foreground',
                      )}
                    >
                      {v.size}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}

          {/* qty + stock */}
          <div className="mt-6 flex items-center gap-5">
            <QuantityStepper value={qty} onChange={setQty} min={1} max={Math.min(10, selectedVariant?.stock ?? 10)} />
            {stockNote ? (
              <p className={cn('text-[0.72rem] font-medium', selectedVariant?.stock === 0 ? 'text-destructive' : 'text-espresso')}>
                {stockNote}
              </p>
            ) : null}
          </div>

          {/* actions */}
          <div ref={actionsRef} className="mt-6 flex gap-3">
            <Button
              className="h-12 flex-1 uppercase tracking-[0.2em] text-[0.66rem]"
              disabled={!selectedVariant || selectedVariant.stock === 0 || addToCart.isPending}
              onClick={() => {
                if (!selectedVariant) return toast.error('Please select a size first.')
                addToCart.mutate({ variantId: selectedVariant.id, qty })
              }}
            >
              {addToCart.isPending
                ? 'Adding…'
                : selectedVariant?.stock === 0
                  ? 'Sold out'
                  : 'Add to bag'}
            </Button>
            <Button
              variant="outline"
              aria-pressed={wished}
              className="h-12 w-12 border-line-strong p-0 hover:border-espresso hover:text-espresso"
              onClick={() => {
                const added = toggleWish({
                  slug: product.slug,
                  name: product.name,
                  price: product.price,
                  primaryImage: product.images[0]?.url ?? null,
                  addedAt: Date.now(),
                })
                toast(added ? 'Saved to wishlist' : 'Removed from wishlist', {
                  description: product.name,
                })
              }}
              aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'}
            >
              <Heart className={cn('h-[1.1rem] w-[1.1rem]', wished && 'fill-espresso text-espresso')} strokeWidth={1.5} />
            </Button>
          </div>

          {/* accordions */}
          <div className="mt-8 border-t border-line">
            <Accordion type="single" collapsible className="border-0">
              {product.details.length > 0 ? (
                <AccordionItem value="details" className="border-line">
                  <AccordionTrigger className="py-4 text-[0.7rem] font-medium uppercase tracking-[0.2em] hover:no-underline">
                    Details
                  </AccordionTrigger>
                  <AccordionContent className="pb-5">
                    <ul className="space-y-2">
                      {product.details.map((d, i) => (
                        <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-muted-foreground">
                          <span className="mt-[0.55rem] h-[3px] w-[3px] shrink-0 rounded-full bg-espresso" aria-hidden />
                          {d}
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              ) : null}
              {product.material || product.care ? (
                <AccordionItem value="material" className="border-line">
                  <AccordionTrigger className="py-4 text-[0.7rem] font-medium uppercase tracking-[0.2em] hover:no-underline">
                    Material &amp; care
                  </AccordionTrigger>
                  <AccordionContent className="pb-5 text-sm leading-relaxed text-muted-foreground">
                    {product.material ? (
                      <p>
                        <span className="eyebrow mr-2 !text-[0.58rem]">Cloth</span>
                        {product.material}
                      </p>
                    ) : null}
                    {product.care ? (
                      <p className="mt-2">
                        <span className="eyebrow mr-2 !text-[0.58rem]">Care</span>
                        {product.care}
                      </p>
                    ) : null}
                  </AccordionContent>
                </AccordionItem>
              ) : null}
              <AccordionItem value="shipping" className="border-line">
                <AccordionTrigger className="py-4 text-[0.7rem] font-medium uppercase tracking-[0.2em] hover:no-underline">
                  Shipping &amp; returns
                </AccordionTrigger>
                <AccordionContent className="pb-5">
                  <ul className="space-y-2.5 text-sm text-muted-foreground">
                    <li className="flex gap-2.5">
                      <Truck className="mt-0.5 h-4 w-4 shrink-0 text-espresso" strokeWidth={1.5} aria-hidden />
                      Standard ₦3,500 — 3–5 days nationwide · Express ₦7,500 — 1–2 days
                    </li>
                    <li className="flex gap-2.5">
                      <RefreshCcw className="mt-0.5 h-4 w-4 shrink-0 text-espresso" strokeWidth={1.5} aria-hidden />
                      Complimentary returns within 14 days, tags attached
                    </li>
                  </ul>
                  <DevPlaceholder compact className="mt-3" title="Courier & returns portal">
                    Live courier booking and returns portal are simulated in this environment.
                  </DevPlaceholder>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </div>

      {/* ————— reviews ————— */}
      <section id="reviews" className="mt-20 scroll-mt-24 border-t border-line pt-12">
        <div className="grid gap-10 lg:grid-cols-[20rem_1fr] lg:gap-16">
          <Reveal>
            <p className="eyebrow">Client notes</p>
            <h2 className="mt-2 font-display text-3xl font-light tracking-tight">Reviews</h2>
            {product.rating ? (
              <>
                <div className="mt-5 flex items-end gap-3">
                  <span className="font-display text-6xl font-light leading-none">
                    {product.rating.toFixed(1)}
                  </span>
                  <div className="pb-1.5">
                    <RatingStars rating={product.rating} size={16} />
                    <p className="mt-1 text-[0.7rem] text-muted-foreground">
                      {product.reviewCount} verified reviews
                    </p>
                  </div>
                </div>
                <div className="mt-6 space-y-1.5">
                  {distribution.map((d) => (
                    <div key={d.star} className="flex w-full items-center gap-3" aria-label={`${d.star} star reviews: ${d.count}`}>
                      <span className="w-6 font-mono text-[0.68rem] text-muted-foreground tabular-nums">{d.star}★</span>
                      <span className="relative h-1.5 flex-1 overflow-hidden bg-secondary">
                        <span
                          className="absolute inset-y-0 left-0 bg-espresso"
                          style={{ width: `${(d.count / maxCount) * 100}%` }}
                        />
                      </span>
                      <span className="w-6 text-right font-mono text-[0.68rem] text-muted-foreground tabular-nums">{d.count}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
                No reviews yet. Yours would set the tone.
              </p>
            )}
            <div className="mt-7">
              <WriteReviewDialog slug={product.slug} product={product.name} />
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            {product.reviews.length === 0 ? (
              <div className="border border-dashed border-line-strong px-8 py-16 text-center">
                <p className="font-display text-xl italic text-muted-foreground">
                  The quiet before the first note.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {product.reviews.map((r) => (
                  <li key={r.id} className="py-6">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <RatingStars rating={r.rating} size={12} />
                        <span className="text-[0.72rem] font-medium">{r.author}</span>
                      </div>
                      <span className="text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground/70">
                        {formatDate(r.createdAt)}
                      </span>
                    </div>
                    {r.title ? (
                      <h3 className="mt-2 font-display text-lg font-light tracking-tight">{r.title}</h3>
                    ) : null}
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{r.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </Reveal>
        </div>
      </section>

      {/* ————— related (curated "Complete the look" when styled by the atelier) ————— */}
      {product.related.length > 0 ? (
        <section className="mt-20 border-t border-line pt-12">
          <div className="flex items-end justify-between">
            <div>
              <p className="eyebrow">
                {product.relatedSource === 'curated' || product.relatedSource === 'mixed'
                  ? 'Styled by the atelier'
                  : 'Styled together'}
              </p>
              <h2 className="mt-2 font-display text-3xl font-light tracking-tight">Complete the look</h2>
            </div>
            <Link
              to="/shop"
              className="eyebrow-ink hidden items-center gap-1.5 border-b border-foreground pb-1 transition-colors hover:border-espresso hover:text-espresso sm:flex"
            >
              <ArrowLeft className="h-3 w-3 rotate-180" strokeWidth={1.5} aria-hidden />
              All pieces
            </Link>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4 md:gap-x-6">
            {product.related.map((r) => (
              <ProductCard
                key={r.slug}
                product={{
                  id: r.slug,
                  slug: r.slug,
                  name: r.name,
                  subtitle: null,
                  price: r.price,
                  compareAtPrice: null,
                  primaryImage: r.primaryImage,
                  secondaryImage: r.secondaryImage,
                  colors: [],
                  sizes: [],
                  rating: null,
                  reviewCount: 0,
                  isNew: false,
                }}
                eager
              />
            ))}
          </div>
          <p className="mt-6 font-mono text-[0.68rem] text-muted-foreground/70">
            {formatNaira(product.price)} · in {product.category?.name ?? 'the collection'}
          </p>
        </section>
      ) : null}

      {/* ————— recently viewed ————— */}
      <RecentlyViewedStrip
        excludeSlug={product.slug}
        className="mt-20 border-t border-line pt-12"
      />

      {/* ————— sticky mobile buy bar (appears once the actions scroll away) ————— */}
      <div
        inert={!showStickyBar}
        aria-hidden={!showStickyBar}
        className={cn(
          'no-print fixed inset-x-0 bottom-0 z-40 border-t border-line-strong bg-background/95 backdrop-blur-md',
          'px-4 pb-[max(0.625rem,env(safe-area-inset-bottom))] pt-2.5 lg:hidden',
          'transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]',
          showStickyBar ? 'translate-y-0' : 'pointer-events-none translate-y-full',
        )}
      >
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[0.92rem] leading-tight tracking-tight">
              {product.name}
            </p>
            <p className="mt-0.5 truncate font-mono text-[0.74rem] text-muted-foreground tabular-nums">
              {formatNaira(product.price)}
              {selectedVariant ? (
                <span className="text-foreground">
                  {' '}
                  · {selectedVariant.color} · {selectedVariant.size}
                  {qty > 1 ? ` · ×${qty}` : ''}
                </span>
              ) : (
                <span className="text-espresso"> · select a size</span>
              )}
            </p>
          </div>
          <Button
            className="h-11 shrink-0 px-7 uppercase tracking-[0.18em] text-[0.64rem]"
            disabled={!selectedVariant || selectedVariant.stock === 0 || addToCart.isPending}
            onClick={() => {
              if (!selectedVariant) {
                toast.error('Please select a size first.')
                actionsRef.current?.scrollIntoView({ block: 'center' })
                return
              }
              addToCart.mutate({ variantId: selectedVariant.id, qty })
            }}
          >
            {addToCart.isPending
              ? 'Adding…'
              : selectedVariant?.stock === 0
                ? 'Sold out'
                : 'Add to bag'}
          </Button>
        </div>
      </div>
    </div>
  )
}
