'use client'

import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Lock, ArrowRight } from 'lucide-react'
import { Link, navigate } from '@/lib/router'
import { cn } from '@/lib/utils'
import { formatNaira } from '@/lib/money'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { ProductImage } from '@/components/site/price'
import { DevPlaceholder } from '@/components/site/dev-placeholder'
import { Reveal } from '@/components/site/reveal'
import { useCart } from '@/lib/cart-client'
import { useCustomer } from '@/hooks/use-customer'
import { usePromoStore } from '@/lib/store/promo'
import { PromoInput, usePromoValidation } from '@/components/site/promo-box'
import { FREE_SHIPPING_THRESHOLD } from '@/components/site/shipping-meter'
import { SHIPPING_METHODS, type ShippingMethod } from '@/lib/types'

const NG_STATES = [
  'Lagos', 'FCT — Abuja', 'Rivers', 'Oyo', 'Enugu', 'Kano', 'Akwa Ibom', 'Edo',
  'Kaduna', 'Ogun', 'Anambra', 'Delta', 'Abia', 'Imo', 'Plateau', 'Cross River',
]

/** Controlled field with a signed-in default that only fills an empty,
 *  untouched input — anything the customer has typed always wins. */
function usePrefillField(fallback: string) {
  const [value, setValue] = useState('')
  const [touched, setTouched] = useState(false)
  const set = (next: string) => {
    setTouched(true)
    setValue(next)
  }
  const displayed = touched || value !== '' ? value : fallback
  return [displayed, set] as const
}

export function CheckoutPage() {
  useEffect(() => {
    document.title = 'Checkout — Style Sence'
  }, [])

  const qc = useQueryClient()
  const { data: cart, isLoading } = useCart()
  const { data: customer } = useCustomer()
  const items = cart?.items ?? []

  const promoCode = usePromoStore((s) => s.code)
  const clearPromo = usePromoStore((s) => s.clear)

  // Signed-in customers get their saved details prefilled — but only into
  // fields that are still empty/untouched; guest checkout is untouched.
  const [email, setEmail] = usePrefillField(customer?.email ?? '')
  const [fullName, setFullName] = usePrefillField(customer?.name ?? '')
  const [phone, setPhone] = usePrefillField(customer?.phone ?? '')
  const [address, setAddress] = usePrefillField(customer?.defaultAddress ?? '')
  const [city, setCity] = usePrefillField(customer?.defaultCity ?? '')
  const [state, setState] = usePrefillField(
    customer?.defaultState && NG_STATES.includes(customer.defaultState) ? customer.defaultState : '',
  )
  const [notes, setNotes] = useState('')
  const [shipping, setShipping] = useState<ShippingMethod>('standard')
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // The checkout email participates in promo validation so single-use-per-customer
  // codes fail visibly here (the server re-checks authoritatively with this email).
  const { data: promoData } = usePromoValidation(promoCode, cart?.subtotal ?? 0, email)
  const promo = promoData?.promo

  const subtotal = cart?.subtotal ?? 0
  const discount = promo?.discount ?? 0

  /** Complimentary standard shipping over ₦150,000 (merchandise subtotal, pre-discount)
   *  — mirrors the server-side rule in /api/checkout and the cart-page promise. */
  const thresholdFree = subtotal >= FREE_SHIPPING_THRESHOLD && shipping === 'standard'
  const shippingPrice = promo?.freeShipping || thresholdFree ? 0 : SHIPPING_METHODS[shipping].price
  const total = subtotal === 0 ? 0 : subtotal - discount + shippingPrice

  const validate = (): boolean => {
    const e: Record<string, string> = {}
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = 'A valid email is required.'
    if (fullName.trim().length < 2) e.fullName = 'Your full name is required.'
    if (phone.trim().length < 7) e.phone = 'A reachable phone number is required.'
    if (address.trim().length < 5) e.address = 'Your street address is required.'
    if (city.trim().length < 2) e.city = 'Your city is required.'
    if (!state) e.state = 'Select your state.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const placeOrder = async () => {
    if (items.length === 0) {
      toast.error('Your bag is empty.')
      return navigate('/shop')
    }
    if (!validate()) {
      toast.error('Please review the highlighted fields.')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          fullName: fullName.trim(),
          phone: phone.trim(),
          address: address.trim(),
          city: city.trim(),
          state,
          notes: notes.trim() || undefined,
          shippingMethod: shipping,
          promoCode: promoCode ?? undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Checkout failed')
      toast.success(`Order ${data.order.orderNumber} placed.`)
      qc.invalidateQueries({ queryKey: ['cart'] })
      clearPromo()
      navigate(`/order/${data.order.orderNumber}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Checkout failed')
    } finally {
      setBusy(false)
    }
  }

  const fieldCls = (k: string) =>
    cn('h-11 border-line-strong bg-background focus-visible:ring-0', errors[k] && 'border-destructive')

  return (
    <div className="container-site py-10 sm:py-14">
      <Reveal>
        <p className="eyebrow">Nearly yours</p>
        <h1 className="mt-2 font-display text-4xl font-light tracking-tight sm:text-5xl">Checkout</h1>
      </Reveal>

      {isLoading ? (
        <div className="mt-10 animate-pulse" aria-busy>
          <div className="h-96 w-full bg-secondary" />
        </div>
      ) : items.length === 0 ? (
        <Reveal className="mt-10">
          <div className="flex flex-col items-center border border-dashed border-line-strong px-6 py-24 text-center">
            <p className="font-display text-3xl font-light italic">There is nothing to check out.</p>
            <Button
              className="mt-8 h-12 px-8 uppercase tracking-[0.2em] text-[0.66rem]"
              onClick={() => navigate('/shop')}
            >
              Shop the collection
            </Button>
          </div>
        </Reveal>
      ) : (
        <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_23rem] lg:gap-16">
          {/* ————— form ————— */}
          <div className="space-y-10">
            <section aria-label="Contact details">
              <h2 className="font-display text-xl tracking-tight">01 — Contact</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="ck-email" className="eyebrow">Email *</Label>
                  <Input
                    id="ck-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className={fieldCls('email')}
                    aria-invalid={!!errors.email}
                  />
                  {errors.email ? <p className="text-[0.7rem] text-destructive">{errors.email}</p> : null}
                  {customer ? (
                    <p className="text-[0.66rem] leading-relaxed text-muted-foreground">
                      Signed in as{' '}
                      <Link to="/account" className="link-underline font-medium text-foreground">
                        {customer.name}
                      </Link>{' '}
                      — your details are prefilled.
                    </p>
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ck-phone" className="eyebrow">Phone *</Label>
                  <Input
                    id="ck-phone"
                    type="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+234 801 234 5678"
                    className={fieldCls('phone')}
                    aria-invalid={!!errors.phone}
                  />
                  {errors.phone ? <p className="text-[0.7rem] text-destructive">{errors.phone}</p> : null}
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="ck-name" className="eyebrow">Full name *</Label>
                  <Input
                    id="ck-name"
                    autoComplete="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Adaeze Okonkwo"
                    className={fieldCls('fullName')}
                    aria-invalid={!!errors.fullName}
                  />
                  {errors.fullName ? <p className="text-[0.7rem] text-destructive">{errors.fullName}</p> : null}
                </div>
              </div>
            </section>

            <section aria-label="Shipping address">
              <h2 className="font-display text-xl tracking-tight">02 — Shipping address</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="ck-address" className="eyebrow">Street address *</Label>
                  <Input
                    id="ck-address"
                    autoComplete="street-address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="14A Awolowo Road, Ikoyi"
                    className={fieldCls('address')}
                    aria-invalid={!!errors.address}
                  />
                  {errors.address ? <p className="text-[0.7rem] text-destructive">{errors.address}</p> : null}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ck-city" className="eyebrow">City *</Label>
                  <Input
                    id="ck-city"
                    autoComplete="address-level2"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Lagos"
                    className={fieldCls('city')}
                    aria-invalid={!!errors.city}
                  />
                  {errors.city ? <p className="text-[0.7rem] text-destructive">{errors.city}</p> : null}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ck-state" className="eyebrow">State *</Label>
                  <select
                    id="ck-state"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className={cn(
                      'h-11 w-full rounded-[--radius] border border-line-strong bg-background px-3 text-sm focus:outline-none focus-visible:outline-2 focus-visible:outline-ring',
                      errors.state && 'border-destructive',
                    )}
                    aria-invalid={!!errors.state}
                  >
                    <option value="">Select state…</option>
                    {NG_STATES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  {errors.state ? <p className="text-[0.7rem] text-destructive">{errors.state}</p> : null}
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="ck-notes" className="eyebrow">Delivery notes (optional)</Label>
                  <Textarea
                    id="ck-notes"
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Gate code, preferred hours, gift note…"
                    className="border-line-strong"
                  />
                </div>
              </div>
            </section>

            <section aria-label="Delivery method">
              <h2 className="font-display text-xl tracking-tight">03 — Delivery</h2>
              <RadioGroup
                value={shipping}
                onValueChange={(v) => setShipping(v as ShippingMethod)}
                className="mt-4 grid gap-3 sm:grid-cols-2"
              >
                {(Object.keys(SHIPPING_METHODS) as ShippingMethod[]).map((key) => {
                  const m = SHIPPING_METHODS[key]
                  const methodFree = key === 'standard' && (promo?.freeShipping || thresholdFree)
                  return (
                    <Label
                      key={key}
                      className={cn(
                        'flex cursor-pointer items-start gap-3 border p-4 transition-colors',
                        shipping === key
                          ? 'border-foreground bg-secondary/60'
                          : 'border-line-strong hover:border-foreground',
                      )}
                    >
                      <RadioGroupItem value={key} className="mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-sm font-medium">{m.label}</span>
                          <span className={cn('font-mono text-sm tabular-nums', methodFree && 'text-espresso')}>
                            {methodFree ? 'Complimentary' : formatNaira(m.price)}
                          </span>
                        </div>
                        <p className="mt-1 text-[0.72rem] text-muted-foreground">
                          {m.eta} · {m.note}
                        </p>
                        {methodFree ? (
                          <p className="mt-1 text-[0.66rem] uppercase tracking-[0.14em] text-espresso">
                            Unlocked — orders over ₦150,000
                          </p>
                        ) : null}
                      </div>
                    </Label>
                  )
                })}
              </RadioGroup>
              <DevPlaceholder compact className="mt-3" title="Live rates">
                Courier rates are fixed dev values — live rate lookup pending.
              </DevPlaceholder>
            </section>

            <section aria-label="Payment">
              <h2 className="font-display text-xl tracking-tight">04 — Payment</h2>
              <div className="mt-4 border border-dashed border-espresso/45 bg-[color-mix(in_oklch,var(--espresso)_7%,transparent)] p-5">
                <div className="flex items-center gap-2.5">
                  <Lock className="h-4 w-4 text-espresso" strokeWidth={1.5} aria-hidden />
                  <p className="eyebrow !text-espresso !text-[0.6rem]">Dev placeholder — payment gateway</p>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Paystack / card capture is not connected in this environment. Placing the order
                  records it in the admin console <span className="font-medium text-foreground">without charging</span> —
                  exactly as a paid order would flow.
                </p>
              </div>
            </section>
          </div>

          {/* ————— summary ————— */}
          <aside className="lg:sticky lg:top-32 lg:self-start">
            <div className="border border-line bg-card">
              <div className="border-b border-line px-6 py-5">
                <p className="eyebrow">Your order</p>
                <p className="mt-1 font-mono text-[0.72rem] text-muted-foreground tabular-nums">
                  {cart?.itemCount ?? 0} items
                </p>
              </div>
              <ul className="scroll-elegant max-h-72 overflow-y-auto px-6 py-4">
                {items.map((item) => (
                  <li key={item.id} className="flex gap-3.5 py-3">
                    <ProductImage
                      src={item.product.primaryImage}
                      alt={item.product.name}
                      label={item.product.name}
                      ratio="aspect-[3/4]"
                      className="w-14 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-[0.9rem] leading-tight">{item.product.name}</p>
                      <p className="mt-0.5 text-[0.66rem] uppercase tracking-[0.12em] text-muted-foreground">
                        {item.variant.color} · {item.variant.size} · ×{item.qty}
                      </p>
                    </div>
                    <span className="font-mono text-[0.78rem] tabular-nums">
                      {formatNaira(item.product.price * item.qty)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="border-t border-line px-6 py-5">
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Subtotal</dt>
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
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">
                      {SHIPPING_METHODS[shipping].label}
                      {shippingPrice === 0 ? ' — complimentary' : ''}
                    </dt>
                    <dd className="font-mono tabular-nums">{formatNaira(shippingPrice)}</dd>
                  </div>
                </dl>
                <div className="mt-4 flex items-baseline justify-between border-t border-line pt-4">
                  <span className="font-display text-lg">Total</span>
                  <span className="font-mono text-xl font-medium tabular-nums">{formatNaira(total)}</span>
                </div>
                <Button
                  className="mt-5 h-12 w-full uppercase tracking-[0.2em] text-[0.66rem]"
                  disabled={busy}
                  onClick={placeOrder}
                >
                  {busy ? 'Placing order…' : 'Place order'}
                  <ArrowRight className="ml-2 h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
                </Button>
                <p className="mt-3 text-center text-[0.64rem] leading-relaxed text-muted-foreground/80">
                  By placing this order you agree to the terms — a dev placeholder, like
                  everything commercial here.
                </p>
              </div>
              <div className="px-6 pb-6">
                <PromoInput subtotal={subtotal} email={email} />
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
