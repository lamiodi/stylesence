'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Lock, ArrowRight } from 'lucide-react'
import { Link, navigate } from '@/lib/router'
import { cn } from '@/lib/utils'
import { formatNaira } from '@/lib/money'
import { useMoney } from '@/lib/store/currency'
import { deliveryZone, shippingError, zonePrice } from '@/lib/shipping'
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
import { PaystackMark } from '@/components/site/paystack-mark'
import { ForeignTransferBlock } from '@/components/site/foreign-transfer'
import {
  PRODUCTION_TIERS,
  SHIPPING_METHODS,
  formatMeasurements,
  type ProductionTier,
  type ShippingMethod,
} from '@/lib/types'
import {
  COUNTRY_NAMES,
  POPULAR_COUNTRIES,
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
  const { data: cart, isLoading, isError, refetch } = useCart()
  const { data: customer } = useCustomer()
  const items = cart?.items ?? []

  // Checkout idempotency — one attempt key per distinct bag. A retried submit
  // (double click, flaky network, a timeout that actually placed the order)
  // replays the same key so the server returns the first order instead of
  // creating a duplicate. Changing the bag (qty/lines, incl. a fresh bag
  // after a completed order) starts a new attempt.
  const cartSignature = items.map((i) => `${i.variant.id}:${i.qty}`).join('|')
  const idemRef = useRef({ sig: '', key: '' })
  if (idemRef.current.sig !== cartSignature) {
    idemRef.current = { sig: cartSignature, key: crypto.randomUUID() }
  }

  const promoCodes = usePromoStore((s) => s.codes)
  const clearPromo = usePromoStore((s) => s.clear)

  // Live payment rails — booleans only; the UI routes by country
  // (Paystack for African markets, Stripe everywhere else). A transient
  // failure here must never silently strand the customer on the
  // studio-confirmed rail — retry, and keep the previous data on refetch.
  const { data: payConfig, isPending: payConfigLoading } = useQuery({
    queryKey: ['pay-config'],
    queryFn: async () => {
      const res = await fetch('/api/checkout/pay-config')
      if (!res.ok) throw new Error('Payment config unavailable')
      return (await res.json()) as { paystack: boolean; stripe: boolean }
    },
    staleTime: 5 * 60_000,
    retry: 2,
    retryDelay: 1_500,
    placeholderData: (prev) => prev,
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
  // Display currency (estimates only) — the order itself is charged in naira.
  const { format, currency } = useMoney()
  const estimate = (naira: number) => (currency !== 'NGN' ? `≈ ${format(naira)}` : format(naira))
  const delivery = deliveryZone(country, state)
  const shipping: ShippingMethod = delivery?.method ?? (country === 'Nigeria' ? 'nationwide' : 'international')
  const [productionTier, setProductionTier] = useState<ProductionTier>('standard')
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const confirmRef = useRef<HTMLDivElement>(null)

  const provinces = provincesFor(country)

  /** Payment rails for the selected country: Paystack for the African markets
   *  it serves, Stripe for the rest — only when the gateway is live. Falls
   *  back to studio-confirmed payment when the country's gateway is not
   *  configured (Paystack is never offered outside its African markets;
   *  Stripe shows as a disabled "coming soon" option internationally). */
  const recommendedMethod: 'paystack' | 'stripe' | 'confirmed' = (() => {
    if (isPaystackCountry(country)) return payConfig?.paystack ? 'paystack' : 'confirmed'
    return payConfig?.stripe ? 'stripe' : 'confirmed'
  })()
  // Initialize from the CURRENT recommendation, not a hardcoded default: with
  // a cached pay-config the first render already knows the live rail —
  // starting on 'confirmed' left "pay after confirmation" silently selected
  // for returning visitors on a Paystack-ready checkout.
  const [paymentMethod, setPaymentMethod] = useState<'paystack' | 'stripe' | 'confirmed'>(() => recommendedMethod)
  // Keep the picked rail in step with the country's recommended rail —
  // adjusted during render (the React-endorsed pattern) rather than via a
  // cascading effect.
  const [prevRecommended, setPrevRecommended] = useState(recommendedMethod)
  if (prevRecommended !== recommendedMethod) {
    setPrevRecommended(recommendedMethod)
    setPaymentMethod(recommendedMethod)
  }
  // The submit button stays locked until the rails resolve — submitting on
  // the default would silently drop a customer onto the manual rail.
  const payOptionsPending = payConfigLoading && !payConfig

  /** Changing country invalidates a picked province — clear it whenever the
   *  new country's list (or lack of one) no longer contains it. The stale
   *  state error goes with it (free-text countries accept any value), and so
   *  does any delivery error — the destination it complained about is gone. */
  const changeCountry = (next: string) => {
    setCountry(next)
    const list = provincesFor(next)
    if (state && (!list || !list.includes(state))) setState('')
    setErrors((prev) => (prev.state || prev.shipping ? { ...prev, state: '', shipping: '' } : prev))
  }

  // Saved-customer prefill resolves asynchronously — a state saved for
  // Nigeria must not survive into a country whose list lacks it, or the
  // select shows "Select…" while validate() sees a ghost value.
  useEffect(() => {
    const list = provincesFor(country)
    if (state && list && !list.includes(state)) setState('')
  }, [country, state])

  // The checkout email participates in promo validation so single-use-per-customer
  // codes fail visibly here (the server re-checks authoritatively with this email).
  const { data: promoData } = usePromoValidation(promoCodes, cart?.subtotal ?? 0, email)
  const promos = promoData?.promos ?? []

  const subtotal = cart?.subtotal ?? 0
  const discount = promoData?.discount ?? 0

  /** Delivery fee for the picked method and bag size (server-authoritative mirror). */
  const pieces = items.reduce((sum, i) => sum + i.qty, 0)
  const shippingPrice = zonePrice(delivery, pieces)
  /** Express production add-on — 2–3 day production instead of standard 7–10. */
  const productionFee = PRODUCTION_TIERS[productionTier].fee
  const total = subtotal === 0 ? 0 : subtotal - discount + shippingPrice + productionFee

  /** Rail-specific submit label — the Paystack path says where you're going
   *  and what you'll pay; the manual path says what happens next. */
  const submitLabel =
    paymentMethod === 'paystack'
      ? `Continue to Paystack — ${formatNaira(total)}`
      : paymentMethod === 'stripe'
        ? `Continue to Stripe — ${formatNaira(total)}`
        : 'Place order — pay after confirmation'

  /** Single-field checks — shared by live blur validation and the submit pass. */
  const validateField = (key: string): string => {
    switch (key) {
      case 'email': return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? '' : 'A valid email is required.'
      case 'fullName': return fullName.trim().length >= 2 ? '' : 'Your full name is required.'
      case 'phone': return phone.trim().length >= 7 ? '' : 'A reachable phone number is required.'
      case 'address': return address.trim().length >= 5 ? '' : 'Your street address is required.'
      case 'city': return city.trim().length >= 2 ? '' : 'Your city is required.'
      case 'state': return state.trim().length >= 2 ? '' : (country === 'Nigeria' ? 'Select your state.' : 'Your state / region is required.')
      default: return ''
    }
  }

  /** Blur = a gentle check; typing clears the flag so a fixed answer stops
   *  flashing red before the next submit. */
  const checkField = (key: string) => {
    const msg = validateField(key)
    setErrors((prev) => (msg || prev[key] ? { ...prev, [key]: msg } : prev))
  }
  const clearError = (key: string) => {
    setErrors((prev) => (prev[key] ? { ...prev, [key]: '' } : prev))
  }

  /** Submission order — the first invalid field is focused and scrolled to. */
  const FIELD_ORDER = ['email', 'fullName', 'phone', 'address', 'city', 'state'] as const
  const FIELD_ID: Record<string, string> = {
    email: 'ck-email', fullName: 'ck-name', phone: 'ck-phone',
    address: 'ck-address', city: 'ck-city', state: 'ck-state',
  }

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {}
    for (const key of FIELD_ORDER) {
      const msg = validateField(key)
      if (msg) e[key] = msg
    }
    const deliveryError = shippingError(country, state, shipping)
    if (deliveryError) e.shipping = deliveryError
    // Round 13: production cannot start until the customer confirms their
    // measurements/details — the checkbox is mandatory before payment.
    if (!confirmed) {
      e.confirmedProduction = 'Please confirm your measurements and details before placing the order.'
    }
    return e
  }

  const placeOrder = async () => {
    if (busy || payOptionsPending) return
    if (items.length === 0) {
      toast.error('Your bag is empty.')
      return navigate('/shop')
    }
    const errs = validate()
    setErrors(errs)
    if (Object.keys(errs).length > 0) {
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const firstField = FIELD_ORDER.find((k) => errs[k])
      if (firstField) {
        const el = document.getElementById(FIELD_ID[firstField])
        el?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' })
        el?.focus({ preventScroll: true })
        toast.error('Please review the highlighted fields.')
      } else if (errs.confirmedProduction) {
        toast.error(errs.confirmedProduction)
        confirmRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' })
      } else {
        toast.error(errs.shipping ?? 'Please review the highlighted fields.')
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
          idempotencyKey: idemRef.current.key,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Checkout failed')
      qc.invalidateQueries({ queryKey: ['cart'] })
      clearPromo()
      // Live gateway — off to the hosted payment page, back to the order after.
      if (data.payment?.url) {
        toast.success(`Order ${data.order.orderNumber} placed — completing payment…`)
        window.location.assign(data.payment.url as string)
        return
      }
      if (data.replayed) {
        // The server recognized this attempt — the order already exists.
        toast('Your order was already placed — showing its latest status.')
      } else {
        if (data.payment?.note) toast(data.payment.note as string)
        toast.success(`Order ${data.order.orderNumber} placed.`)
      }
      navigate(`/order/${data.order.orderNumber}?email=${encodeURIComponent(email.trim())}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Checkout failed')
    } finally {
      setBusy(false)
    }
  }

  const fieldCls = (k: string) =>
    cn('h-11 border-line-strong bg-background text-base sm:text-sm focus-visible:ring-0', errors[k] && 'border-destructive')

  const selectCls = (k: string) =>
    cn(
      'h-11 w-full rounded-(--radius) border border-line-strong bg-background px-3 text-base sm:text-sm focus:outline-none focus-visible:outline-2 focus-visible:outline-ring',
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
      ) : isError ? (
        <Reveal className="mt-10">
          <div className="flex flex-col items-center border border-dashed border-line-strong px-6 py-24 text-center">
            <p className="font-display text-3xl font-light italic">Your bag could not be reached.</p>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
              This is on our side, not yours — nothing in your bag is lost. Try again in a moment.
            </p>
            <Button
              className="mt-8 h-12 px-8 uppercase tracking-[0.2em] text-[0.66rem]"
              onClick={() => refetch()}
            >
              Try again
            </Button>
          </div>
        </Reveal>
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
        <div className="mt-10 grid grid-cols-1 gap-12 lg:grid-cols-[1fr_23rem] lg:gap-16">
          {/* ————— form ————— */}
          <div className="min-w-0 space-y-10">
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
                    onChange={(e) => { setEmail(e.target.value); clearError('email') }}
                    onBlur={() => checkField('email')}
                    placeholder="you@example.com"
                    className={fieldCls('email')}
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? 'ck-email-err' : undefined}
                  />
                  {errors.email ? <p id="ck-email-err" className="text-[0.7rem] text-destructive">{errors.email}</p> : null}
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
                    onChange={(e) => { setPhone(e.target.value); clearError('phone') }}
                    onBlur={() => checkField('phone')}
                    placeholder={`${dialFor(country)} 801 234 5678`}
                    className={fieldCls('phone')}
                    aria-invalid={!!errors.phone}
                    aria-describedby={errors.phone ? 'ck-phone-err' : undefined}
                  />
                  {errors.phone ? <p id="ck-phone-err" className="text-[0.7rem] text-destructive">{errors.phone}</p> : null}
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="ck-name" className="eyebrow">Full name *</Label>
                  <Input
                    id="ck-name"
                    autoComplete="name"
                    value={fullName}
                    onChange={(e) => { setFullName(e.target.value); clearError('fullName') }}
                    onBlur={() => checkField('fullName')}
                    placeholder="Adaeze Okonkwo"
                    className={fieldCls('fullName')}
                    aria-invalid={!!errors.fullName}
                    aria-describedby={errors.fullName ? 'ck-name-err' : undefined}
                  />
                  {errors.fullName ? <p id="ck-name-err" className="text-[0.7rem] text-destructive">{errors.fullName}</p> : null}
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
                    onChange={(e) => { setAddress(e.target.value); clearError('address') }}
                    onBlur={() => checkField('address')}
                    placeholder="14A Awolowo Road, Ikoyi"
                    className={fieldCls('address')}
                    aria-invalid={!!errors.address}
                    aria-describedby={errors.address ? 'ck-address-err' : undefined}
                  />
                  {errors.address ? <p id="ck-address-err" className="text-[0.7rem] text-destructive">{errors.address}</p> : null}
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
                    <optgroup label="Frequent destinations">
                      {POPULAR_COUNTRIES.map((c) => (
                        <option key={`popular-${c}`} value={c}>{c}</option>
                      ))}
                    </optgroup>
                    <optgroup label="All countries">
                      {COUNTRY_NAMES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </optgroup>
                  </select>
                  <p className="text-[0.66rem] leading-relaxed text-muted-foreground">
                    Every country ships — the state / province list adapts to the country you pick.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ck-city" className="eyebrow">City *</Label>
                  <Input
                    id="ck-city"
                    autoComplete="address-level2"
                    value={city}
                    onChange={(e) => { setCity(e.target.value); clearError('city') }}
                    onBlur={() => checkField('city')}
                    placeholder="Lagos"
                    className={fieldCls('city')}
                    aria-invalid={!!errors.city}
                    aria-describedby={errors.city ? 'ck-city-err' : undefined}
                  />
                  {errors.city ? <p id="ck-city-err" className="text-[0.7rem] text-destructive">{errors.city}</p> : null}
                </div>
                <div className="space-y-1.5">
                  {provinces ? (
                    <>
                      <Label htmlFor="ck-state" className="eyebrow">State / Province *</Label>
                      <select
                        id="ck-state"
                        value={state}
                        onChange={(e) => { setState(e.target.value); clearError('state'); clearError('shipping') }}
                        onBlur={() => checkField('state')}
                        className={selectCls('state')}
                        aria-invalid={!!errors.state}
                        aria-describedby={errors.state ? 'ck-state-err' : undefined}
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
                        onChange={(e) => { setState(e.target.value); clearError('state'); clearError('shipping') }}
                        onBlur={() => checkField('state')}
                        placeholder="Province or region"
                        className={fieldCls('state')}
                        aria-invalid={!!errors.state}
                        aria-describedby={errors.state ? 'ck-state-err' : undefined}
                      />
                    </>
                  )}
                  {errors.state ? <p id="ck-state-err" className="text-[0.7rem] text-destructive">{errors.state}</p> : null}
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="ck-notes" className="eyebrow">
                    Delivery notes <span className="font-normal normal-case tracking-normal text-muted-foreground/70">· optional</span>
                  </Label>
                  <p className="text-[0.68rem] leading-relaxed text-muted-foreground">
                    Anything the courier or atelier should know — a gate code, preferred delivery
                    hours, a gift note. The studio sees this with your order, and it appears on
                    your receipt.
                  </p>
                  <Textarea
                    id="ck-notes"
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    maxLength={500}
                    placeholder="e.g. Call on arrival — gate 2, deliver after 4pm weekdays. This is a gift, please omit the invoice."
                    className="min-h-[88px] resize-y border-line-strong bg-background text-base sm:text-sm leading-relaxed"
                  />
                </div>
              </div>
            </section>

            <section aria-label="Delivery method">
              <h2 className="font-display text-xl tracking-tight">03 — Delivery</h2>
              <div className="mt-4 border border-line-strong p-4" aria-live="polite">
                {delivery ? <>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-medium">{SHIPPING_METHODS[shipping].label}</span>
                    <span className="font-mono text-sm tabular-nums">{estimate(shippingPrice)}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {delivery.label} · {delivery.eta} after dispatch
                    {shipping === 'international'
                      ? ` · ${pieces} piece${pieces === 1 ? '' : 's'} billed as ${pieces * 2}kg parcel weight`
                      : ''}
                  </p>
                </> : <p className="text-sm">{country === 'Nigeria' ? 'Select your state to see your flat delivery fee.' : 'Contact the studio for a delivery quote to this destination before ordering.'}</p>}
              </div>
              {errors.shipping ? <p role="alert" className="mt-2 text-xs text-destructive">{errors.shipping}</p> : null}
              <p className="mt-3 text-[0.72rem] leading-relaxed text-muted-foreground">
                Within Nigeria, one flat delivery fee per order. International parcels ship DHL
                Express, priced on chargeable weight — each piece counts as up to 2kg. A DHL
                tracking number is issued once payment is confirmed; import duties and taxes are
                paid by the recipient.
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
                          {key === 'express' ? (
                            <span className="font-mono text-[0.72rem] tabular-nums text-muted-foreground">
                              +{estimate(t.fee)}
                            </span>
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
                within 2–3 working days instead of the standard 7–10. The{' '}
                {formatNaira(PRODUCTION_TIERS.express.fee)} express fee is included in your
                order total and charged with payment.
              </p>
            </section>

            <section aria-label="Payment">
              <h2 className="font-display text-xl tracking-tight">05 — Payment method</h2>
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
              {payConfigLoading && !payConfig ? (
                <div className="mt-4 border border-espresso/30 bg-[color-mix(in_oklch,var(--espresso)_5%,transparent)] p-5">
                  <div className="flex items-center gap-2.5">
                    <Lock className="h-4 w-4 text-espresso" strokeWidth={1.5} aria-hidden />
                    <p className="eyebrow !text-espresso !text-[0.6rem] animate-pulse">
                      Preparing payment options…
                    </p>
                  </div>
                </div>
              ) : payConfig?.paystack || payConfig?.stripe || !isPaystackCountry(country) ? (
                <div className="mt-4 border border-espresso/30 bg-[color-mix(in_oklch,var(--espresso)_5%,transparent)] p-5">
                  <div className="flex items-center gap-2.5">
                    <Lock className="h-4 w-4 text-espresso" strokeWidth={1.5} aria-hidden />
                    <p className="eyebrow !text-espresso !text-[0.6rem]">
                      {isPaystackCountry(country)
                        ? payConfig?.paystack
                          ? 'Paystack — cards, bank transfer & USSD'
                          : 'Payment — confirmed by the studio'
                        : 'Card payment — Stripe · Coming soon'}
                    </p>
                    {isPaystackCountry(country) && payConfig?.paystack ? (
                      <PaystackMark className="ml-auto h-4 w-auto" aria-label="Paystack" />
                    ) : null}
                  </div>
                  <RadioGroup
                    value={paymentMethod}
                    onValueChange={(v) => setPaymentMethod(v as typeof paymentMethod)}
                    className="mt-3 gap-2.5"
                  >
                    {(payConfig?.paystack && isPaystackCountry(country)
                      ? [{ value: 'paystack', label: 'Pay now with Paystack', hint: 'Card, bank transfer or USSD · Charged in NGN', disabled: false }]
                      : []
                    )
                      .concat(
                        // Stripe is the international rail only — Paystack
                        // markets never see it, live or not.
                        !isPaystackCountry(country)
                          ? payConfig?.stripe
                            ? [{ value: 'stripe', label: 'Pay now by card (Stripe)', hint: 'International cards', disabled: false }]
                            : [{ value: 'stripe', label: 'Pay now by card (Stripe)', hint: 'Coming soon', disabled: true }]
                          : [],
                      )
                      .concat([
                        {
                          value: 'confirmed',
                          label: 'Order now, pay after studio confirmation',
                          hint: 'The studio will contact you with payment details. Production starts after payment.',
                          disabled: false,
                        },
                      ])
                      .map((opt) => (
                        <label
                          key={opt.value}
                          className={
                            opt.disabled
                              ? 'flex cursor-not-allowed items-center gap-3 border border-line bg-background px-3.5 py-3 opacity-55'
                              : 'flex cursor-pointer items-center gap-3 border border-line bg-background px-3.5 py-3 transition-colors hover:border-line-strong'
                          }
                        >
                          <RadioGroupItem value={opt.value} disabled={opt.disabled} />
                          <span className="min-w-0">
                            <span className="flex items-center gap-2">
                              <span className="text-sm font-medium leading-tight">{opt.label}</span>
                              {opt.value === 'paystack' && !opt.disabled ? (
                                <PaystackMark className="h-3.5 w-3.5" ariaLabel="" />
                              ) : null}
                            </span>
                            <span className="mt-0.5 block text-[0.72rem] text-muted-foreground">{opt.hint}</span>
                          </span>
                        </label>
                      ))}
                  </RadioGroup>
                  {paymentMethod !== 'confirmed' ? (
                    <p className="mt-3 text-[0.72rem] leading-relaxed text-muted-foreground">
                      Secure hosted payment — you are redirected to{' '}
                      {paymentMethod === 'paystack' ? 'Paystack' : 'Stripe'} to complete payment, then returned here.{' '}
                      <span className="font-medium text-foreground">Production begins the moment payment lands.</span>
                    </p>
                  ) : isPaystackCountry(country) ? (
                    <p className="mt-3 text-[0.72rem] leading-relaxed text-muted-foreground">
                      The studio will contact you with payment details.{' '}
                      <span className="font-medium text-foreground">Production starts after payment.</span>
                    </p>
                  ) : (
                    <p className="mt-3 text-[0.72rem] leading-relaxed text-muted-foreground">
                      Card payments via Stripe are coming soon.{' '}
                      <span className="font-medium text-foreground">Production begins the moment payment lands.</span>
                    </p>
                  )}
                  {!isPaystackCountry(country) ? (
                    <div className="mt-3 border-t border-espresso/20 pt-3">
                      <ForeignTransferBlock compact />
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="mt-4 border border-espresso/30 bg-[color-mix(in_oklch,var(--espresso)_5%,transparent)] p-5">
                  <div className="flex items-center gap-2.5">
                    <Lock className="h-4 w-4 text-espresso" strokeWidth={1.5} aria-hidden />
                    <p className="eyebrow !text-espresso !text-[0.6rem]">Payment — confirmed by the studio</p>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Place your order and the studio will contact you with payment details — bank
                    transfer or card link. Nothing is charged automatically, and{' '}
                    <span className="font-medium text-foreground">production starts after payment</span>.
                    Need to talk it through first? WhatsApp{' '}
                    <span className="font-medium text-foreground">+234 816 302 2233</span>.
                  </p>
                </div>
              )}
            </section>
          </div>

          {/* ————— summary ————— */}
          <aside className="min-w-0 lg:sticky lg:top-32 lg:self-start">
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
                      {estimate(item.product.price * item.qty)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="border-t border-line px-6 py-5">
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Subtotal</dt>
                    <dd className="font-mono tabular-nums">{estimate(subtotal)}</dd>
                  </div>
                  {promos
                    .filter((p) => p.discount > 0)
                    .map((p) => (
                      <div key={`money-${p.code}`} className="flex justify-between text-espresso">
                        <dt className="flex items-center gap-1.5">
                          <span className="h-[3px] w-[3px] rounded-full bg-espresso" aria-hidden />
                          {p.code}
                        </dt>
                        <dd className="font-mono tabular-nums">−{estimate(p.discount)}</dd>
                      </div>
                    ))}
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">
                      {SHIPPING_METHODS[shipping].label}
                    </dt>
                    <dd className="font-mono tabular-nums">{delivery ? estimate(shippingPrice) : 'Select destination'}</dd>
                  </div>
                  {productionFee > 0 ? (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Express production</dt>
                      <dd className="font-mono tabular-nums">+{estimate(productionFee)}</dd>
                    </div>
                  ) : null}
                </dl>
                <div className="mt-4 border-t border-line pt-4">
                  <div className="flex items-baseline justify-between">
                    <span className="font-display text-lg">Total</span>
                    <span className="text-right">
                      <span className="block font-mono text-xl font-medium tabular-nums">{delivery ? formatNaira(total) : 'Select destination'}</span>
                      {delivery && currency !== 'NGN' ? (
                        <span className="block font-mono text-[0.72rem] text-muted-foreground tabular-nums">≈ {format(total)}</span>
                      ) : null}
                    </span>
                  </div>
                  {currency !== 'NGN' ? (
                    <p className="mt-2 text-[0.68rem] leading-relaxed text-muted-foreground">
                      Figures in {currency} are estimates at the studio&apos;s rate — you will be
                      charged in Nigerian Naira (₦).
                    </p>
                  ) : null}
                </div>
                <Button
                  className="mt-5 h-12 w-full uppercase tracking-[0.2em] text-[0.66rem]"
                  disabled={busy || !delivery || payOptionsPending}
                  onClick={placeOrder}
                >
                  {busy ? 'Placing order…' : payOptionsPending ? 'Preparing payment options…' : submitLabel}
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
