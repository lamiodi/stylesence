'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowUpRight, ArrowRight } from 'lucide-react'
import { Link, navigate } from '@/lib/router'
import { cn } from '@/lib/utils'
import { ProductImage } from '@/components/site/price'
import { Reveal } from '@/components/site/reveal'
import { ReadingMeta, issueNo } from '@/components/site/journal-meta'
import type { JournalCard } from '@/lib/types'

/**
 * Title underline that sweeps in while the card is hovered (whole card is the
 * link, so the reveal is group-driven). Under prefers-reduced-motion the
 * underline is simply always drawn — static, matching .link-underline.
 */
const titleUnderline =
  'bg-[linear-gradient(currentColor,currentColor)] bg-no-repeat bg-[position:0_100%] bg-[size:0%_1px] transition-[background-size] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:bg-[size:100%_1px] motion-reduce:bg-[size:100%_1px]'

export function JournalPage() {
  useEffect(() => {
    document.title = 'Journal — Style Sence'
  }, [])

  const [filter, setFilter] = useState('all')
  const { data, isLoading } = useQuery({
    queryKey: ['journal'],
    queryFn: async () => {
      const res = await fetch('/api/journal')
      if (!res.ok) throw new Error('Failed')
      return (await res.json()) as { posts: JournalCard[] }
    },
  })

  const posts = data?.posts ?? []
  const categories = [...new Set(posts.map((p) => p.category))]
  const visible = filter === 'all' ? posts : posts.filter((p) => p.category === filter)
  const [featured, ...rest] = visible
  const totalMinutes = posts.reduce((sum, p) => sum + p.readTime, 0)

  /** Issue number from the unfiltered order — stable while chips filter. */
  const issueOf = (slug: string) => issueNo(posts.findIndex((p) => p.slug === slug))

  return (
    <div className="container-site py-10 sm:py-14">
      <Reveal>
        <p className="eyebrow">Notes & essays</p>
        <h1 className="mt-2 font-display text-4xl font-light tracking-tight sm:text-5xl">The Journal</h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Styling notes, atelier dispatches and short essays — written slowly, published
          when they are ready.
        </p>
        {posts.length > 0 ? (
          <p className="mt-7 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground/75">
            <span>Vol. 02</span>
            <span className="text-muted-foreground/40" aria-hidden>
              ·
            </span>
            <span>
              {posts.length} {posts.length === 1 ? 'piece' : 'pieces'}
            </span>
            <span className="text-muted-foreground/40" aria-hidden>
              ·
            </span>
            <span>{totalMinutes} minutes of reading</span>
          </p>
        ) : null}
      </Reveal>

      {posts.length > 0 ? (
        <Reveal delay={0.04} className="mt-9">
          <div
            role="group"
            aria-label="Filter the journal by category"
            className="flex flex-wrap items-center gap-2"
          >
            {(['all', ...categories] as string[]).map((c) => {
              const active = filter === c
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setFilter(c)}
                  aria-pressed={active}
                  className={cn(
                    'inline-flex min-h-11 items-center border px-4 font-mono text-[0.62rem] uppercase tracking-[0.16em] transition-colors',
                    active
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-line-strong text-muted-foreground hover:border-foreground hover:text-foreground',
                  )}
                >
                  {c === 'all' ? 'All' : c}
                </button>
              )
            })}
            <p
              className="ml-auto hidden font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground/60 sm:block"
              aria-live="polite"
            >
              {String(visible.length).padStart(2, '0')} / {String(posts.length).padStart(2, '0')}
            </p>
          </div>
        </Reveal>
      ) : null}

      {isLoading ? (
        <div className="mt-10" aria-busy>
          <p className="eyebrow animate-pulse">Setting the type…</p>
          <div className="mt-6 animate-pulse space-y-8">
            <div className="grid gap-8 lg:grid-cols-2 lg:gap-14">
              <div className="aspect-[4/5] bg-secondary lg:aspect-[5/6]" aria-hidden />
              <div className="hidden flex-col justify-center gap-4 lg:flex" aria-hidden>
                <div className="h-3 w-28 bg-secondary" />
                <div className="h-10 w-4/5 bg-secondary" />
                <div className="h-4 w-full bg-secondary" />
                <div className="h-4 w-3/4 bg-secondary" />
                <div className="h-3 w-32 bg-secondary" />
              </div>
            </div>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} aria-hidden>
                  <div className="aspect-[4/5] bg-secondary" />
                  <div className="mt-4 h-3 w-24 bg-secondary" />
                  <div className="mt-2.5 h-5 w-4/5 bg-secondary" />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          {featured ? (
            <Reveal delay={0.08} className="mt-10">
              <Link
                to={`/journal/${featured.slug}`}
                className="group grid gap-8 border-t border-line pt-10 lg:grid-cols-2 lg:gap-14"
              >
                <div className="relative overflow-hidden">
                  <ProductImage
                    src={featured.coverImage}
                    alt={featured.title}
                    label={featured.title}
                    ratio="aspect-[4/5] lg:aspect-[5/6]"
                    className="transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-safe:group-hover:scale-[1.03]"
                  />
                  {filter === 'all' ? (
                    <span className="eyebrow absolute left-4 top-4 bg-background/90 px-3 py-1.5 !text-[0.55rem] backdrop-blur-sm">
                      Featured
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-col justify-center">
                  <p className="eyebrow">
                    <span className="text-espresso">{issueOf(featured.slug)}</span>
                    <span aria-hidden> — </span>
                    {featured.category}
                  </p>
                  <h2
                    className={cn(
                      titleUnderline,
                      'mt-3 font-display text-3xl font-light leading-tight tracking-tight text-balance group-hover:text-espresso sm:text-4xl',
                    )}
                  >
                    {featured.title}
                  </h2>
                  <p className="mt-4 max-w-md text-[0.95rem] leading-relaxed text-muted-foreground">
                    {featured.excerpt}
                  </p>
                  <ReadingMeta post={featured} className="mt-5" />
                  <span className="eyebrow-ink mt-7 inline-flex items-center gap-1.5 border-b border-foreground pb-1 transition-colors group-hover:border-espresso group-hover:text-espresso">
                    Read the piece
                    <ArrowUpRight className="h-3 w-3" strokeWidth={1.5} aria-hidden />
                  </span>
                </div>
              </Link>
            </Reveal>
          ) : null}

          {rest.length > 0 ? (
            <div className="mt-16 grid gap-8 border-t border-line pt-12 sm:grid-cols-2 lg:grid-cols-3 lg:gap-10">
              {rest.map((post, i) => (
                <Reveal key={post.slug} delay={i * 0.08}>
                  <Link to={`/journal/${post.slug}`} className="group block">
                    <ProductImage
                      src={post.coverImage}
                      alt={post.title}
                      label={post.title}
                      ratio="aspect-[4/5]"
                      className="transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-safe:group-hover:scale-[1.03]"
                    />
                    <p className="eyebrow mt-4">
                      <span className="text-espresso">{issueOf(post.slug)}</span>
                      <span aria-hidden> — </span>
                      {post.category}
                    </p>
                    <h3
                      className={cn(
                        titleUnderline,
                        'mt-2 font-display text-xl font-light leading-snug tracking-tight group-hover:text-espresso',
                      )}
                    >
                      {post.title}
                    </h3>
                    <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                      {post.excerpt}
                    </p>
                    <ReadingMeta post={post} className="mt-3" />
                  </Link>
                </Reveal>
              ))}
            </div>
          ) : null}

          <div className="mt-16 border-t border-line pt-10 text-center">
            <p className="eyebrow">In the works</p>
            <p className="mt-3 font-display text-2xl font-light italic text-muted-foreground">
              Volume 03 — mills & dye houses — is being written.
            </p>
            <button
              type="button"
              onClick={() => navigate('/shop')}
              className="eyebrow-ink mt-6 inline-flex min-h-11 items-center gap-1.5 border-b border-foreground pb-1 transition-colors hover:border-espresso hover:text-espresso"
            >
              Meanwhile, the collection
              <ArrowRight className="h-3 w-3" strokeWidth={1.5} aria-hidden />
            </button>
          </div>
        </>
      )}
    </div>
  )
}
