'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueries, keepPreviousData } from '@tanstack/react-query'
import { SlidersHorizontal, X, Search, Truck, Check } from 'lucide-react'
import { useRoute, navigate, Link } from '@/lib/router'
import { cn } from '@/lib/utils'
import { formatNaira } from '@/lib/money'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { ProductCard, ProductCardSkeleton } from '@/components/site/product-card'
import { Reveal } from '@/components/site/reveal'
import type { ProductsResponse, Category, SortKey, ProductCard as ProductCardType } from '@/lib/types'

const PER_PAGE = 12
const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'One Size']

const SORT_LABELS: Record<SortKey, string> = {
  featured: 'Featured',
  newest: 'Newest',
  'price-asc': 'Price — low to high',
  'price-desc': 'Price — high to low',
  rating: 'Top rated',
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Request failed')
  return res.json()
}

function currentHashParams(): URLSearchParams {
  return new URLSearchParams(window.location.hash.split('?')[1] ?? '')
}

function currentHashPath(): string {
  return (window.location.hash.replace(/^#/, '') || '/').split('?')[0] || '/shop'
}

function setParam(patch: Record<string, string | null>) {
  const current = currentHashParams()
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === '') current.delete(k)
    else current.set(k, v)
  }
  current.delete('page') // any filter change resets paging
  const qs = current.toString()
  navigate(`${currentHashPath()}${qs ? `?${qs}` : ''}`)
}

function goToPage(n: number) {
  const current = currentHashParams()
  if (n <= 1) current.delete('page')
  else current.set('page', String(n))
  const qs = current.toString()
  navigate(`${currentHashPath()}${qs ? `?${qs}` : ''}`, { replace: true })
}

function FilterRail({
  categories,
  facets,
  params,
  onNavigate,
}: {
  categories: Category[]
  facets: ProductsResponse['facets'] | undefined
  params: {
    category: string
    size: string
    color: string
    minPrice: string
    maxPrice: string
    inStock: string
  }
  onNavigate?: () => void
}) {
  const hasFilters = !!(params.size || params.color || params.minPrice || params.maxPrice || params.inStock)
  const priceSteps = [50000, 100000, 150000, 200000, 250000]

  return (
    <div>
      <p className="eyebrow mb-3">Category</p>
      <ul className="space-y-1 border-b border-line pb-5">
        <li>
          <button
            type="button"
            onClick={() => {
              setParam({ category: null })
              onNavigate?.()
            }}
            className={cn(
              'flex w-full items-center justify-between py-1.5 text-left text-sm transition-colors',
              !params.category ? 'font-medium text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            All pieces
          </button>
        </li>
        {categories.map((c) => (
          <li key={c.slug}>
            <button
              type="button"
              onClick={() => {
                setParam({ category: c.slug })
                onNavigate?.()
              }}
              className={cn(
                'flex w-full items-center justify-between py-1.5 text-left text-sm transition-colors',
                params.category === c.slug
                  ? 'font-medium text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {c.name}
              <span className="font-mono text-[0.65rem] text-muted-foreground/70 tabular-nums">
                {c.productCount}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {/* ————— availability: in-stock-only toggle ("Ready to ship") ————— */}
      <div className="border-b border-line py-5">
        <p className="eyebrow mb-3">Availability</p>
        <button
          type="button"
          onClick={() => {
            setParam({ inStock: params.inStock ? null : '1' })
            onNavigate?.()
          }}
          aria-pressed={!!params.inStock}
          className={cn(
            'flex w-full items-center gap-3 border px-3.5 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-ring',
            params.inStock
              ? 'border-foreground text-foreground'
              : 'border-line-strong text-muted-foreground hover:border-foreground hover:text-foreground',
          )}
        >
          <span
            aria-hidden
            className={cn(
              'flex h-4 w-4 shrink-0 items-center justify-center border transition-colors',
              params.inStock
                ? 'border-foreground bg-foreground text-background'
                : 'border-line-strong text-transparent',
            )}
          >
            <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden />
          </span>
          <Truck className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden />
          <span className="text-sm">Ready to ship</span>
        </button>
        <p className="mt-2 text-[0.68rem] leading-relaxed text-muted-foreground/80">
          Only pieces with a size on the shelf — no waitlists.
        </p>
      </div>

      {facets && facets.sizes.length > 0 ? (
        <div className="border-b border-line py-5">
          <p className="eyebrow mb-3">Size</p>
          <div className="flex flex-wrap gap-2">
            {[...facets.sizes]
              .sort((a, b) => SIZE_ORDER.indexOf(a.size) - SIZE_ORDER.indexOf(b.size))
              .map((s) => (
                <button
                  key={s.size}
                  type="button"
                  onClick={() => setParam({ size: params.size === s.size ? null : s.size })}
                  aria-pressed={params.size === s.size}
                  className={cn(
                    'h-9 min-w-11 border px-3 font-mono text-[0.72rem] transition-colors',
                    params.size === s.size
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-line-strong text-muted-foreground hover:border-foreground hover:text-foreground',
                  )}
                >
                  {s.size}
                </button>
              ))}
          </div>
        </div>
      ) : null}

      {facets && facets.colors.length > 0 ? (
        <div className="border-b border-line py-5">
          <p className="eyebrow mb-3">Colour</p>
          <div className="flex flex-wrap gap-2.5">
            {facets.colors.map((c) => (
              <button
                key={c.name}
                type="button"
                onClick={() => setParam({ color: params.color === c.name ? null : c.name })}
                aria-pressed={params.color === c.name}
                title={`${c.name} (${c.count})`}
                className={cn(
                  'flex items-center gap-2 border px-2.5 py-1.5 text-[0.7rem] transition-colors',
                  params.color === c.name
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
        </div>
      ) : null}

      {facets?.priceRange ? (
        <div className="py-5">
          <p className="eyebrow mb-3">Price</p>
          <div className="flex items-center gap-2">
            <Select
              value={params.minPrice || '_any'}
              onValueChange={(v) => setParam({ minPrice: v === '_any' ? null : v })}
            >
              <SelectTrigger className="h-9 border-line-strong text-xs" aria-label="Minimum price">
                <SelectValue placeholder="Min" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_any">Min — any</SelectItem>
                {priceSteps.map((p) => (
                  <SelectItem key={p} value={String(p)}>
                    {formatNaira(p)}+
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-muted-foreground/60">—</span>
            <Select
              value={params.maxPrice || '_any'}
              onValueChange={(v) => setParam({ maxPrice: v === '_any' ? null : v })}
            >
              <SelectTrigger className="h-9 border-line-strong text-xs" aria-label="Maximum price">
                <SelectValue placeholder="Max" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_any">Max — any</SelectItem>
                {priceSteps.map((p) => (
                  <SelectItem key={p} value={String(p)}>
                    under {formatNaira(p)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {hasFilters ? (
            <button
              type="button"
              onClick={() => setParam({ size: null, color: null, minPrice: null, maxPrice: null, inStock: null })}
              className="eyebrow mt-4 !text-espresso hover:underline"
            >
              Clear size · colour · price · availability
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export function ShopPage() {
  const route = useRoute()
  const page = Math.max(1, Number(route.query.get('page') ?? '1') || 1)

  const params = useMemo(() => {
    const q = route.query
    const p = new URLSearchParams()
    const category = q.get('category') ?? ''
    const search = q.get('q') ?? ''
    const size = q.get('size') ?? ''
    const color = q.get('color') ?? ''
    const minPrice = q.get('minPrice') ?? ''
    const maxPrice = q.get('maxPrice') ?? ''
    const inStock = q.get('inStock') ?? ''
    const sort = (q.get('sort') as SortKey) || 'featured'
    if (category) p.set('category', category)
    if (search) p.set('q', search)
    if (size) p.set('size', size)
    if (color) p.set('color', color)
    if (minPrice) p.set('minPrice', minPrice)
    if (maxPrice) p.set('maxPrice', maxPrice)
    if (inStock) p.set('inStock', inStock)
    if (sort) p.set('sort', sort)
    return { category, search, size, color, minPrice, maxPrice, inStock, sort, key: p.toString() }
  }, [route.query])

  useEffect(() => {
    document.title = params.category
      ? `${params.category.replace(/-/g, ' ')} — Style Sence`
      : params.search
        ? `Search — Style Sence`
        : 'Shop — Style Sence'
  }, [params.category, params.search])

  // pages 1..N accumulate via parallel queries — no effect state
  const pageQueries = useQueries({
    queries: Array.from({ length: page }, (_, i) => ({
      queryKey: ['shop', params.key, i + 1] as const,
      queryFn: () =>
        fetchJson<ProductsResponse>(`/api/products?${params.key}&page=${i + 1}&perPage=${PER_PAGE}`),
      placeholderData: keepPreviousData,
      staleTime: 60_000,
    })),
  })

  const items: ProductCardType[] = useMemo(() => {
    const seen = new Set<string>()
    const out: ProductCardType[] = []
    for (const q of pageQueries) {
      for (const p of q.data?.products ?? []) {
        if (!seen.has(p.id)) {
          seen.add(p.id)
          out.push(p)
        }
      }
    }
    return out
  }, [pageQueries])

  const lastQuery = pageQueries[pageQueries.length - 1]
  const facets = lastQuery?.data?.facets
  const total = lastQuery?.data?.total ?? 0
  const isLoading = pageQueries[0]?.isLoading ?? true
  const isFetching = pageQueries.some((q) => q.isFetching)
  const showingAll = items.length >= total && total > 0

  const { data: catsData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => fetchJson<{ categories: Category[] }>('/api/categories'),
    staleTime: 5 * 60_000,
  })
  // filter chips only for categories that have live pieces
  const categories = (catsData?.categories ?? []).filter((c) => c.productCount > 0)

  const [mobileFilters, setMobileFilters] = useState(false)
  const categoryMeta = categories.find((c) => c.slug === params.category)

  const activeChips: { label: string; clear: () => void }[] = []
  if (params.search)
    activeChips.push({ label: `“${params.search}”`, clear: () => setParam({ q: null }) })
  if (params.inStock)
    activeChips.push({ label: 'Ready to ship', clear: () => setParam({ inStock: null }) })
  if (params.size)
    activeChips.push({ label: `Size ${params.size}`, clear: () => setParam({ size: null }) })
  if (params.color)
    activeChips.push({ label: params.color, clear: () => setParam({ color: null }) })
  if (params.minPrice)
    activeChips.push({
      label: `${formatNaira(Number(params.minPrice))}+`,
      clear: () => setParam({ minPrice: null }),
    })
  if (params.maxPrice)
    activeChips.push({
      label: `Under ${formatNaira(Number(params.maxPrice))}`,
      clear: () => setParam({ maxPrice: null }),
    })

  return (
    <div className="container-site py-10 sm:py-14">
      {/* header */}
      <Reveal>
        <nav aria-label="Breadcrumb" className="eyebrow !text-[0.58rem]">
          <Link to="/" className="hover:text-foreground">Home</Link>
          <span className="mx-2 text-muted-foreground/50">/</span>
          <Link to="/shop" className="hover:text-foreground">Shop</Link>
          {categoryMeta ? (
            <>
              <span className="mx-2 text-muted-foreground/50">/</span>
              <span className="text-foreground">{categoryMeta.name}</span>
            </>
          ) : null}
        </nav>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-xl">
            <p className="eyebrow">The collection</p>
            <h1 className="mt-2 font-display text-4xl font-light tracking-tight sm:text-5xl">
              {categoryMeta ? categoryMeta.name : params.search ? 'Search' : 'All Pieces'}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {categoryMeta?.tagline ??
                'Ivory and charcoal, cut in small batches — every piece meant to speak to every other.'}
            </p>
          </div>
          <p className="font-mono text-[0.72rem] text-muted-foreground tabular-nums">
            {isFetching && !isLoading ? 'Refining…' : `${total} ${total === 1 ? 'piece' : 'pieces'}`}
          </p>
        </div>
      </Reveal>

      {/* toolbar */}
      <div className="sticky top-16 z-30 -mx-4 mt-8 border-y border-line bg-background/92 px-4 py-3 backdrop-blur-md sm:top-[4.5rem] sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Sheet open={mobileFilters} onOpenChange={setMobileFilters}>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 gap-2 border-line-strong uppercase tracking-[0.16em] text-[0.62rem] lg:hidden"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
                  Filters
                  {activeChips.length > 0 ? (
                    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-espresso px-1 font-mono text-[0.55rem] leading-none text-background">
                      {activeChips.length}
                    </span>
                  ) : null}
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[19rem] overflow-y-auto p-0">
                <SheetTitle className="border-b border-line px-6 py-5 font-display text-xl font-light">
                  Refine
                </SheetTitle>
                <div className="px-6 py-4">
                  <FilterRail
                    categories={categories}
                    facets={facets}
                    params={params}
                    onNavigate={() => setMobileFilters(false)}
                  />
                </div>
              </SheetContent>
            </Sheet>
            <div className="hidden min-w-0 flex-wrap items-center gap-2 lg:flex">
              {activeChips.length === 0 ? (
                <span className="text-[0.7rem] text-muted-foreground/70">No filters applied</span>
              ) : (
                activeChips.map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={chip.clear}
                    className="group flex items-center gap-1.5 border border-line-strong px-2.5 py-1 text-[0.68rem] text-muted-foreground transition-colors hover:border-espresso hover:text-espresso"
                  >
                    {chip.label}
                    <X className="h-3 w-3" strokeWidth={1.5} aria-hidden />
                  </button>
                ))
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Select
              value={params.sort}
              onValueChange={(v) => setParam({ sort: v === 'featured' ? null : v })}
            >
              <SelectTrigger
                className="h-9 w-[11.5rem] border-line-strong text-[0.68rem] uppercase tracking-[0.12em]"
                aria-label="Sort products"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {SORT_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[15rem_1fr] lg:gap-12">
        {/* desktop rail */}
        <aside className="hidden lg:block" aria-label="Filters">
          <div className="sticky top-40">
            <FilterRail categories={categories} facets={facets} params={params} />
          </div>
        </aside>

        {/* grid */}
        <div>
          {isLoading ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 md:gap-x-6 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center border border-dashed border-line-strong px-6 py-24 text-center">
              <Search className="h-7 w-7 text-muted-foreground/40" strokeWidth={1} aria-hidden />
              <p className="mt-5 font-display text-2xl font-light italic">Nothing here — yet.</p>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
                No pieces match this combination. Loosen a filter or two and the rail will
                fill again.
              </p>
              <Button
                variant="outline"
                className="mt-7 h-11 border-line-strong uppercase tracking-[0.18em] text-[0.64rem]"
                onClick={() => navigate(`#/shop${params.category ? `?category=${params.category}` : ''}`)}
              >
                Clear filters
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 md:gap-x-6 xl:grid-cols-4">
                {items.map((p, i) => (
                  <ProductCard key={p.id} product={p} index={i} eager={i < 8} />
                ))}
              </div>
              {!showingAll ? (
                <div className="mt-14 flex flex-col items-center gap-3">
                  <p className="font-mono text-[0.7rem] text-muted-foreground tabular-nums">
                    Showing {items.length} of {total}
                  </p>
                  <Button
                    variant="outline"
                    disabled={isFetching}
                    onClick={() => goToPage(page + 1)}
                    className="h-12 border-line-strong px-10 uppercase tracking-[0.2em] text-[0.66rem] hover:border-foreground"
                  >
                    {isFetching ? 'Loading…' : 'Load more'}
                  </Button>
                </div>
              ) : (
                <div className="mt-14 border-t border-line pt-8 text-center">
                  <p className="eyebrow">End of the rail — {total} pieces shown</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
