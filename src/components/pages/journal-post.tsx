'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Link2, Check } from 'lucide-react'
import { toast } from 'sonner'
import { Link, navigate } from '@/lib/router'
import { formatDate } from '@/lib/money'
import { Button } from '@/components/ui/button'
import { ProductImage } from '@/components/site/price'
import { Reveal } from '@/components/site/reveal'
import type { JournalPostView } from '@/lib/types'

/**
 * Hairline reading-progress bar pinned under the sticky header while the
 * article is on screen. CSS-transitioned width (covered by the global
 * prefers-reduced-motion override); rAF-throttled scroll listener.
 */
function ReadingProgress() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let raf = 0
    const update = () => {
      raf = 0
      const el = document.getElementById('journal-article')
      if (!el) return
      const rect = el.getBoundingClientRect()
      const total = rect.height - window.innerHeight
      const read = Math.min(Math.max(-rect.top, 0), Math.max(total, 1))
      setProgress(total > 0 ? Math.round((read / total) * 100) : 100)
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div
      className="no-print fixed left-0 top-16 z-40 h-[2px] w-full bg-transparent sm:top-[4.5rem]" aria-hidden
    >
      <div
        className="h-full bg-espresso transition-[width] duration-150 ease-out motion-reduce:transition-none"
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}

/** Copy the current article URL (hash link) to the clipboard with a toast. */
function ShareLink() {
  const [copied, setCopied] = useState(false)
  const onShare = async () => {
    const url = window.location.href
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // Clipboard API unavailable (insecure context / older browser) — select-free fallback.
      const el = document.createElement('textarea')
      el.value = url
      el.setAttribute('readonly', '')
      el.style.position = 'fixed'
      el.style.opacity = '0'
      document.body.appendChild(el)
      el.select()
      try {
        document.execCommand('copy')
      } catch {
        /* ignore */
      }
      document.body.removeChild(el)
    }
    setCopied(true)
    toast.success('Article link copied to clipboard.')
    window.setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      type="button"
      onClick={() => void onShare()}
      className="eyebrow inline-flex min-h-11 items-center gap-1.5 border-b border-transparent pb-1 transition-colors hover:border-foreground hover:text-foreground"
      aria-label="Copy a link to this article"
    >
      {copied ? (
        <Check className="h-3 w-3 text-espresso" strokeWidth={1.5} aria-hidden />
      ) : (
        <Link2 className="h-3 w-3" strokeWidth={1.5} aria-hidden />
      )}
      {copied ? 'Copied' : 'Share'}
    </button>
  )
}

export function JournalPostPage({ slug }: { slug: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['journal', slug],
    queryFn: async () => {
      const res = await fetch(`/api/journal/${slug}`)
      if (!res.ok) throw new Error('Not found')
      return (await res.json()) as { post: JournalPostView }
    },
    retry: false,
  })

  const post = data?.post

  useEffect(() => {
    if (post) document.title = `${post.title} — Style Sence Journal`
  }, [post])

  if (isLoading) {
    return (
      <div className="container-site max-w-3xl py-16" aria-busy>
        <div className="animate-pulse space-y-8">
          <div className="h-6 w-40 bg-secondary" />
          <div className="h-12 w-4/5 bg-secondary" />
          <div className="aspect-[16/10] w-full bg-secondary" />
          <div className="h-4 w-full bg-secondary" />
          <div className="h-4 w-11/12 bg-secondary" />
        </div>
      </div>
    )
  }

  if (isError || !post) {
    return (
      <div className="container-site flex flex-col items-center py-32 text-center">
        <p className="font-display text-4xl font-light italic">This page is unwritten.</p>
        <Button className="mt-8 h-12 px-8 uppercase tracking-[0.2em] text-[0.66rem]" onClick={() => navigate('/journal')}>
          Back to the journal
        </Button>
      </div>
    )
  }

  const blocks = post.body.split('\n\n')

  return (
    <article id="journal-article" className="container-site max-w-3xl py-10 sm:py-14">
      <ReadingProgress />
      <Reveal>
        <div className="flex items-center justify-between gap-4">
          <Link
            to="/journal"
            className="eyebrow inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" strokeWidth={1.5} aria-hidden />
            The Journal
          </Link>
          <ShareLink />
        </div>
        <p className="eyebrow mt-6">
          {post.category} · {post.readTime} min read · {formatDate(post.publishedAt)}
        </p>
        <h1 className="mt-3 font-display text-4xl font-light leading-[1.1] tracking-tight text-balance sm:text-5xl">
          {post.title}
        </h1>
        <p className="mt-5 border-l-2 border-espresso pl-5 font-display text-lg italic leading-relaxed text-muted-foreground">
          {post.excerpt}
        </p>
      </Reveal>

      <Reveal delay={0.1} className="mt-10">
        <ProductImage
          src={post.coverImage}
          alt={post.title}
          label={post.title}
          ratio="aspect-[16/10]"
          eager
          className="w-full"
        />
      </Reveal>

      <Reveal delay={0.14}>
        <div className="drop-cap mt-12">
          {blocks.map((block, i) => {
            if (block.startsWith('## ')) {
              return (
                <h2 key={i} className="mt-12 font-display text-2xl font-light tracking-tight sm:text-[1.7rem]">
                  {block.replace(/^##\s+/, '')}
                </h2>
              )
            }
            // Editorial pull-quote — lines opening with "> " render between
            // hairline rules in oversized display italic.
            if (block.startsWith('> ')) {
              return (
                <blockquote key={i} className="my-12 border-y border-line py-8 text-center">
                  <p className="mx-auto max-w-xl font-display text-[1.45rem] font-light italic leading-snug text-balance text-foreground sm:text-[1.7rem]">
                    {block.replace(/^>\s+/, '')}
                  </p>
                </blockquote>
              )
            }
            return (
              <p key={i} className="mt-6 text-[1.02rem] leading-[1.85] text-foreground/90 first:mt-0">
                {block}
              </p>
            )
          })}
        </div>
      </Reveal>

      <Reveal delay={0.18} className="mt-16">
        <div className="border-t border-line pt-10 text-center">
          <p className="font-display text-2xl font-light italic">Dress the philosophy.</p>
          <button
            type="button"
            onClick={() => navigate('/shop')}
            className="eyebrow-ink mt-5 inline-flex items-center gap-1.5 border-b border-foreground pb-1 transition-colors hover:border-espresso hover:text-espresso"
          >
            Shop the collection
            <ArrowRight className="h-3 w-3" strokeWidth={1.5} aria-hidden />
          </button>
        </div>
      </Reveal>
    </article>
  )
}
