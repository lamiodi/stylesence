'use client'

/**
 * #/track — Order tracking (lookup by order number, or guest order history by email).
 * Editorial lookup page: hero + mono form with a segmented mode toggle,
 * recent-lookup chips (localStorage), status timeline, items, delivery block
 * and totals — visual language shared with the order confirmation page,
 * adapted for a public lookup context.
 */

import { useEffect, useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Check, Home, Package, Truck, XCircle } from 'lucide-react'
import { navigate, Link, useRoute } from '@/lib/router'
import { cn } from '@/lib/utils'
import { formatDate, formatNaira } from '@/lib/money'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { ProductImage } from '@/components/site/price'
import { DevPlaceholder } from '@/components/site/dev-placeholder'
import { Reveal } from '@/components/site/reveal'
import { SHIPPING_METHODS, type OrderView } from '@/lib/types'

/* ——— constants ——— */

const ORDER_PATTERN = /^SS-\d{4}-\d{4,6}$/
const ORDER_HINT = 'SS-2026-1234'
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const HISTORY_KEY = 'ss-track-history'
const HISTORY_MAX = 5

const STEPS = [
  { key: 'PAID', label: 'Order placed', icon: Check },
  { key: 'PROCESSING', label: 'In the atelier', icon: Package },
  { key: 'SHIPPED', label: 'On its way', icon: Truck },
  { key: 'DELIVERED', label: 'Delivered', icon: Home },
] as const

const STATUS_LABELS: Record<string, string> = {
  PAID: 'Order placed',
  PROCESSING: 'In the atelier',
  SHIPPED: 'On its way',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
}

/* ——— recent-lookup history (localStorage, guarded) ——— */

function readHistory(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((v): v is string => typeof v === 'string' && ORDER_PATTERN.test(v))
      .slice(0, HISTORY_MAX)
  } catch {
    return []
  }
}

/** Remember a successful lookup — most recent first, distinct, capped. Returns the next list. */
function rememberLookup(orderNumber: string): string[] {
  const next = [orderNumber, ...readHistory().filter((n) => n !== orderNumber)].slice(0, HISTORY_MAX)
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
  } catch {
    // Storage unavailable (private mode / blocked) — this session keeps the list in state only.
  }
  return next
}

/* ——— guest order-history summary (GET /api/orders?email=) ——— */

interface EmailOrderSummary {
  orderNumber: string
  status: string
  total: number
  itemCount: number
  createdAt: string
}

export function TrackOrderPage() {
  useEffect(() => {
    document.title = 'Track Order — Style Sence'
  }, [])

  const route = useRoute()
  // The lead remounts this page whenever the `mode`/`order`/`email` queries change,
  // so mount-time initialisation is safe — no effects needed to sync state to the route.
  const initialOrder = () => route.query.get('order')?.trim().toUpperCase() ?? ''
  const initialEmail = () => route.query.get('email')?.trim().toLowerCase() ?? ''
  const [mode, setMode] = useState<'order' | 'email'>(() => {
    if (route.query.get('mode') === 'email') return 'email'
    if (route.query.get('mode') === 'order') return 'order'
    return initialEmail() ? 'email' : 'order'
  })
  const [input, setInput] = useState(initialOrder)
  const [lookup, setLookup] = useState<string | null>(() => {
    const initial = initialOrder()
    return initial && ORDER_PATTERN.test(initial) ? initial : null
  })
  const [formError, setFormError] = useState<string | null>(() => {
    const initial = initialOrder()
    return initial && !ORDER_PATTERN.test(initial)
      ? `That doesn’t look like an order number — they look like ${ORDER_HINT}.`
      : null
  })
  const [emailInput, setEmailInput] = useState(initialEmail)
  const [emailLookup, setEmailLookup] = useState<string | null>(() => {
    const initial = initialEmail()
    return initial && EMAIL_PATTERN.test(initial) ? initial : null
  })
  const [emailError, setEmailError] = useState<string | null>(() => {
    const initial = initialEmail()
    return initial && !EMAIL_PATTERN.test(initial)
      ? 'That doesn’t look like an email address — check the spelling and try again.'
      : null
  })
  const [history, setHistory] = useState<string[]>(readHistory)

  const switchMode = (next: 'order' | 'email') => {
    if (next === mode) return
    setMode(next)
    // Fresh slate for the other mode — URL drives the remount, state resets cleanly.
    navigate(`/track?mode=${next}`)
  }

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['order', lookup],
    enabled: mode === 'order' && lookup !== null,
    retry: false,
    staleTime: 0, // tracking should always re-check on mount
    queryFn: async () => {
      if (!lookup) throw new Error('No order number provided')
      const res = await fetch(`/api/orders/${encodeURIComponent(lookup)}`)
      let body: { order?: OrderView; error?: string } | null = null
      try {
        body = (await res.json()) as { order?: OrderView; error?: string }
      } catch {
        body = null
      }
      if (!res.ok || !body?.order) throw new Error(body?.error ?? 'Order not found')
      // Successful lookup — remember it (idempotent; runs on every mount-time refetch).
      setHistory(rememberLookup(body.order.orderNumber))
      return { order: body.order }
    },
  })

  const emailQuery = useQuery({
    queryKey: ['orders-by-email', emailLookup],
    enabled: mode === 'email' && emailLookup !== null,
    retry: false,
    staleTime: 0,
    queryFn: async () => {
      if (!emailLookup) throw new Error('No email provided')
      const res = await fetch(`/api/orders?email=${encodeURIComponent(emailLookup)}`)
      let body: { orders?: EmailOrderSummary[]; error?: string } | null = null
      try {
        body = (await res.json()) as { orders?: EmailOrderSummary[]; error?: string }
      } catch {
        body = null
      }
      if (!res.ok || !body?.orders) throw new Error(body?.error ?? 'Lookup failed')
      return { orders: body.orders }
    },
  })

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const value = input.trim().toUpperCase()
    if (!ORDER_PATTERN.test(value)) {
      setFormError(`That doesn’t look like an order number — they look like ${ORDER_HINT}.`)
      return
    }
    setFormError(null)
    setInput(value)
    setLookup(value)
    // Mirror the lookup in the URL — the remount re-reads it (shareable, back-button safe).
    navigate(`/track?order=${encodeURIComponent(value)}`)
  }

  const onEmailSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const value = emailInput.trim().toLowerCase()
    if (!EMAIL_PATTERN.test(value)) {
      setEmailError('That doesn’t look like an email address — check the spelling and try again.')
      return
    }
    setEmailError(null)
    setEmailInput(value)
    setEmailLookup(value)
    navigate(`/track?mode=email&email=${encodeURIComponent(value)}`)
  }

  return (
    <div className="container-site py-12 sm:py-16">
      {/* ————— editorial hero + lookup ————— */}
      <div className="mx-auto max-w-xl text-center">
        <Reveal>
          <p className="eyebrow">Order tracking</p>
          <h1 className="mt-3 font-display text-4xl font-light tracking-tight text-balance sm:text-5xl">
            Where is my piece?
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            {mode === 'order'
              ? 'Enter the order number from your confirmation email — we’ll show you exactly where your pieces are.'
              : 'Enter the email you used at checkout and we’ll gather every order placed with it.'}
          </p>
        </Reveal>

        <Reveal delay={0.08} className="mt-8">
          {/* segmented mode toggle */}
          <div
            role="group"
            aria-label="Lookup method"
            className="mx-auto flex w-fit items-center border border-line-strong bg-background p-1"
          >
            {(
              [
                { key: 'order', label: 'By order number' },
                { key: 'email', label: 'All my orders' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => switchMode(opt.key)}
                aria-pressed={mode === opt.key}
                className={cn(
                  'min-h-11 px-5 text-[0.62rem] font-medium uppercase tracking-[0.18em] transition-colors',
                  mode === opt.key
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {mode === 'order' ? (
            <form onSubmit={onSubmit} noValidate className="mx-auto mt-6 max-w-md text-left">
              <Label htmlFor="track-order-number" className="eyebrow">
                Order number
              </Label>
              <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                <Input
                  id="track-order-number"
                  name="order-number"
                  type="text"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="go"
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value)
                    if (formError) setFormError(null)
                  }}
                  placeholder="SS-2026-0000"
                  aria-invalid={formError ? true : undefined}
                  aria-describedby={formError ? 'track-order-error' : undefined}
                  className="h-12 border-line-strong bg-background font-mono text-sm uppercase tracking-[0.08em] placeholder:font-normal placeholder:tracking-[0.08em] placeholder:text-muted-foreground/60 focus-visible:ring-0"
                />
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="h-12 px-8 uppercase tracking-[0.2em] text-[0.66rem]"
                >
                  Track order
                  <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
                </Button>
              </div>
              {formError ? (
                <p id="track-order-error" role="alert" className="mt-2.5 text-xs leading-relaxed text-destructive">
                  {formError}
                </p>
              ) : null}
            </form>
          ) : (
            <form onSubmit={onEmailSubmit} noValidate className="mx-auto mt-6 max-w-md text-left">
              <Label htmlFor="track-email" className="eyebrow">
                Email address
              </Label>
              <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                <Input
                  id="track-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  enterKeyHint="go"
                  value={emailInput}
                  onChange={(e) => {
                    setEmailInput(e.target.value)
                    if (emailError) setEmailError(null)
                  }}
                  placeholder="you@example.com"
                  aria-invalid={emailError ? true : undefined}
                  aria-describedby={emailError ? 'track-email-error' : undefined}
                  className="h-12 border-line-strong bg-background text-sm placeholder:text-muted-foreground/60 focus-visible:ring-0"
                />
                <Button
                  type="submit"
                  disabled={emailQuery.isLoading}
                  className="h-12 px-8 uppercase tracking-[0.2em] text-[0.66rem]"
                >
                  Find my orders
                  <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
                </Button>
              </div>
              {emailError ? (
                <p id="track-email-error" role="alert" className="mt-2.5 text-xs leading-relaxed text-destructive">
                  {emailError}
                </p>
              ) : (
                <p className="mt-2.5 text-[0.66rem] leading-relaxed text-muted-foreground">
                  Guest orders placed with this email will be listed — a full account
                  history arrives with customer accounts.
                </p>
              )}
            </form>
          )}

          {mode === 'order' && history.length > 0 ? (
            <div className="mt-8">
              <p className="eyebrow">Recent lookups</p>
              <ul className="mt-3 flex flex-wrap justify-center gap-2" aria-label="Recent order lookups">
                {history.map((num) => (
                  <li key={num}>
                    <button
                      type="button"
                      onClick={() => navigate(`/track?order=${encodeURIComponent(num)}`)}
                      aria-current={num === lookup ? 'true' : undefined}
                      className={cn(
                        'inline-flex min-h-11 items-center rounded-full border px-4 font-mono text-[0.64rem] uppercase tracking-[0.1em] transition-colors',
                        num === lookup
                          ? 'border-foreground bg-foreground text-background'
                          : 'border-line-strong text-muted-foreground hover:border-foreground hover:text-foreground',
                      )}
                    >
                      {num}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Reveal>
      </div>

      {/* ————— lookup result ————— */}
      <div role="status" aria-live="polite" className="mx-auto mt-14 max-w-3xl sm:mt-16">
        {mode === 'email' ? (
          <EmailResult
            email={emailLookup}
            query={emailQuery}
          />
        ) : lookup === null ? (
          <p className="pt-2 text-center font-display text-lg font-light italic text-muted-foreground/80">
            Your order’s journey will appear here.
          </p>
        ) : isLoading ? (
          <div className="space-y-10" aria-busy="true">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-44 bg-secondary" />
              <Skeleton className="h-7 w-28 rounded-full bg-secondary" />
            </div>
            <Skeleton className="h-24 w-full bg-secondary" />
            <Skeleton className="h-64 w-full bg-secondary" />
            <p className="sr-only">Looking up order {lookup}…</p>
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center border border-dashed border-line-strong px-6 py-16 text-center">
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
              {lookup} — {error instanceof Error ? error.message : 'Order not found'}
            </p>
            <p className="mt-4 font-display text-3xl font-light italic text-balance">
              We couldn’t find that order.
            </p>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
              Double-check the number in your confirmation email — order numbers look like{' '}
              <span className="font-mono">{ORDER_HINT}</span>. If it still eludes you,{' '}
              <Link to="/help" className="link-underline font-medium text-foreground">
                the studio can help
              </Link>
              .
            </p>
            <Link
              to="/shop"
              className="link-underline mt-7 inline-flex min-h-11 items-center text-sm font-medium"
            >
              Browse the collection
            </Link>
          </div>
        ) : data ? (
          <OrderResult order={data.order} />
        ) : null}
      </div>
    </div>
  )
}

/* ——— email-mode result: guest order history list ——— */

const HISTORY_STATUS_STYLES: Record<string, string> = {
  DELIVERED: 'border-espresso/50 text-espresso',
  CANCELLED: 'border-destructive/45 text-destructive',
}

function EmailResult({
  email,
  query,
}: {
  email: string | null
  query: { data?: { orders: EmailOrderSummary[] }; isLoading: boolean; isError: boolean; error?: Error | null }
}) {
  if (email === null) {
    return (
      <p className="pt-2 text-center font-display text-lg font-light italic text-muted-foreground/80">
        Your orders will gather here.
      </p>
    )
  }
  if (query.isLoading) {
    return (
      <div className="space-y-3" aria-busy="true">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full bg-secondary" />
        ))}
        <p className="sr-only">Gathering orders for {email}…</p>
      </div>
    )
  }
  if (query.isError) {
    return (
      <div className="flex flex-col items-center border border-dashed border-line-strong px-6 py-14 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">{email}</p>
        <p className="mt-3 font-display text-2xl font-light italic text-balance">
          We couldn’t gather those orders.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {query.error instanceof Error ? query.error.message : 'Something went wrong.'}{' '}
          <Link to="/help" className="link-underline font-medium text-foreground">
            The studio can help
          </Link>
          .
        </p>
      </div>
    )
  }
  const orders = query.data?.orders ?? []
  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center border border-dashed border-line-strong px-6 py-14 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">{email}</p>
        <p className="mt-3 font-display text-2xl font-light italic text-balance">
          No orders with this email yet.
        </p>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          Orders placed as a guest with this address will appear here. Perhaps a new piece
          is in order —{' '}
          <Link to="/shop" className="link-underline font-medium text-foreground">
            the collection awaits
          </Link>
          .
        </p>
      </div>
    )
  }
  return (
    <Reveal>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-line pb-4">
        <p className="font-mono text-sm font-medium tracking-[0.08em]">{email}</p>
        <p className="text-[0.7rem] uppercase tracking-[0.16em] text-muted-foreground">
          {orders.length} order{orders.length === 1 ? '' : 's'} on file
        </p>
      </div>
      <ul className="mt-2 divide-y divide-line" aria-label="Orders for this email">
        {orders.map((o) => (
          <li key={o.orderNumber}>
            <button
              type="button"
              onClick={() => navigate(`/track?order=${encodeURIComponent(o.orderNumber)}`)}
              aria-label={`Track order ${o.orderNumber}`}
              className="group grid w-full grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-1 px-2 py-5 text-left transition-colors hover:bg-secondary/60 sm:grid-cols-[10rem_1fr_auto_auto] sm:px-4"
            >
              <p className="font-mono text-xs font-medium tracking-[0.08em] transition-colors group-hover:text-espresso">
                {o.orderNumber}
              </p>
              <p className="text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground">
                Placed {formatDate(o.createdAt)} · {o.itemCount}{' '}
                {o.itemCount === 1 ? 'piece' : 'pieces'}
              </p>
              <span
                className={cn(
                  'col-start-3 row-start-1 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[0.56rem] font-medium uppercase tracking-[0.16em]',
                  HISTORY_STATUS_STYLES[o.status] ?? 'border-line-strong text-foreground',
                )}
              >
                {STATUS_LABELS[o.status] ?? o.status}
              </span>
              <span className="col-start-3 row-start-2 flex items-center justify-end gap-2 font-mono text-sm tabular-nums sm:col-start-4 sm:row-start-1">
                {formatNaira(o.total)}
                <ArrowRight
                  className="h-3.5 w-3.5 text-muted-foreground/50 transition-colors group-hover:text-espresso"
                  strokeWidth={1.5}
                  aria-hidden
                />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Reveal>
  )
}

/* ——— result display ——— */

function OrderResult({ order }: { order: OrderView }) {
  const cancelled = order.status === 'CANCELLED'
  const delivered = order.status === 'DELIVERED'
  const currentStep = STEPS.findIndex((s) => s.key === order.status)
  const method =
    order.shippingMethod === 'express' ? SHIPPING_METHODS.express : SHIPPING_METHODS.standard

  return (
    <div>
      {/* header row — number, date placed, status chip */}
      <Reveal>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-line pb-6">
          <p className="font-mono text-sm font-medium tracking-[0.08em]">{order.orderNumber}</p>
          <p className="text-[0.7rem] uppercase tracking-[0.16em] text-muted-foreground">
            Placed {formatDate(order.createdAt)}
          </p>
          <span
            className={cn(
              'ml-auto inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[0.62rem] font-medium uppercase tracking-[0.18em]',
              cancelled
                ? 'border-destructive/45 text-destructive'
                : delivered
                  ? 'border-espresso/50 text-espresso'
                  : 'border-line-strong text-foreground',
            )}
          >
            <span
              aria-hidden
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                cancelled ? 'bg-destructive' : delivered ? 'bg-espresso' : 'bg-foreground',
              )}
            />
            {STATUS_LABELS[order.status] ?? order.status}
          </span>
        </div>
      </Reveal>

      {/* status timeline (vertical on mobile, horizontal from sm) */}
      {cancelled ? (
        <Reveal delay={0.08} className="mt-8 sm:mt-10">
          <div className="flex items-start gap-3 border border-destructive/40 bg-[color-mix(in_oklch,var(--destructive)_7%,transparent)] px-5 py-4 sm:px-6">
            <XCircle
              className="mt-0.5 h-4 w-4 shrink-0 text-destructive"
              strokeWidth={1.5}
              aria-hidden
            />
            <div>
              <p className="text-[0.66rem] font-medium uppercase tracking-[0.2em] text-destructive">
                Cancelled
              </p>
              <p className="mt-1.5 font-display text-lg font-light tracking-tight">
                This order was cancelled.
              </p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Placed {formatDate(order.createdAt)} — the pieces have been released back to the
                rail and nothing further will be dispatched.
              </p>
            </div>
          </div>
        </Reveal>
      ) : (
        <Reveal delay={0.08} className="mt-8 sm:mt-10">
          <ol aria-label="Order progress" className="flex flex-col sm:flex-row">
            {STEPS.map((step, i) => {
              const done = i <= currentStep
              const current = i === currentStep
              const Icon = step.icon
              return (
                <li
                  key={step.key}
                  className="relative flex items-start gap-4 pb-7 last:pb-0 sm:flex-1 sm:flex-col sm:items-center sm:gap-0 sm:pb-0 sm:text-center"
                >
                  {/* hairline connector — vertical on mobile, horizontal from sm */}
                  {i < STEPS.length - 1 ? (
                    <span
                      aria-hidden
                      className={cn(
                        'pointer-events-none absolute left-5 top-10 h-[calc(100%-2.5rem)] w-px',
                        'sm:left-[calc(50%+2.5rem)] sm:top-5 sm:h-px sm:w-[calc(100%-5rem)]',
                        done ? (delivered ? 'bg-espresso' : 'bg-foreground') : 'bg-line-strong',
                      )}
                    />
                  ) : null}
                  <span
                    className={cn(
                      'relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border',
                      done
                        ? delivered
                          ? 'border-accent bg-accent text-accent-foreground'
                          : 'border-foreground bg-foreground text-background'
                        : 'border-line-strong bg-background text-muted-foreground/50',
                      current && 'ring-4 ring-secondary',
                    )}
                  >
                    <Icon className="h-4 w-4" strokeWidth={1.5} aria-hidden />
                  </span>
                  <div className="pt-1.5 sm:pt-3">
                    <p
                      className={cn(
                        'text-[0.64rem] font-medium uppercase tracking-[0.16em]',
                        done
                          ? delivered
                            ? 'text-espresso'
                            : 'text-foreground'
                          : 'text-muted-foreground/60',
                      )}
                    >
                      {step.label}
                    </p>
                    {current ? (
                      <p className="mt-1 text-[0.6rem] uppercase tracking-[0.14em] text-espresso">
                        Current stage
                      </p>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ol>
        </Reveal>
      )}

      {/* items · delivery · totals */}
      <Reveal delay={0.12} className="mt-8 sm:mt-10">
        <div className="grid gap-6 lg:grid-cols-[1fr_19rem]">
          {/* items */}
          <section aria-label="Items in this order" className="border border-line bg-card">
            <div className="border-b border-line px-6 py-4">
              <p className="eyebrow">In this order</p>
            </div>
            <ul className="divide-y divide-line px-6">
              {order.items.map((item, i) => (
                <li
                  key={`${item.productSlug}-${item.size}-${item.color}-${i}`}
                  className="flex gap-4 py-4"
                >
                  <ProductImage
                    src={item.imageUrl}
                    alt={item.productName}
                    label={item.productName}
                    ratio="aspect-[3/4]"
                    className="w-16 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/product/${item.productSlug}`}
                      className="font-display text-[0.95rem] leading-tight hover:text-espresso"
                    >
                      {item.productName}
                    </Link>
                    <p className="mt-0.5 text-[0.66rem] uppercase tracking-[0.12em] text-muted-foreground">
                      {item.color} · {item.size} · ×{item.qty}
                    </p>
                  </div>
                  <span className="flex flex-col items-end font-mono tabular-nums">
                    <span className="text-sm">{formatNaira(item.unitPrice)}</span>
                    {item.qty > 1 ? (
                      <span className="mt-0.5 text-[0.66rem] text-muted-foreground">
                        ×{item.qty} = {formatNaira(item.unitPrice * item.qty)}
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* delivery + totals */}
          <div className="flex flex-col gap-6">
            <section aria-label="Delivery details" className="border border-line bg-card">
              <div className="border-b border-line px-6 py-4">
                <p className="eyebrow">Delivery</p>
              </div>
              <div className="space-y-5 px-6 py-5">
                <address className="text-sm leading-relaxed not-italic">
                  <span className="font-medium">{order.fullName}</span>
                  <br />
                  {order.address}
                  <br />
                  {order.city}, {order.state}
                  <br />
                  {order.country}
                  {order.phone ? (
                    <>
                      <br />
                      <span className="text-muted-foreground">{order.phone}</span>
                    </>
                  ) : null}
                </address>
                <div className="border-t border-line pt-4">
                  <p className="text-sm font-medium">{method.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {method.eta} ·{' '}
                    {order.shipping === 0 ? 'Complimentary' : formatNaira(order.shipping)}
                  </p>
                </div>
                <DevPlaceholder title="Courier tracking">
                  A live courier tracking link will appear here once the dispatch integration is
                  connected.
                </DevPlaceholder>
              </div>
            </section>

            <section aria-label="Order totals" className="border border-line bg-card">
              <div className="border-b border-line px-6 py-4">
                <p className="eyebrow">Totals</p>
              </div>
              <dl className="space-y-2 px-6 py-5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Subtotal</dt>
                  <dd className="font-mono tabular-nums">{formatNaira(order.subtotal)}</dd>
                </div>
                {order.discount > 0 ? (
                  <div className="flex justify-between text-espresso">
                    <dt className="flex items-center gap-1.5">
                      <span className="h-[3px] w-[3px] rounded-full bg-espresso" aria-hidden />
                      {order.promoCodes && order.promoCodes.length > 0
                        ? order.promoCodes.join(' + ')
                        : (order.promoCode ?? 'Promo')}
                    </dt>
                    <dd className="font-mono tabular-nums">−{formatNaira(order.discount)}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{method.label}</dt>
                  <dd className="font-mono tabular-nums">
                    {order.shipping === 0 ? 'Complimentary' : formatNaira(order.shipping)}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between border-t border-line pt-3">
                  <dt className="font-display text-lg">Total</dt>
                  <dd className="font-mono text-xl font-medium tabular-nums">
                    {formatNaira(order.total)}
                  </dd>
                </div>
              </dl>
            </section>
          </div>
        </div>
      </Reveal>
    </div>
  )
}
