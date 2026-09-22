'use client'

import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useReducedMotion } from 'framer-motion'
import { ArrowRight, ArrowUpRight, Clock3 } from 'lucide-react'
import { Link, navigate } from '@/lib/router'
import { Reveal } from '@/components/site/reveal'
import { ProductCard, ProductCardSkeleton } from '@/components/site/product-card'
import { ProductImage } from '@/components/site/price'
import { formatDate, formatNaira } from '@/lib/money'
import { RecentlyViewedStrip } from '@/components/site/recently-viewed'
import type { ProductsResponse, Category, JournalCard, LookView } from '@/lib/types'

/**
 * Hero film — the Àrẹ̀wà Set in motion. The video is trimmed to start at 1s
 * (so_1) and the poster is that exact frame, so the still paints instantly
 * while the video streams and the hand-off is seamless. Reduced-motion
 * visitors get the still, never the motion.
 */
const HERO_VIDEO =
  'https://res.cloudinary.com/qaruxkhf/video/upload/so_1,q_auto/v1790053166/stylesence/products/IMG_7612_yc1iae.mp4'
const HERO_POSTER =
  'https://res.cloudinary.com/qaruxkhf/video/upload/so_1,q_auto,f_jpg/v1790053166/stylesence/products/IMG_7612_yc1iae.jpg'

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Request failed')
  return res.json()
}

/** Loading placeholder for an editorial look (image + piece rows). */
function LookSkeleton() {
  return (
    <div className="animate-pulse" aria-hidden>
      <div className="aspect-[4/5] bg-secondary" />
      <div className="mt-4 space-y-2.5">
        <div className="h-11 bg-secondary" />
        <div className="h-11 bg-secondary" />
        <div className="h-11 bg-secondary" />
      </div>
    </div>
  )
}

function SectionHead({
  eyebrow,
  title,
  href,
  hrefLabel = 'View all',
}: {
  eyebrow: string
  title: string
  href?: string
  hrefLabel?: string
}) {
  return (
    <div className="flex items-end justify-between gap-6">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="mt-2 font-display text-3xl font-light tracking-tight text-balance sm:text-4xl">
          {title}
        </h2>
      </div>
      {href ? (
        <Link
          to={href}
          className="eyebrow-ink group hidden shrink-0 items-center gap-1.5 border-b border-foreground pb-1 transition-colors hover:border-espresso hover:text-espresso sm:flex"
        >
          {hrefLabel}
          <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" strokeWidth={1.5} aria-hidden />
        </Link>
      ) : null}
    </div>
  )
}

export function HomePage() {
  const prefersReducedMotion = useReducedMotion()

  useEffect(() => {
    document.title = 'Style Sence by SKR — Modern Womenswear'
  }, [])

  const { data: newArrivals, isLoading: loadingNew } = useQuery({
    queryKey: ['home', 'newest'],
    queryFn: () => fetchJson<ProductsResponse>('/api/products?sort=newest&perPage=8'),
  })
  const { data: bestsellers, isLoading: loadingBest } = useQuery({
    queryKey: ['home', 'bestsellers'],
    queryFn: () => fetchJson<ProductsResponse>('/api/products?sort=rating&perPage=4'),
  })
  const { data: catsData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => fetchJson<{ categories: Category[] }>('/api/categories'),
    staleTime: 5 * 60_000,
  })
  const { data: journalData } = useQuery({
    queryKey: ['journal'],
    queryFn: () => fetchJson<{ posts: JournalCard[] }>('/api/journal'),
    staleTime: 5 * 60_000,
  })
  const { data: looksData, isLoading: loadingLooks } = useQuery({
    queryKey: ['looks'],
    queryFn: () => fetchJson<{ looks: LookView[] }>('/api/looks'),
    staleTime: 5 * 60_000,
  })

  // only categories with live pieces belong on the storefront
  const categories = (catsData?.categories ?? []).filter((c) => c.productCount > 0)
  const posts = journalData?.posts ?? []
  const looks = looksData?.looks ?? []

  return (
    <div>
      {/* ————— HERO ————— */}
      <section className="relative" aria-label="Featured collection">
        <div className="relative h-[78vh] min-h-[30rem] overflow-hidden bg-primary">
          {prefersReducedMotion ? (
            <ProductImage
              src={HERO_POSTER}
              alt="The Àrẹ̀wà Set — hand-woven Aso Oke, worn in motion"
              label="The Signature Collection"
              ratio="h-full"
              eager
              className="h-full w-full"
            />
          ) : (
            <video
              src={HERO_VIDEO}
              poster={HERO_POSTER}
              autoPlay
              loop
              muted
              playsInline
              aria-label="The Àrẹ̀wà Set — hand-woven Aso Oke, worn in motion"
              className="h-full w-full object-cover"
            />
          )}
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-primary/85 via-primary/35 to-primary/10"
          />
          <div className="container-site absolute inset-0 flex items-end pb-16 sm:items-center sm:pb-0">
            <Reveal className="max-w-xl">
              <p className="eyebrow !text-primary-foreground/85">Made to order — Lagos, Nigeria</p>
              <h1 className="mt-4 font-display text-5xl font-light leading-[1.05] tracking-tight text-primary-foreground sm:text-6xl lg:text-7xl">
                The Signature Collection
              </h1>
              <p className="mt-5 max-w-md text-[0.95rem] leading-relaxed text-primary-foreground/85">
                Polka-dot silk coordinates, fluid Ariella gowns and hand-woven Aso Oke —
                every piece cut to your measurements and delivered nationwide.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/shop')}
                  className="h-12 bg-primary-foreground px-8 text-[0.7rem] font-medium uppercase tracking-[0.22em] text-primary transition-all hover:bg-background focus-visible:outline-2 focus-visible:outline-primary-foreground"
                >
                  Shop the collection
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/journal/the-camille-edit')}
                  className="h-12 border border-primary-foreground/50 px-8 text-[0.7rem] font-medium uppercase tracking-[0.22em] text-primary-foreground transition-colors hover:border-primary-foreground hover:bg-primary-foreground/10"
                >
                  Read the edit
                </button>
              </div>
              {/* house meta line — quiet mono sign-off under the hero actions */}
              <p className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[0.6rem] uppercase tracking-[0.26em] text-primary-foreground/65">
                <span>Lagos</span>
                <span className="text-primary-foreground/40" aria-hidden>
                  ·
                </span>
                <span>Est. 2026</span>
                <span className="text-primary-foreground/40" aria-hidden>
                  ·
                </span>
                <span>Ships nationwide</span>
              </p>
            </Reveal>
          </div>
          {/* scroll cue — a quiet invitation (static; honours reduced-motion by design) */}
          <div
            aria-hidden
            className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2.5 md:flex"
          >
            <span className="font-mono text-[0.55rem] uppercase tracking-[0.32em] text-primary-foreground/60">
              Scroll
            </span>
            <span className="h-10 w-px bg-primary-foreground/35" />
          </div>
        </div>
      </section>

      {/* ————— NEW ARRIVALS ————— */}
      <section className="container-site py-16 sm:py-20" aria-label="New arrivals">
        <Reveal>
          <SectionHead eyebrow="Just in" title="New arrivals" href="/shop" hrefLabel="Shop all pieces" />
        </Reveal>
        <Reveal delay={0.1} className="mt-8">
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4 md:gap-x-6">
            {loadingNew
              ? Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)
              : (newArrivals?.products ?? []).map((p, i) => (
                  <ProductCard key={p.id} product={p} eager index={i} />
                ))}
          </div>
          <div className="mt-8 flex justify-center sm:hidden">
            <Link
              to="/shop"
              className="eyebrow-ink flex items-center gap-1.5 border-b border-foreground pb-1"
            >
              Shop all pieces <ArrowRight className="h-3 w-3" aria-hidden />
            </Link>
          </div>
        </Reveal>
      </section>

      {/* ————— CATEGORIES ————— */}
      <section className="border-y border-line bg-secondary/50 py-16 sm:py-20" aria-label="Shop by category">
        <div className="container-site">
          <Reveal>
            <SectionHead eyebrow="The wardrobe" title="Shop by category" href="/shop" />
          </Reveal>
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 lg:gap-5">
            {categories.map((c, i) => (
              <Reveal key={c.id} delay={i * 0.06}>
                <Link
                  to={`/shop?category=${c.slug}`}
                  className="group block focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <div className="relative overflow-hidden">
                    <ProductImage
                      src={c.imageUrl}
                      alt={c.name}
                      label={c.name}
                      ratio="aspect-[3/4]"
                      className="transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]"
                    />
                    <div
                      aria-hidden
                      className="absolute inset-0 bg-gradient-to-t from-primary/70 via-transparent to-transparent"
                    />
                    <div className="absolute inset-x-0 bottom-0 p-4">
                      <p className="font-display text-lg font-light tracking-tight text-primary-foreground">
                        {c.name}
                      </p>
                      <p className="mt-0.5 text-[0.62rem] uppercase tracking-[0.2em] text-primary-foreground/70">
                        {c.productCount} pieces
                      </p>
                    </div>
                    <div className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center bg-background/90 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
                      <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
                    </div>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ————— EDITORIAL SPLIT ————— */}
      <section className="container-site grid items-center gap-10 py-16 sm:py-24 lg:grid-cols-2 lg:gap-16" aria-label="House philosophy">
        <Reveal>
          <div className="relative">
            <ProductImage
              src="https://res.cloudinary.com/qaruxkhf/image/upload/w_1400,q_auto,f_auto/v1790056413/stylesence/products/camille-skirt-slate.jpg"
              alt="The Camille Skirt Set in slate-blue polka dot, worn on the staircase"
              label="The Camille Skirt Set"
              ratio="aspect-[4/5]"
            />
            <div className="absolute -bottom-5 -right-3 hidden bg-background px-6 py-5 sm:block lg:-right-6">
              <p className="font-display text-3xl font-light">05<span className="text-espresso">—</span>made to order</p>
              <p className="eyebrow mt-1 !text-[0.55rem]">The Signature Collection</p>
            </div>
          </div>
        </Reveal>
        <Reveal delay={0.12}>
          <p className="eyebrow">The philosophy</p>
          <h2 className="mt-3 font-display text-3xl font-light leading-tight tracking-tight text-balance sm:text-4xl">
            Coordinates that speak to each other.
          </h2>
          <p className="mt-5 text-[0.95rem] leading-relaxed text-muted-foreground">
            The Camille top moves between its matching skirt and trousers; the Ariella
            silhouette drapes from mini to floor. Buy the set, wear it apart — every
            piece is cut to your measure, in cloth chosen to live together.
          </p>
          <ul className="mt-8 divide-y divide-line border-y border-line">
            {[
              ['01', 'Cloth', 'Silk charmeuse, fluid crepe, hand-loomed Aso Oke.'],
              ['02', 'Cut', 'Made to your measurements — standard XS–XXL or bespoke.'],
              ['03', 'Conscience', 'Made to order in Lagos, never over-produced.'],
            ].map(([n, t, d]) => (
              <li key={n} className="flex items-baseline gap-5 py-4">
                <span className="font-mono text-[0.7rem] text-espresso">{n}</span>
                <div className="flex flex-1 items-baseline justify-between gap-4">
                  <span className="font-display text-lg tracking-tight">{t}</span>
                  <span className="text-right text-sm text-muted-foreground">{d}</span>
                </div>
              </li>
            ))}
          </ul>
          <Link
            to="/about"
            className="eyebrow-ink mt-7 inline-flex items-center gap-1.5 border-b border-foreground pb-1 transition-colors hover:border-espresso hover:text-espresso"
          >
            The house story
            <ArrowRight className="h-3 w-3" strokeWidth={1.5} aria-hidden />
          </Link>
        </Reveal>
      </section>

      {/* ————— BESTSELLERS ————— */}
      <section className="container-site pb-16 sm:pb-20" aria-label="Most loved">
        <Reveal>
          <SectionHead eyebrow="Most loved" title="Bestsellers" href="/shop" hrefLabel="Shop all" />
        </Reveal>
        <Reveal delay={0.1} className="mt-8">
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4 md:gap-x-6">
            {loadingBest
              ? Array.from({ length: 4 }).map((_, i) => <ProductCardSkeleton key={i} />)
              : (bestsellers?.products ?? []).map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
          </div>
        </Reveal>
      </section>

      {/* ————— SHOP THE LOOK ————— */}
      {loadingLooks || looks.length > 0 ? (
        <section className="container-site py-16 sm:py-20" aria-label="Shop the look">
          <Reveal>
            <SectionHead eyebrow="Styled by the house" title="Shop the look" href="/shop" hrefLabel="Shop all pieces" />
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Looks composed from the collection — every piece chosen to speak to the others.
              Tap a piece to make it yours.
            </p>
          </Reveal>
          <div className="mt-10 grid gap-10 md:grid-cols-3 lg:gap-12">
            {loadingLooks
              ? Array.from({ length: 3 }).map((_, i) => <LookSkeleton key={i} />)
              : looks.map((look, i) => (
                  <Reveal key={look.slug} delay={i * 0.08}>
                    <figure className="group/look">
                      <Link
                        to={`/product/${look.slug}`}
                        className="block focus-visible:outline-2 focus-visible:outline-ring"
                        aria-label={`View ${look.title}`}
                      >
                        <div className="relative overflow-hidden">
                          <ProductImage
                            src={look.image}
                            alt={look.title}
                            label={look.title}
                            ratio="aspect-[4/5]"
                            className="transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/look:scale-[1.03]"
                          />
                          <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-primary/80 via-primary/30 to-transparent p-4 pt-12">
                            <p className="eyebrow !text-primary-foreground/80">
                              Look {String(i + 1).padStart(2, '0')}
                              {look.categoryName ? ` — ${look.categoryName}` : ''}
                            </p>
                            <p className="mt-1 font-display text-xl font-light text-primary-foreground">{look.title}</p>
                          </figcaption>
                        </div>
                      </Link>
                      <ul className="mt-4 space-y-2.5">
                        {look.pieces.map((piece) => (
                          <li key={piece.slug}>
                            <Link
                              to={`/product/${piece.slug}`}
                              className="group/row flex items-center gap-3 border border-line bg-card px-3 py-2.5 transition-colors hover:border-foreground"
                            >
                              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-espresso" aria-hidden />
                              <span className="min-w-0 flex-1 truncate font-display text-[0.92rem] tracking-tight group-hover/row:text-espresso">
                                {piece.name}
                              </span>
                              <span className="shrink-0 font-mono text-[0.72rem] text-muted-foreground tabular-nums">
                                {formatNaira(piece.price)}
                              </span>
                              <ArrowUpRight
                                className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50 transition-colors group-hover/row:text-espresso"
                                strokeWidth={1.5}
                                aria-hidden
                              />
                            </Link>
                          </li>
                        ))}
                        <li className="flex items-baseline justify-between border-t border-line pt-3" aria-label="Look total">
                          <span className="eyebrow !text-[0.58rem]">The look — {look.pieces.length} pieces</span>
                          <span className="font-mono text-[0.78rem] tracking-tight text-foreground tabular-nums">
                            {formatNaira(look.pieces.reduce((sum, p) => sum + p.price, 0))}
                          </span>
                        </li>
                      </ul>
                    </figure>
                  </Reveal>
                ))}
          </div>
        </section>
      ) : null}

      {/* ————— ATELIER BAND (inverted) ————— */}
      <section className="bg-primary py-16 sm:py-24" aria-label="Atelier">
        <div className="container-site grid items-center gap-10 lg:grid-cols-5 lg:gap-14">
          <Reveal className="lg:col-span-3">
            <ProductImage
              src="https://res.cloudinary.com/qaruxkhf/image/upload/w_1400,q_auto,f_auto/v1790056405/stylesence/products/camille-duo-seated.jpg"
              alt="Two models in the Camille polka-dot sets — the skirt set and the trouser set"
              label="The Atelier"
              ratio="aspect-[7/5]"
              className="w-full"
            />
          </Reveal>
          <Reveal delay={0.12} className="lg:col-span-2">
            <p className="eyebrow !text-primary-foreground/70">The atelier</p>
            <blockquote className="mt-4 font-display text-2xl font-light italic leading-snug tracking-tight text-primary-foreground sm:text-3xl">
              “A loom keeps a rhythm no machine can hold — the Àrẹ̀wà Set takes ten
              days of it, thread by thread.”
            </blockquote>
            <p className="mt-4 text-sm leading-relaxed text-primary-foreground/75">
              Hand-woven Aso Oke by master weavers, finished in our Lagos studio and cut to
              your measure. Standard pieces ship in 7–10 working days; express in 2–3.
            </p>
            <Link
              to="/journal/aso-oke-loom-to-body"
              className="mt-7 inline-flex items-center gap-1.5 border-b border-primary-foreground/60 pb-1 text-[0.66rem] font-medium uppercase tracking-[0.22em] text-primary-foreground transition-colors hover:border-primary-foreground"
            >
              Read the loom story
              <ArrowRight className="h-3 w-3" strokeWidth={1.5} aria-hidden />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ————— JOURNAL ————— */}
      <section className="container-site py-16 sm:py-20" aria-label="From the journal">
        <Reveal>
          <SectionHead eyebrow="The journal" title="Notes & essays" href="/journal" />
        </Reveal>
        <div className="mt-8 grid gap-8 md:grid-cols-3">
          {posts.slice(0, 3).map((post, i) => (
            <Reveal key={post.slug} delay={i * 0.08}>
              <Link to={`/journal/${post.slug}`} className="group block">
                <ProductImage
                  src={post.coverImage}
                  alt={post.title}
                  label={post.title}
                  ratio="aspect-[4/5]"
                  className="transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03]"
                />
                <p className="eyebrow mt-4">
                  <span className="text-espresso">№ {String(i + 1).padStart(2, '0')}</span>
                  <span aria-hidden> — </span>
                  {post.category}
                </p>
                <h3 className="mt-2 font-display text-xl font-light leading-snug tracking-tight group-hover:text-espresso">
                  {post.title}
                </h3>
                <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                  {post.excerpt}
                </p>
                <p className="mt-3 flex flex-wrap items-center gap-2 font-mono text-[0.66rem] uppercase tracking-[0.12em] text-muted-foreground/80">
                  <Clock3
                    className="h-3 w-3 shrink-0 text-muted-foreground/60"
                    strokeWidth={1.5}
                    aria-hidden
                  />
                  <span className="tabular-nums">{post.readTime} min read</span>
                  <span className="text-muted-foreground/40" aria-hidden>
                    ·
                  </span>
                  <span>{formatDate(post.publishedAt)}</span>
                </p>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ————— RECENTLY VIEWED ————— */}
      <RecentlyViewedStrip className="container-site pb-16 sm:pb-20" />
    </div>
  )
}
