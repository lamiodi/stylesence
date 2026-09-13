'use client'

import { X, ShoppingBag } from 'lucide-react'
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { navigate } from '@/lib/router'
import { formatNaira } from '@/lib/money'
import { useCart, useUpdateCartItem, useRemoveCartItem } from '@/lib/cart-client'
import { useUi } from '@/lib/store/wishlist'
import { ProductImage } from './price'
import { QuantityStepper } from './quantity-stepper'

export function CartSheet() {
  const open = useUi((s) => s.cartOpen)
  const setOpen = useUi((s) => s.setCartOpen)
  const { data: cart, isLoading } = useCart()
  const update = useUpdateCartItem()
  const remove = useRemoveCartItem()

  const items = cart?.items ?? []

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="right"
        className="flex w-full flex-col border-l border-line bg-background p-0 sm:max-w-md"
      >
        <SheetTitle className="sr-only">Shopping bag</SheetTitle>
        <SheetDescription className="sr-only">Review the pieces in your bag.</SheetDescription>

        <div className="flex items-center justify-between border-b border-line px-6 py-5">
          <div>
            <p className="eyebrow">Your bag</p>
            <h2 className="mt-1 font-display text-xl font-light tracking-tight">
              {isLoading ? '—' : `${cart?.itemCount ?? 0} ${cart?.itemCount === 1 ? 'piece' : 'pieces'}`}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex h-9 w-9 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Close bag"
          >
            <X className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </div>

        <div className="scroll-elegant flex-1 overflow-y-auto px-6">
          {isLoading ? (
            <div className="space-y-6 py-6" aria-hidden>
              {[0, 1].map((i) => (
                <div key={i} className="flex gap-4 animate-pulse">
                  <div className="h-28 w-20 bg-secondary" />
                  <div className="flex-1 space-y-2 py-2">
                    <div className="h-4 w-3/4 bg-secondary" />
                    <div className="h-3 w-1/2 bg-secondary" />
                    <div className="h-3 w-1/3 bg-secondary" />
                  </div>
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center py-16 text-center">
              <ShoppingBag className="h-8 w-8 text-muted-foreground/40" strokeWidth={1} aria-hidden />
              <p className="mt-4 font-display text-xl font-light italic">Your bag is empty.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                The collection is one click away.
              </p>
              <Button
                variant="outline"
                className="mt-6 h-11 border-line-strong uppercase tracking-[0.18em] text-[0.66rem]"
                onClick={() => {
                  setOpen(false)
                  navigate('/shop')
                }}
              >
                Shop the collection
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {items.map((item) => (
                <li key={item.id} className="flex gap-4 py-5">
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false)
                      navigate(`/product/${item.product.slug}`)
                    }}
                    className="shrink-0 focus-visible:outline-2 focus-visible:outline-ring"
                    aria-label={`View ${item.product.name}`}
                  >
                    <ProductImage
                      src={item.product.primaryImage}
                      alt={item.product.name}
                      label={item.product.name}
                      ratio="aspect-[3/4]"
                      className="w-20"
                    />
                  </button>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-display text-[0.95rem] leading-snug">
                          {item.product.name}
                        </p>
                        <p className="mt-0.5 text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground">
                          {item.variant.color} · {item.variant.size}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => remove.mutate(item.id)}
                        className="text-muted-foreground/60 transition-colors hover:text-destructive"
                        aria-label={`Remove ${item.product.name}`}
                      >
                        <X className="h-3.5 w-3.5" strokeWidth={1.5} />
                      </button>
                    </div>
                    <div className="mt-auto flex items-center justify-between pt-3">
                      <QuantityStepper
                        compact
                        value={item.qty}
                        min={1}
                        max={Math.min(10, item.variant.stock)}
                        onChange={(v) => update.mutate({ itemId: item.id, qty: v })}
                        disabled={update.isPending}
                      />
                      <span className="font-mono text-[0.8rem] font-medium tabular-nums">
                        {formatNaira(item.product.price * item.qty)}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {items.length > 0 ? (
          <div className="border-t border-line px-6 py-5">
            <div className="flex items-baseline justify-between">
              <span className="eyebrow">Subtotal</span>
              <span className="font-mono text-base font-medium tabular-nums">
                {formatNaira(cart?.subtotal ?? 0)}
              </span>
            </div>
            <p className="mt-1 text-[0.7rem] text-muted-foreground">
              Shipping calculated at checkout.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="h-11 border-line-strong uppercase tracking-[0.18em] text-[0.64rem]"
                onClick={() => {
                  setOpen(false)
                  navigate('/cart')
                }}
              >
                View bag
              </Button>
              <Button
                className="h-11 uppercase tracking-[0.18em] text-[0.64rem]"
                onClick={() => {
                  setOpen(false)
                  navigate('/checkout')
                }}
              >
                Checkout
              </Button>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
