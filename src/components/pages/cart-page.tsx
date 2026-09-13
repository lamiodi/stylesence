'use client'

import { useEffect } from 'react'
import { X, ArrowRight } from 'lucide-react'
import { Link, navigate } from '@/lib/router'
import { formatNaira } from '@/lib/money'
import { Button } from '@/components/ui/button'
import { ProductImage } from '@/components/site/price'
import { QuantityStepper } from '@/components/site/quantity-stepper'
import { Reveal } from '@/components/site/reveal'
import { useCart, useUpdateCartItem, useRemoveCartItem, useClearCart } from '@/lib/cart-client'
import { usePromoStore } from '@/lib/store/promo'
import { PromoInput, usePromoValidation } from '@/components/site/promo-box'

export function CartPage() {
  useEffect(() => {
    document.title = 'Your bag — Style Sence'
  }, [])

  const { data: cart, isLoading } = useCart()
  const update = useUpdateCartItem()
  const remove = useRemoveCartItem()
  const clear = useClearCart()
  const promoCode = usePromoStore((s) => s.code)
  const { data: promoData } = usePromoValidation(promoCode, cart?.subtotal ?? 0)
  const promo = promoData?.promo

  const items = cart?.items ?? []
  const FREE_SHIPPING_THRESHOLD = 150000
  const remaining = Math.max(0, FREE_SHIPPING_THRESHOLD - (cart?.subtotal ?? 0))
  const subtotal = cart?.subtotal ?? 0
  const discount = promo?.discount ?? 0

  return (
    <div className="container-site py-10 sm:py-14">
      <Reveal>
        <p className="eyebrow">Your selection</p>
        <h1 className="mt-2 font-display text-4xl font-light tracking-tight sm:text-5xl">The bag</h1>
      </Reveal>

      {isLoading ? (
        <div className="mt-10 animate-pulse space-y-6" aria-busy>
          {[0, 1].map((i) => (
            <div key={i} className="flex gap-5">
              <div className="h-40 w-32 bg-secondary" />
              <div className="flex-1 space-y-3 py-4">
                <div className="h-5 w-2/3 bg-secondary" />
                <div className="h-3 w-1/3 bg-secondary" />
                <div className="h-8 w-28 bg-secondary" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <Reveal className="mt-10">
          <div className="flex flex-col items-center border border-dashed border-line-strong px-6 py-24 text-center">
            <p className="font-display text-3xl font-light italic">The bag is empty — for now.</p>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
              The collection is quiet, considered, and waiting to be considered by you.
            </p>
            <Button
              className="mt-8 h-12 px-8 uppercase tracking-[0.2em] text-[0.66rem]"
              onClick={() => navigate('/shop')}
            >
              Shop the collection
            </Button>
          </div>
        </Reveal>
      ) : (
        <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_22rem] lg:gap-16">
          {/* items */}
          <div>
            {remaining > 0 ? (
              <div className="mb-6 border border-line bg-secondary/60 px-4 py-3">
                <p className="text-[0.78rem] text-muted-foreground">
                  You are <span className="font-mono font-medium text-foreground tabular-nums">{formatNaira(remaining)}</span> away from
                  complimentary shipping.
                </p>
                <div className="mt-2 h-1 overflow-hidden bg-secondary">
                  <div
                    className="h-full bg-espresso transition-all duration-700"
                    style={{ width: `${Math.min(100, ((cart?.subtotal ?? 0) / FREE_SHIPPING_THRESHOLD) * 100)}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="mb-6 border border-line bg-secondary/60 px-4 py-3">
                <p className="text-[0.78rem] text-espresso">
                  Complimentary standard shipping unlocked — our thanks.
                </p>
              </div>
            )}

            <ul className="divide-y divide-line border-t border-line">
              {items.map((item) => (
                <li key={item.id} className="flex gap-5 py-6">
                  <Link
                    to={`/product/${item.product.slug}`}
                    className="shrink-0 focus-visible:outline-2 focus-visible:outline-ring"
                    aria-label={`View ${item.product.name}`}
                  >
                    <ProductImage
                      src={item.product.primaryImage}
                      alt={item.product.name}
                      label={item.product.name}
                      ratio="aspect-[3/4]"
                      className="w-28 sm:w-32"
                    />
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <Link
                          to={`/product/${item.product.slug}`}
                          className="font-display text-lg leading-snug tracking-tight hover:text-espresso"
                        >
                          {item.product.name}
                        </Link>
                        <p className="mt-1 text-[0.7rem] uppercase tracking-[0.16em] text-muted-foreground">
                          {item.variant.color} · Size {item.variant.size}
                        </p>
                        <p className="mt-1 font-mono text-[0.72rem] text-muted-foreground/80 tabular-nums">
                          {formatNaira(item.product.price)} each
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => remove.mutate(item.id)}
                        className="flex h-8 w-8 items-center justify-center text-muted-foreground/60 transition-colors hover:text-destructive"
                        aria-label={`Remove ${item.product.name} from bag`}
                      >
                        <X className="h-4 w-4" strokeWidth={1.5} />
                      </button>
                    </div>
                    <div className="mt-auto flex items-center justify-between pt-4">
                      <QuantityStepper
                        value={item.qty}
                        min={1}
                        max={Math.min(10, item.variant.stock)}
                        onChange={(v) => update.mutate({ itemId: item.id, qty: v })}
                        disabled={update.isPending}
                      />
                      <span className="font-mono text-base font-medium tabular-nums">
                        {formatNaira(item.product.price * item.qty)}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-6 flex items-center justify-between">
              <Link to="/shop" className="eyebrow-ink flex items-center gap-1.5 border-b border-foreground pb-1 hover:border-espresso hover:text-espresso">
                Continue shopping
              </Link>
              <button
                type="button"
                onClick={() => clear.mutate()}
                className="text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground/70 underline decoration-line-strong underline-offset-4 transition-colors hover:text-destructive"
              >
                Empty the bag
              </button>
            </div>
          </div>

          {/* summary */}
          <aside className="lg:sticky lg:top-32 lg:self-start">
            <div className="border border-line bg-card p-6">
              <p className="eyebrow">Order summary</p>
              <dl className="mt-4 space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Subtotal ({cart?.itemCount ?? 0} items)</dt>
                  <dd className="font-mono tabular-nums">{formatNaira(subtotal)}</dd>
                </div>
                {promo && discount > 0 ? (
                  <div className="flex justify-between text-espresso">
                    <dt className="flex items-center gap-1.5">
                      <span className="h-[3px] w-[3px] rounded-full bg-espresso" aria-hidden />
                      {promo.code}
                    </dt>
                    <dd className="font-mono tabular-nums">−{formatNaira(discount)}</dd>
                  </div>
                ) : null}
                {promo?.freeShipping ? (
                  <div className="flex justify-between text-espresso">
                    <dt className="flex items-center gap-1.5">
                      <span className="h-[3px] w-[3px] rounded-full bg-espresso" aria-hidden />
                      {promo.code}
                    </dt>
                    <dd>Complimentary shipping</dd>
                  </div>
                ) : null}
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Shipping</dt>
                  <dd className="text-[0.78rem] text-muted-foreground">
                    {promo?.freeShipping ? 'Complimentary' : 'Calculated at checkout'}
                  </dd>
                </div>
              </dl>
              <div className="mt-4 border-t border-line pt-4">
                <div className="flex items-baseline justify-between">
                  <span className="font-display text-lg">Total</span>
                  <span className="font-mono text-xl font-medium tabular-nums">
                    {formatNaira(Math.max(0, subtotal - discount))}
                  </span>
                </div>
                <p className="mt-1 text-right text-[0.66rem] text-muted-foreground/70">excl. shipping</p>
              </div>
              <Button
                className="mt-6 h-12 w-full uppercase tracking-[0.2em] text-[0.66rem]"
                onClick={() => navigate('/checkout')}
              >
                Proceed to checkout
                <ArrowRight className="ml-2 h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
              </Button>
              <div className="mt-4">
                <PromoInput subtotal={subtotal} />
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
