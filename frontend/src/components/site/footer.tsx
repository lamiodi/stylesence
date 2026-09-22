'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTheme } from 'next-themes'
import { ArrowRight, Check, Lock, Sun, Moon } from 'lucide-react'
import { toast } from 'sonner'
import { Link } from '@/lib/router'
import type { Category } from '@/lib/types'

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Request failed')
  return res.json()
}

export function NewsletterForm() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

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
        description: '10% off your first order — code SS-FRIEND at the bag.',
      })
      setEmail('')
      setDone(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Subscription failed')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="mt-5 max-w-md border border-line bg-secondary/60 px-5 py-4" role="status">
        <p className="flex items-center gap-2.5 text-sm">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-espresso/10 text-espresso">
            <Check className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          </span>
          <span>
            You are on the list. <span className="text-muted-foreground">Code</span>{' '}
            <span className="font-mono text-[0.8rem] text-espresso">SS-FRIEND</span>{' '}
            <span className="text-muted-foreground">waits at the bag.</span>
          </span>
        </p>
      </div>
    )
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
  const items: { label: string; to: string }[] = [
    { label: 'Track your order', to: '/track' },
    { label: 'Shipping & Returns', to: '/help?topic=shipping' },
    { label: 'Size Guide', to: '/help?topic=sizing' },
    { label: 'Care Instructions', to: '/help?topic=care' },
    { label: 'Contact Client Care', to: '/help?topic=contact' },
    { label: 'FAQ', to: '/help?topic=faq' },
  ]
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item.label}>
          <Link
            to={item.to}
            className="link-underline text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  )
}

function PaymentMarks() {
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Accepted payment methods">
      {['BANK TRANSFER', 'VISA', 'MASTERCARD', 'VERVE'].map((m) => (
        <span
          key={m}
          className="border border-line-strong px-2 py-1 font-mono text-[0.55rem] tracking-[0.14em] text-muted-foreground/70"
        >
          {m}
        </span>
      ))}
    </div>
  )
}

/** Fine-print band — trust, currency, studio and payment details above the
 *  bottom line. Hairline grid; mono labels; quiet copy. */
function FinePrint() {
  return (
    <div className="border-t border-line py-6">
      <dl className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground/70">
            Secure checkout
          </dt>
          <dd className="mt-2.5 flex items-start gap-2 text-[0.72rem] leading-relaxed text-muted-foreground">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-espresso" strokeWidth={1.5} aria-hidden />
            <span>
              Every checkout is encrypted over SSL. Client care answers within one
              business day.
            </span>
          </dd>
        </div>
        <div>
          <dt className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground/70">
            Prices &amp; tax
          </dt>
          <dd className="mt-2.5 text-[0.72rem] leading-relaxed text-muted-foreground">
            All prices in <span className="text-foreground">₦ — Nigerian Naira</span>, shown
            incl. VAT.
          </dd>
        </div>
        <div>
          <dt className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground/70">
            The studio
          </dt>
          <dd className="mt-2.5 text-[0.72rem] leading-relaxed text-muted-foreground">
            14A Awolowo Road, Ikoyi, Lagos
            <span className="mt-1 block">Tue – Sat · 10:00 – 18:00 WAT</span>
            <span className="mt-1 block text-[0.64rem] text-muted-foreground/70">
              Private fittings by appointment.
            </span>
          </dd>
        </div>
        <div>
          <dt className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground/70">
            Payment methods
          </dt>
          <dd className="mt-2.5">
            <PaymentMarks />
            <p className="mt-2.5 text-[0.72rem] leading-relaxed text-muted-foreground">
              Bank transfer or card on confirmation — payment details arrive with your
              order confirmation, and production begins the moment payment lands.
            </p>
          </dd>
        </div>
      </dl>
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
  const categories = (data?.categories ?? []).filter((c) => c.productCount > 0)

  return (
    <footer className="no-print mt-auto border-t border-line bg-secondary/60">
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
            <p className="mt-6 text-[0.72rem] leading-relaxed text-muted-foreground/80">
              One letter a month — new pieces, atelier stories and styling notes.
              Unsubscribe anytime.
            </p>
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
              <a
                href="https://wa.me/2348163022233"
                className="border border-line-strong px-2.5 py-1 text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground/80 transition-colors hover:border-espresso hover:text-espresso"
              >
                WhatsApp the studio
              </a>
            </div>
          </div>
        </div>

        {/* fine print — trust, currency, studio, payments */}
        <FinePrint />

        {/* bottom bar */}
        <div className="flex flex-col items-start justify-between gap-4 border-t border-line py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="text-[0.7rem] text-muted-foreground">
              © 2026 Style Sence by SKR · Lagos
            </p>
            <span className="hidden h-3 w-px bg-line-strong sm:block" aria-hidden />
            <p className="flex items-center gap-1.5 text-[0.7rem] text-muted-foreground/80">
              <Check className="h-3 w-3 text-espresso" aria-hidden />
              Made to order in Lagos · Delivered nationwide
            </p>
          </div>
          <div className="flex items-center gap-5">
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
