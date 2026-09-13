'use client'

import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, Package, Truck, Home, ArrowRight } from 'lucide-react'
import { navigate, Link } from '@/lib/router'
import { cn } from '@/lib/utils'
import { formatDate, formatNaira } from '@/lib/money'
import { Button } from '@/components/ui/button'
import { ProductImage } from '@/components/site/price'
import { DevPlaceholder } from '@/components/site/dev-placeholder'
import { Reveal } from '@/components/site/reveal'
import type { OrderView } from '@/lib/types'

const STEPS = [
  { key: 'PAID', label: 'Order placed', icon: Check },
  { key: 'PROCESSING', label: 'In the atelier', icon: Package },
  { key: 'SHIPPED', label: 'On its way', icon: Truck },
  { key: 'DELIVERED', label: 'Delivered', icon: Home },
] as const

export function OrderConfirmationPage({ orderNumber }: { orderNumber: string }) {
  useEffect(() => {
    document.title = `Order ${orderNumber} — Style Sence`
  }, [orderNumber])

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
              ? 'The pieces have been released back to the rail. Nothing was charged — this is a development preview.'
              : 'Your pieces are being prepared. A confirmation email would arrive shortly — dev placeholder.'}
          </p>
        </Reveal>

        {!cancelled ? (
          <Reveal delay={0.08} className="mt-12">
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
              <div className="flex justify-between">
                <dt className="text-muted-foreground">
                  {order.shippingMethod === 'express' ? 'Express delivery' : 'Standard delivery'}
                </dt>
                <dd className="font-mono tabular-nums">{formatNaira(order.shipping)}</dd>
              </div>
              <div className="flex items-baseline justify-between border-t border-line pt-3">
                <dt className="font-display text-lg">Total</dt>
                <dd className="font-mono text-xl font-medium tabular-nums">{formatNaira(order.total)}</dd>
              </div>
            </dl>
          </div>
        </Reveal>

        <Reveal delay={0.16} className="mt-6">
          <DevPlaceholder title="Transactional email & tracking">
            Confirmation email and courier tracking links are simulated in this environment.
            Order status can be advanced from the admin console.
          </DevPlaceholder>
        </Reveal>

        <Reveal delay={0.2} className="mt-10 flex flex-wrap justify-center gap-3">
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
