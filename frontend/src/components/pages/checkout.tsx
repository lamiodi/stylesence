'use client'

import { useEffect, useRef, useState } from 'react'
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
import { Checkbox } from '@/components/ui/checkbox'
import { ProductImage } from '@/components/site/price'
import { Reveal } from '@/components/site/reveal'
import { useCart } from '@/lib/cart-client'
import { useCustomer } from '@/hooks/use-customer'
import { usePromoStore } from '@/lib/store/promo'
import { PromoInput, usePromoValidation } from '@/components/site/promo-box'
import { FREE_SHIPPING_THRESHOLD } from '@/components/site/shipping-meter'
import {
  PRODUCTION_TIERS,
  SHIPPING_METHODS,
  formatMeasurements,
  type ProductionTier,
  type ShippingMethod,
} from '@/lib/types'
import {
  COUNTRY_NAMES,
  dialFor,
  isPaystackCountry,
  provincesFor,
} from '@/lib/geo'

/** Round 13 delivery destinations. Nigeria unlocks the local + nationwide
 *  couriers; every other country is international-only (server-enforced).
 *  Countries + provinces come from @/lib/geo (Paystack Africa / Stripe intl). */

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

  const promoCodes = usePromoStore((s) => s.codes)
  const clearPromo = usePromoStore((s) => s.clear)

  // Live payment rails — booleans only; the UI routes by country
  // (Paystack for African markets, Stripe everywhere else).
  const { data: payConfig } = useQuery({
    queryKey: ['pay-config'],
    queryFn: async () => {
      const res = await fetch('/api/checkout/pay-config')
      if (!res.ok) throw new Error('Payment config unavailable')
      return (await res.json()) as { paystack: boolean; stripe: boolean }
    },
    staleTime: 5 * 60_000,
    retry: false,
  })

  // Signed-in customers get their saved details prefilled — but only into
  // fields that are still empty/untouched; guest checkout is untouched.
  const [email, setEmail] = usePrefillField(customer?.email ?? '')
  const [fullName, setFullName] = usePrefillField(customer?.name ?? '')
  const [phone, setPhone] = usePrefillField(customer?.phone ?? '')
  const [address, setAddress] = usePrefillField(customer?.defaultAddress ?? '')
  const [city, setCity] = usePrefillField(customer?.defaultCity ?? '')
  const [state, setState] = usePrefillField(
    customer?.defaultState && (provincesFor('Nigeria') ?? []).includes(customer.defaultState)
      ? customer.defaultState
      : '',
  )
  const [country, setCountry] = useState('Nigeria')
  const [notes, setNotes] = useState('')
  const [shipping, setShipping] = useState<ShippingMethod>('nationwide')
  const [productionTier, setProductionTier] = useState<ProductionTier>('standard')
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const confirmRef = useRef<HTMLDivElement>(null)

  const provinces = provincesFor(country)

  /** Payment rails for the selected country: Paystack for the African markets
   *  it serves, Stripe for the rest — only when the gateway is live. Falls
   *  back to studio-confirmed payment when neither is configured. */
  const recommendedMethod: 'paystack' | 'stripe' | 'confirmed' = (() => {
    if (isPaystackCountry(country) && payConfig?.paystack) return 'paystack'
    if (!isPaystackCountry(country) && payConfig?.stripe) return 'stripe'
    if (isPaystackCountry(country) && payConfig?.stripe && !payConfig?.paystack) return 'stripe'
    if (!isPaystackCountry(country) && payConfig?.paystack && !payConfig?.stripe) return 'paystack'
    return 'confirmed'
  })()
  const [paymentMethod, setPaymentMethod] = useState<'paystack' | 'stripe' | 'confirmed'>('confirmed')
  useEffect(() => {
    setPaymentMethod(recommendedMethod)
  }, [recommendedMethod])

  /** Changing country invalidates a picked province — clear it when the new
   *  country has its own list and the current value is not on it. */
  const changeCountry = (next: string) => {
    setCountry(next)
    const list = provincesFor(next)
    if (list && state && !list.includes(state)) setState('')
  }

  /** Round 13 geo rules, mirrored client-side (the server rejects mismatches
   *  with a 400): local is Lagos metro only, nationwide is Nigeria-only,
   *  international ships everywhere. */
  const methodEnabled = (key: ShippingMethod) =>
    key === 'international' || (country === 'Nigeria' && (key === 'nationwide' || state === 'Lagos'))

  const disabledNote = (key: ShippingMethod): string | null =>
    key === 'local' ? 'Lagos metro only — select Lagos as your state'
      : key === 'nationwide' ? 'Within Nigeria only'
        : null

  // Keep the delivery selection valid as the address context changes — in
  // lockstep with the disabled cards below and the server's geo rules.
  useEffect(() => {
    if (country !== 'Nigeria' && shipping !== 'international') {
      setShipping('international')
    } else if (country === 'Nigeria' && shipping === 'local' && state !== 'Lagos') {
      setShipping('nationwide')
    }
  }, [country, state, shipping])

  // The checkout email participates in promo validation so single-use-per-customer
  // codes fail visibly here (the server re-checks authoritatively with this email).
  const { data: promoData } = usePromoValidation(promoCodes, cart?.subtotal ?? 0, email)
  const promos = promoData?.promos ?? []

  const subtotal = cart?.subtotal ?? 0
  const discount = promoData?.discount ?? 0
  const stackFreeShipping = promoData?.freeShipping ?? false

  /** Complimentary nationwide shipping over ₦150,000 (merchandise subtotal,
   *  pre-discount) — mirrors the server rule in /api/checkout; a free-shipping
   *  promo waives EVERY method (including international). */
  const thresholdFree = subtotal >= FREE_SHIPPING_THRESHOLD && shipping === 'nationwide'
  const shippingPrice = stackFreeShipping || thresholdFree ? 0 : SHIPPING_METHODS[shipping].price
  /** Express production add-on — 2–3 day production instead of standard 7–10. */
  const productionFee = PRODUCTION_TIERS[productionTier].fee
  const total = subtotal === 0 ? 0 : subtotal - discount + shippingPrice + productionFee

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {}
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = 'A valid email is required.'
    if (fullName.trim().length < 2) e.fullName = 'Your full name is required.'
    if (phone.trim().length < 7) e.phone = 'A reachable phone number is required.'
    if (address.trim().length < 5) e.address = 'Your street address is required.'
    if (city.trim().length < 2) e.city = 'Your city is required.'
    if (state.trim().length < 2) {
      e.state = country === 'Nigeria' ? 'Select your state.' : 'Your state / region is required.'
    }
    // Round 13: production cannot start until the customer confirms their
    // measurements/details — the checkbox is mandatory before payment.
    if (!confirmed) {
      e.confirmedProduction = 'Please confirm your measurements and details before placing the order.'
    }
    return e
  }

  const placeOrder = async () => {
    if (items.length === 0) {
      toast.error('Your bag is empty.')
      return navigate('/shop')
    }
    const errs = validate()
    setErrors(errs)
    if (Object.keys(errs).length > 0) {
      if (errs.confirmedProduction) {
        toast.error(errs.confirmedProduction)
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        confirmRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' })
      } else {
        toast.error('Please review the highlighted fields.')
      }
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
          state: state.trim(),
          country,
          notes: notes.trim() || undefined,
          shippingMethod: shipping,
          productionTier,
          confirmedProduction: true,
          paymentMethod,
          promoCodes: promoCodes.length > 0 ? promoCodes : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Checkout failed')
      qc.invalidateQueries({ queryKey: ['cart'] })
      clearPromo()
      // Live gateway — off to the hosted payment page, back to the order after.
      if (data.payment?.url) {
        toast.success(`Order ${data.order.orderNumber} placed — completing payment…`)
        window.location.href = data.payment.url as string
        return
      }
      if (data.payment?.note) toast(data.payment.note as string)
      toast.success(`Order ${data.order.orderNumber} placed.`)
      navigate(`/order/${data.order.orderNumber}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Checkout failed')
    } finally {
      setBusy(false)
    }
  }

  const fieldCls = (k: string) =>
    cn('h-11 border-line-strong bg-background focus-visible:ring-0', errors[k] && 'border-destructive')

  const selectCls = (k: string) =>
    cn(
      'h-11 w-full rounded-[--radius] border border-line-strong bg-background px-3 text-sm focus:outline-none focus-visible:outline-2 focus-visible:outline-ring',
      errors[k] && 'border-destructive',
    )

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
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="ck-country" className="eyebrow">Country *</Label>
                  <select
                    id="ck-country"
                    value={country}
                    onChange={(e) => changeCountry(e.target.value)}
                    autoComplete="country-name"
                    className={selectCls('country')}
                  >
                    {COUNTRY_NAMES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
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
                  {provinces ? (
                    <>
                      <Label htmlFor="ck-state" className="eyebrow">State / Province *</Label>
                      <select
                        id="ck-state"
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                        className={selectCls('state')}
                        aria-invalid={!!errors.state}
                      >
                        <option value="">Select…</option>
                        {provinces.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </>
                  ) : (
                    <>
                      <Label htmlFor="ck-state" className="eyebrow">State / Region *</Label>
                      <Input
                        id="ck-state"
                        autoComplete="address-level1"
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                        placeholder="Province or region"
                        className={fieldCls('state')}
                        aria-invalid={!!errors.state}
                      />
                    </>
                  )}
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
                  const enabled = methodEnabled(key)
                  const note = disabledNote(key)
                  // A shipping promo waives EVERY method (mirrors the server rule);
                  // the ₦150k threshold only unlocks nationwide. Disabled cards stay
                  // priced but never claim the complimentary unlock.
                  const methodFree =
                    enabled && (stackFreeShipping || (key === 'nationwide' && subtotal >= FREE_SHIPPING_THRESHOLD))
                  return (
                    <Label
                      key={key}
                      className={cn(
                        'flex items-start gap-3 border p-4 transition-colors',
                        enabled
                          ? cn(
                              'cursor-pointer',
                              shipping === key
                                ? 'border-foreground bg-secondary/60'
                                : 'border-line-strong hover:border-foreground',
                            )
                          : 'cursor-not-allowed border-line-strong opacity-50',
                      )}
                    >
                      <RadioGroupItem value={key} disabled={!enabled} className="mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-sm font-medium">{m.label}</span>
                          <span className={cn('font-mono text-sm tabular-nums', methodFree && 'text-espresso')}>
                            {methodFree ? 'Complimentary' : formatNaira(m.price)}
                          </span>
                        </div>
                        <p className="mt-1 text-[0.72rem] text-muted-foreground">
                          {key === 'international'
                            ? `${m.eta} · Door-to-door international courier`
                            : `${m.eta} · ${m.note}`}
                        </p>
                        {key === 'international' ? (
                          <p className="mt-1 text-[0.66rem] text-espresso">
                            Duties and taxes handled at the door on arrival.
                          </p>
                        ) : null}
                        {note ? (
                          <p className="mt-1 text-[0.7rem] font-medium text-foreground">{note}</p>
                        ) : null}
                        {methodFree ? (
                          <p className="mt-1 text-[0.66rem] uppercase tracking-[0.14em] text-espresso">
                            {stackFreeShipping
                              ? 'Unlocked — your code covers delivery'
                              : 'Unlocked — orders over ₦150,000'}
                          </p>
                        ) : null}
                      </div>
                    </Label>
                  )
                })}
              </RadioGroup>
              <p className="mt-3 text-[0.72rem] leading-relaxed text-muted-foreground">
                Rates shown cover insured nationwide courier delivery, and are confirmed
                with your order summary before dispatch.
              </p>
            </section>

            <section aria-label="Production timeline">
              <h2 className="font-display text-xl tracking-tight">04 — Production</h2>
              <p className="mt-1.5 text-[0.72rem] leading-relaxed text-muted-foreground">
                Every piece is cut to order in the Lagos atelier — choose how soon yours moves through production.
              </p>
              <RadioGroup
                value={productionTier}
                onValueChange={(v) => setProductionTier(v as ProductionTier)}
                className="mt-4 grid gap-3 sm:grid-cols-2"
              >
                {(Object.keys(PRODUCTION_TIERS) as ProductionTier[]).map((key) => {
                  const t = PRODUCTION_TIERS[key]
                  return (
                    <Label
                      key={key}
                      className={cn(
                        'flex cursor-pointer items-start gap-3 border p-4 transition-colors',
                        productionTier === key
                          ? 'border-foreground bg-secondary/60'
                          : 'border-line-strong hover:border-foreground',
                      )}
                    >
                      <RadioGroupItem value={key} className="mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-sm font-medium">{t.label}</span>
                          {t.fee > 0 ? (
                            <span className="font-mono text-sm tabular-nums">+{formatNaira(t.fee)}</span>
                          ) : (
                            <span className="text-[0.8rem] text-muted-foreground">Included</span>
                          )}
                        </div>
                        <p className="mt-1 text-[0.72rem] text-muted-foreground">{t.eta}</p>
                      </div>
                    </Label>
                  )
                })}
              </RadioGroup>
              <p className="mt-3 text-[0.72rem] leading-relaxed text-muted-foreground">
                Express moves your piece to the front of the cutting queue — production
                within 2–3 working days instead of the standard 7–10.
              </p>
            </section>

            <section aria-label="Payment">
              <h2 className="font-display text-xl tracking-tight">05 — Payment</h2>
              {/* Round 13 pre-production confirmation — mandatory before payment. */}
              <div
                ref={confirmRef}
                className={cn(
                  'mt-4 border bg-secondary/50 p-4',
                  errors.confirmedProduction ? 'border-destructive' : 'border-line',
                )}
              >
                <div className="flex items-start gap-3.5">
                  <Checkbox
                    id="ck-confirm"
                    checked={confirmed}
                    onCheckedChange={(v) => {
                      const next = v === true
                      setConfirmed(next)
                      if (next) {
                        setErrors((prev) => {
                          if (!prev.confirmedProduction) return prev
                          const copy = { ...prev }
                          delete copy.confirmedProduction
                          return copy
                        })
                      }
                    }}
                    aria-invalid={!!errors.confirmedProduction}
                    /* 44px touch target — the invisible hit area extends 14px
                     * around the 16px checkbox box. */
                    className="relative mt-0.5 before:absolute before:-inset-[0.875rem] before:content-['']"
                  />
                  <Label htmlFor="ck-confirm" className="cursor-pointer text-sm leading-relaxed">
                    I confirm that my measurements/details are correct. Production will begin once payment is completed.
                  </Label>
                </div>
                {errors.confirmedProduction ? (
                  <p className="mt-2.5 text-[0.7rem] text-destructive" role="alert">
                    {errors.confirmedProduction}
                  </p>
                ) : null}
              </div>
              {payConfig?.paystack || payConfig?.stripe ? (
                <div className="mt-4 border border-espresso/30 bg-[color-mix(in_oklch,var(--espresso)_5%,transparent)] p-5">
                  <div className="flex items-center gap-2.5">
                    <Lock className="h-4 w-4 text-espresso" strokeWidth={1.5} aria-hidden />
                    <p className="eyebrow !text-espresso !text-[0.6rem]">
                      {isPaystackCountry(country) ? 'Paystack — cards, bank transfer & USSD' : 'Card payment — Stripe'}
                    </p>
                  </div>
                  <RadioGroup
                    value={paymentMethod}
                    onValueChange={(v) => setPaymentMethod(v as typeof paymentMethod)}
                    className="mt-3 gap-2.5"
                  >
                    {(payConfig?.paystack && isPaystackCountry(country)
                      ? [{ value: 'paystack', label: 'Pay now with Paystack', hint: 'Card, bank transfer, USSD — Naira' }]
                      : []
                    )
                      .concat(
                        payConfig?.stripe
                          ? [{ value: 'stripe', label: 'Pay now by card (Stripe)', hint: 'International cards' }]
                          : [],
                      )
                      .concat([
                        { value: 'confirmed', label: 'Pay on confirmation', hint: 'The studio sends payment details' },
                      ])
                      .map((opt) => (
                        <label
                          key={opt.value}
                          className="flex cursor-pointer items-center gap-3 border border-line bg-background px-3.5 py-3 transition-colors hover:border-line-strong"
                        >
                          <RadioGroupItem value={opt.value} />
                          <span className="min-w-0">
                            <span className="block text-sm font-medium leading-tight">{opt.label}</span>
                            <span className="mt-0.5 block text-[0.72rem] text-muted-foreground">{opt.hint}</span>
                          </span>
                        </label>
                      ))}
                  </RadioGroup>
                  <p className="mt-3 text-[0.72rem] leading-relaxed text-muted-foreground">
                    Secure hosted payment — you are redirected to{' '}
                    {paymentMethod === 'paystack' ? 'Paystack' : 'Stripe'} to complete payment, then returned here.{' '}
                    <span className="font-medium text-foreground">Production begins the moment payment lands.</span>
                  </p>
                </div>
              ) : (
                <div className="mt-4 border border-espresso/30 bg-[color-mix(in_oklch,var(--espresso)_5%,transparent)] p-5">
                  <div className="flex items-center gap-2.5">
                    <Lock className="h-4 w-4 text-espresso" strokeWidth={1.5} aria-hidden />
                    <p className="eyebrow !text-espresso !text-[0.6rem]">Payment — confirmed by the studio</p>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Place your order and the studio sends payment details — bank transfer or
                    card link — with your confirmation. Nothing is charged automatically, and{' '}
                    <span className="font-medium text-foreground">production begins the moment
                    payment lands</span>. Need to talk it through first? WhatsApp{' '}
                    <span className="font-medium text-foreground">+234 816 302 2233</span>.
                  </p>
                </div>
              )}
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
                      {item.sizeMode === 'custom' ? (
                        <div className="mt-1 space-y-0.5">
                          <p className="inline-flex items-center border border-espresso/35 px-1.5 py-px font-mono text-[0.6rem] uppercase tracking-[0.14em] text-espresso">
                            Custom fit
                          </p>
                          {item.customMeasurements ? (
                            <p className="truncate font-mono text-[0.62rem] tabular-nums text-muted-foreground">
                              {formatMeasurements(item.customMeasurements)}
                            </p>
                          ) : null}
                          {item.notes ? (
                            <p className="truncate text-[0.62rem] italic text-muted-foreground">
                              “{item.notes}”
                            </p>
                          ) : null}
                        </div>
                      ) : null}
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
                  {promos
                    .filter((p) => p.discount > 0)
                    .map((p) => (
                      <div key={`money-${p.code}`} className="flex justify-between text-espresso">
                        <dt className="flex items-center gap-1.5">
                          <span className="h-[3px] w-[3px] rounded-full bg-espresso" aria-hidden />
                          {p.code}
                        </dt>
                        <dd className="font-mono tabular-nums">−{formatNaira(p.discount)}</dd>
                      </div>
                    ))}
                  {promos
                    .filter((p) => p.freeShipping)
                    .map((p) => (
                      <div key={`ship-${p.code}`} className="flex justify-between text-espresso">
                        <dt className="flex items-center gap-1.5">
                          <span className="h-[3px] w-[3px] rounded-full bg-espresso" aria-hidden />
                          {p.code}
                        </dt>
                        <dd>Complimentary</dd>
                      </div>
                    ))}
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">
                      {SHIPPING_METHODS[shipping].label}
                      {shippingPrice === 0 ? ' — complimentary' : ''}
                    </dt>
                    <dd className="font-mono tabular-nums">{formatNaira(shippingPrice)}</dd>
                  </div>
                  {productionFee > 0 ? (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Express production</dt>
                      <dd className="font-mono tabular-nums">+{formatNaira(productionFee)}</dd>
                    </div>
                  ) : null}
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
                  By placing this order you agree to our made-to-order terms — production
                  begins once payment is confirmed, and custom-measured pieces are yours
                  alone.
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
