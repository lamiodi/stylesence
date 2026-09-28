'use client'

import { useEffect } from 'react'
import { ArrowLeft } from 'lucide-react'
import { navigate } from '@/lib/router'
import { Button } from '@/components/ui/button'
import { Reveal } from '@/components/site/reveal'

export function NotFoundPage() {
  useEffect(() => {
    document.title = 'Not found — Style Sence'
  }, [])
  return (
    <div className="container-site flex flex-col items-center py-28 text-center sm:py-36">
      <Reveal>
        <p className="eyebrow">404 — off the rail</p>
        <h1 className="mx-auto mt-4 max-w-xl font-display text-4xl font-light leading-tight tracking-tight text-balance sm:text-5xl">
          This piece has been retired, or never existed.
        </h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
          The link may be mistaken, the colour retired, the page unwritten. The
          collection, however, remains.
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Button
            className="h-12 px-8 uppercase tracking-[0.2em] text-[0.66rem]"
            onClick={() => navigate('/shop')}
          >
            <ArrowLeft className="mr-2 h-3.5 w-3.5 rotate-180" strokeWidth={1.5} aria-hidden />
            Shop the collection
          </Button>
          <Button
            variant="outline"
            className="h-12 border-line-strong px-8 uppercase tracking-[0.2em] text-[0.66rem] hover:border-foreground"
            onClick={() => navigate('/')}
          >
            Return home
          </Button>
        </div>
        <p className="mt-6 text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground/80">
          Or linger —{' '}
          <button
            type="button"
            onClick={() => navigate('/journal')}
            className="underline decoration-line-strong underline-offset-4 transition-colors hover:text-foreground"
          >
            the journal
          </button>
          <span aria-hidden className="mx-2">·</span>
          <button
            type="button"
            onClick={() => navigate('/help')}
            className="underline decoration-line-strong underline-offset-4 transition-colors hover:text-foreground"
          >
            client care
          </button>
        </p>
      </Reveal>
    </div>
  )
}
