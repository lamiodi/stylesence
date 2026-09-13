'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTheme } from 'next-themes'
import { ArrowRight, Check, Sun, Moon } from 'lucide-react'
import { toast } from 'sonner'
import { Link } from '@/lib/router'
import type { Category } from '@/lib/types'
import { DevPlaceholder } from './dev-placeholder'

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Request failed')
  return res.json()
}

export function NewsletterForm() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const value = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      toast.error('Please enter a valid email address.')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: value }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Subscription failed')
      toast.success('Welcome to The Sence Letter.', {
        description: '10% off your first order — coded SS-FRIEND (dev placeholder).',
      })
      setEmail('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Subscription failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="mt-5" noValidate>
      <div className="flex max-w-md items-center border-b border-line-strong focus-within:border-foreground transition-colors">
        <label htmlFor="newsletter-email" className="sr-only">
          Email address
        </label>
        <input
          id="newsletter-email"
          type="email"
          autoComplete="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy}
          className="w-full bg-transparent py-2.5 text-sm placeholder:text-muted-foreground/60 focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy}
          className="flex items-center gap-1.5 whitespace-nowrap py-2.5 pl-3 text-[0.66rem] font-medium uppercase tracking-[0.2em] text-foreground transition-colors hover:text-espresso disabled:opacity-50"
        >
          {busy ? 'Joining…' : 'Join'}
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
        </button>
      </div>
      <p className="mt-2.5 text-[0.7rem] leading-relaxed text-muted-foreground/80">
        One considered letter a month — collections, atelier notes, and early access.
        No noise, ever.
      </p>
    </form>
  )
}

function ClientCareLinks() {
  const items = ['Shipping & Returns', 'Size Guide', 'Care Instructions', 'Contact Client Care', 'FAQ']
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item}>
          <button
            type="button"
            onClick={() =>
              toast('Dev placeholder', {
                description: `“${item}” is not implemented in this preview — commercial copy pending.`,
              })
            }
            className="link-underline text-left text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {item}
          </button>
        </li>
      ))}
    </ul>
  )
}

function PaymentMarks() {
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Accepted payment methods (dev placeholder)">
      {['PAYSTACK', 'VISA', 'MASTERCARD', 'TRANSFER'].map((m) => (
        <span
          key={m}
          className="border border-dashed border-line-strong px-2 py-1 font-mono text-[0.55rem] tracking-[0.14em] text-muted-foreground/70"
          title="Dev placeholder — payment integration pending"
        >
          {m}
        </span>
      ))}
    </div>
  )
}

export function Footer() {
  const { theme, setTheme } = useTheme()
  const { data } = useQuery({
    queryKey: ['categories'],
    queryFn: () => fetchJson<{ categories: Category[] }>('/api/categories'),
    staleTime: 5 * 60_000,
  })
  const categories = data?.categories ?? []

  return (
    <footer className="mt-auto border-t border-line bg-secondary/60">
      <div className="container-site">
        {/* newsletter band */}
        <div className="grid gap-10 border-b border-line py-14 md:grid-cols-2 md:gap-16">
          <div>
            <p className="eyebrow">The Sence Letter</p>
            <h2 className="mt-3 font-display text-3xl font-light tracking-tight text-balance sm:text-4xl">
              Considered notes, once a month.
            </h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
              New pieces, atelier stories and styling notes — written, not blasted.
            </p>
          </div>
          <div className="md:pt-3">
            <NewsletterForm />
            <div className="mt-6">
              <DevPlaceholder compact title="Email delivery">
                Confirmation & welcome emails are simulated in this environment.
              </DevPlaceholder>
            </div>
          </div>
        </div>

        {/* link columns */}
        <div className="grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="eyebrow mb-4">Shop</p>
            <ul className="space-y-2.5">
              {categories.map((c) => (
                <li key={c.slug}>
                  <Link
                    to={`/shop?category=${c.slug}`}
                    className="link-underline text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {c.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  to="/shop"
                  className="link-underline text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  All Pieces
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="eyebrow mb-4">Client Care</p>
            <ClientCareLinks />
          </div>
          <div>
            <p className="eyebrow mb-4">The House</p>
            <ul className="space-y-2.5">
              <li>
                <Link to="/about" className="link-underline text-sm text-muted-foreground hover:text-foreground">
                  About Style Sence
                </Link>
              </li>
              <li>
                <Link to="/journal" className="link-underline text-sm text-muted-foreground hover:text-foreground">
                  The Journal
                </Link>
              </li>
              <li>
                <Link to="/wishlist" className="link-underline text-sm text-muted-foreground hover:text-foreground">
                  Wishlist
                </Link>
              </li>
              <li>
                <Link to="/admin" className="link-underline text-sm text-muted-foreground hover:text-foreground">
                  Admin Console
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="eyebrow mb-4">Visit</p>
            <address className="text-sm not-italic leading-relaxed text-muted-foreground">
              14A Awolowo Road
              <br />
              Ikoyi, Lagos, Nigeria
              <br />
              <span className="mt-2 block">
                Tue – Sat · 10:00 – 18:00 WAT
              </span>
            </address>
            <div className="mt-4 flex items-center gap-3">
              {['Instagram', 'Pinterest'].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() =>
                    toast('Dev placeholder', { description: `${s} is not linked in this preview.` })
                  }
                  className="border border-dashed border-line-strong px-2.5 py-1 text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground/80"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* bottom bar */}
        <div className="flex flex-col items-start justify-between gap-4 border-t border-line py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="text-[0.7rem] text-muted-foreground">
              © 2026 Style Sence by SKR · Lagos
            </p>
            <span className="hidden h-3 w-px bg-line-strong sm:block" aria-hidden />
            <p className="flex items-center gap-1.5 text-[0.7rem] text-muted-foreground/80">
              <Check className="h-3 w-3 text-espresso" aria-hidden />
              Development preview — no live commerce
            </p>
          </div>
          <div className="flex items-center gap-5">
            <PaymentMarks />
            <button
              type="button"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="flex items-center gap-1.5 text-[0.66rem] font-medium uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Toggle colour mode"
            >
              {theme === 'dark' ? (
                <>
                  <Moon className="h-3.5 w-3.5" strokeWidth={1.5} /> Charcoal
                </>
              ) : (
                <>
                  <Sun className="h-3.5 w-3.5" strokeWidth={1.5} /> Ivory
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </footer>
  )
}
