'use client'

import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Package, Truck, Home, ArrowRight, Printer, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { navigate, Link } from '@/lib/router'
import { cn } from '@/lib/utils'
import { formatDate, formatNaira } from '@/lib/money'
import { Button } from '@/components/ui/button'
import { ProductImage } from '@/components/site/price'
import { Reveal } from '@/components/site/reveal'
import { PRODUCTION_TIERS, formatMeasurements, shippingLabel, type OrderView } from '@/lib/types'

const STEPS = [
  { key: 'PAID', label: 'Order placed', icon: Check },
  { key: 'PROCESSING', label: 'In the atelier', icon: Package },
  { key: 'SHIPPED', label: 'On its way', icon: Truck },
  { key: 'DELIVERED', label: 'Delivered', icon: Home },
] as const

/** Copy the order number to the clipboard — for receipts, notes and support threads. */
function CopyOrderNumber({ orderNumber }: { orderNumber: string }) {
  const [copied, setCopied] = useState(false)
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(orderNumber)
    } catch {
      const el = document.createElement('textarea')
      el.value = orderNumber
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
    toast.success(`${orderNumber} copied — for your records.`)
    window.setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      type="button"
      onClick={() => void onCopy()}
      className="flex items-center gap-1.5 border-b border-line-strong pb-1 text-[0.64rem] font-medium uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
      aria-label={`Copy order number ${orderNumber} to the clipboard`}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-espresso" strokeWidth={1.5} aria-hidden />
      ) : (
        <Copy className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
      )}
      {copied ? 'Copied' : 'Copy order number'}
    </button>
  )
}

export function OrderConfirmationPage({ orderNumber }: { orderNumber: string }) {
  const qc = useQueryClient()

  useEffect(() => {
    document.title = `Order ${orderNumber} — Style Sence`
  }, [orderNumber])

  // Gateway return (Paystack callback / Stripe success redirect): verify the
  // payment server-side before believing anything, then refresh the order.
  useEffect(() => {
    const hash = window.location.hash
    const queryIdx = hash.indexOf('?')
    if (queryIdx === -1) return
    const params = new URLSearchParams(hash.slice(queryIdx + 1))
    const reference = params.get('reference') ?? params.get('trxref') ?? params.get('session_id')
    if (!reference) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/checkout/verify?order=${encodeURIComponent(orderNumber)}&reference=${encodeURIComponent(reference)}`)
        const body = await res.json()
        if (cancelled) return
        if (res.ok && body.verified) toast.success('Payment confirmed — thank you.')
        else if (res.ok) toast('Payment is still pending — if you completed it, WhatsApp the studio on +234 816 302 2233.')
        else toast.error(body.error ?? 'Payment verification failed.')
      } catch {
        if (!cancelled) toast.error('Payment verification failed — refresh in a moment.')
      } finally {
        if (!cancelled) qc.invalidateQueries({ queryKey: ['order', orderNumber] })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [orderNumber, qc])

  const { data, isLoading, isError } = useQuery({
    queryKey: ['order', orderNumber],
    queryFn: async () => {
      const res = await fetch(`/api/orders/${orderNumber}`)
      if (!res.ok) throw new Error('Not found')
      return (await res.json()) as { order: OrderView }
    },
    retry: false,
  })

  if (isLoading) {
    return (
      <div className="container-site py-24" aria-busy>
        <div className="mx-auto max-w-2xl animate-pulse space-y-6">
          <div className="h-12 w-2/3 bg-secondary" />
          <div className="h-4 w-1/3 bg-secondary" />
          <div className="h-40 w-full bg-secondary" />
        </div>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="container-site flex flex-col items-center py-32 text-center">
        <p className="font-display text-4xl font-light italic">Order not found.</p>
        <p className="mt-3 text-sm text-muted-foreground">
          Check the order number — it begins with SS-2026-.
        </p>
        <Button className="mt-8 h-12 px-8 uppercase tracking-[0.2em] text-[0.66rem]" onClick={() => navigate('/shop')}>
          Back to the collection
        </Button>
      </div>
    )
  }

  const order = data.order
  const cancelled = order.status === 'CANCELLED'
  const currentStep = STEPS.findIndex((s) => s.key === order.status)
  const firstName = order.fullName.split(' ')[0]

  return (
    <div className="container-site py-12 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <Reveal className="text-center">
          <p className="eyebrow">Order {order.orderNumber}</p>
          <h1 className="mt-3 font-display text-4xl font-light tracking-tight text-balance sm:text-5xl">
            {cancelled ? 'This order was cancelled.' : `Thank you, ${firstName}.`}
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            {cancelled
              ? 'The pieces have been released back to the rail. Nothing further is owed on this order.'
              : 'Your pieces are being prepared. A confirmation email is on its way, and we will write again when your order leaves the studio.'}
          </p>
          <div className="no-print mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 border-b border-line-strong pb-1 text-[0.64rem] font-medium uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
            >
              <Printer className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
              Print receipt
            </button>
            <CopyOrderNumber orderNumber={order.orderNumber} />
          </div>
        </Reveal>

        {!cancelled ? (
          <Reveal delay={0.08} className="no-print mt-12">
            <ol className="relative flex justify-between border-t border-line pt-8" aria-label="Order progress">
              {STEPS.map((step, i) => {
                const done = i <= currentStep
                const current = i === currentStep
                const Icon = step.icon
                return (
                  <li key={step.key} className="relative flex flex-1 flex-col items-center text-center">
                    {i > 0 ? (
                      <span
                        aria-hidden
                        className={cn(
                          'absolute top-[-1px] right-1/2 h-px w-full',
                          i <= currentStep ? 'bg-foreground' : 'bg-line-strong',
                        )}
                      />
                    ) : null}
                    <span
                      className={cn(
                        'relative flex h-10 w-10 items-center justify-center rounded-full border transition-colors',
                        done
                          ? 'border-foreground bg-foreground text-background'
                          : 'border-line-strong bg-background text-muted-foreground/50',
                        current && 'ring-4 ring-secondary',
                      )}
                    >
                      <Icon className="h-4 w-4" strokeWidth={1.5} aria-hidden />
                    </span>
                    <span
                      className={cn(
                        'mt-3 text-[0.64rem] font-medium uppercase tracking-[0.16em]',
                        done ? 'text-foreground' : 'text-muted-foreground/60',
                      )}
                    >
                      {step.label}
                    </span>
                  </li>
                )
              })}
            </ol>
          </Reveal>
        ) : null}

        <Reveal delay={0.12} className="mt-12">
          <div className="border border-line bg-card">
            <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line px-6 py-5">
              <div>
                <p className="eyebrow">Details</p>
                <p className="mt-1.5 text-sm">
                  {order.fullName} · {order.email}
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {order.address}, {order.city}, {order.state}, {order.country}
                </p>
                <p className="mt-2 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-espresso">
                  {PRODUCTION_TIERS[order.productionTier].label} · {PRODUCTION_TIERS[order.productionTier].eta}
                </p>
                {order.notes ? (
                  <div className="mt-2">
                    <p className="font-sans text-[0.58rem] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Delivery notes
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed italic text-muted-foreground">
                      {order.notes}
                    </p>
                  </div>
                ) : null}
              </div>
              <p className="text-[0.7rem] uppercase tracking-[0.16em] text-muted-foreground">
                {formatDate(order.createdAt)}
              </p>
            </div>

            <ul className="divide-y divide-line px-6">
              {order.items.map((item, i) => (
                <li key={i} className="flex gap-4 py-4">
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
                    {item.sizeMode === 'custom' ? (
                      <div className="mt-1.5 space-y-1">
                        <span className="inline-flex items-center border border-line-strong px-1.5 py-0.5 font-mono text-[0.58rem] uppercase tracking-[0.18em] text-espresso">
                          Custom measurements
                        </span>
                        <p className="font-mono text-[0.7rem] tabular-nums text-muted-foreground">
                          {formatMeasurements(item.customMeasurements)}
                        </p>
                        {item.notes ? (
                          <div>
                            <p className="font-sans text-[0.58rem] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                              Atelier note
                            </p>
                            <p className="line-clamp-2 text-xs leading-relaxed italic text-muted-foreground">
                              “{item.notes}”
                            </p>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <span className="font-mono text-sm tabular-nums">
                    {formatNaira(item.unitPrice * item.qty)}
                  </span>
                </li>
              ))}
            </ul>

            <dl className="space-y-2 border-t border-line px-6 py-5 text-sm">
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
                <dt className="text-muted-foreground">
                  {shippingLabel(order.shippingMethod)}
                  {order.shipping === 0 ? ' — complimentary' : ''}
                </dt>
                <dd className="font-mono tabular-nums">{formatNaira(order.shipping)}</dd>
              </div>
              {order.productionFee > 0 ? (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Express production</dt>
                  <dd className="font-mono tabular-nums">+{formatNaira(order.productionFee)}</dd>
                </div>
              ) : null}
              <div className="flex items-baseline justify-between border-t border-line pt-3">
                <dt className="font-display text-lg">Total</dt>
                <dd className="font-mono text-xl font-medium tabular-nums">{formatNaira(order.total)}</dd>
              </div>
            </dl>
            <p className="border-t border-line px-6 py-4 text-[0.66rem] leading-relaxed text-muted-foreground">
              Every piece is cut to order — production begins now that payment is complete.
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.16} className="no-print mt-6">
          <p className="border border-line bg-secondary/50 px-4 py-3.5 text-sm leading-relaxed text-muted-foreground">
            A confirmation email is on its way. Courier tracking appears on your order page
            the moment your piece leaves the studio — follow progress any time from{' '}
            <span className="font-medium text-foreground">Track order</span> below.
          </p>
        </Reveal>

        <Reveal delay={0.2} className="no-print mt-10 flex flex-wrap justify-center gap-3">
          <Button
            className="h-12 px-8 uppercase tracking-[0.2em] text-[0.66rem]"
            onClick={() => navigate('/shop')}
          >
            Continue shopping
            <ArrowRight className="ml-2 h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
          </Button>
          <Button
            variant="outline"
            className="h-12 border-line-strong px-8 uppercase tracking-[0.2em] text-[0.66rem] hover:border-foreground"
            onClick={() => navigate('/journal')}
          >
            Read the journal
          </Button>
        </Reveal>
      </div>
    </div>
  )
}
