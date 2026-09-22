'use client'

/**
 * #/account — customer accounts (email + password).
 *
 * Signed out: an editorial split — the sign-in form on the left, the benefits
 * panel with the register form on the right (`?mode=signup` leads with the
 * register column). Signed in: the account overview — profile & default
 * shipping details (editable; they prefill checkout), order history in the
 * track-order row language, and a wishlist preview.
 *
 * `?mode=forgot` / `?mode=reset&token=…` are the password-reset flow — when
 * transactional email is not configured the API returns a devResetUrl the
 * storefront offers as a direct reset link.
 */

import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowRight, Check, Heart, Package, Truck } from 'lucide-react'
import { Link, navigate, useRoute } from '@/lib/router'
import { cn } from '@/lib/utils'
import { formatDate, formatDateShort, formatNaira } from '@/lib/money'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { ProductImage } from '@/components/site/price'
import { Reveal } from '@/components/site/reveal'
import { useWishlist } from '@/lib/store/wishlist'
import { useMounted } from '@/hooks/use-mounted'
import {
  useCustomer,
  useCustomerLogin,
  useCustomerLogout,
  useCustomerRegister,
  useUpdateCustomerProfile,
} from '@/hooks/use-customer'
import type { CustomerOrderSummary, CustomerView } from '@/lib/types'

/* ——— constants ——— */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const NG_STATES = [
  'Lagos', 'FCT — Abuja', 'Rivers', 'Oyo', 'Enugu', 'Kano', 'Akwa Ibom', 'Edo',
  'Kaduna', 'Ogun', 'Anambra', 'Delta', 'Abia', 'Imo', 'Plateau', 'Cross River',
]

const STATUS_LABELS: Record<string, string> = {
  PAID: 'Order placed',
  PROCESSING: 'In the atelier',
  SHIPPED: 'On its way',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
}

const STATUS_STYLES: Record<string, string> = {
  DELIVERED: 'border-espresso/50 text-espresso',
  CANCELLED: 'border-destructive/45 text-destructive',
}

const fieldCls =
  'h-12 border-line-strong bg-background text-sm placeholder:text-muted-foreground/60 focus-visible:ring-0'

/* ——— password reset — API fetchers (falls back to a direct reset link when
   transactional email is not configured) ——— */

async function requestResetLink(input: { email: string }): Promise<{ devResetUrl: string | null }> {
  const res = await fetch('/api/customer/password-reset/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const body = (await res.json().catch(() => ({}))) as { ok?: boolean; devResetUrl?: string; error?: string }
  if (!res.ok) throw new Error(body.error ?? 'Something went wrong')
  return { devResetUrl: body.devResetUrl ?? null }
}

async function confirmPasswordReset(input: { token: string; password: string }): Promise<void> {
  const res = await fetch('/api/customer/password-reset/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
  if (!res.ok) throw new Error(body.error ?? 'Something went wrong')
}

/* ——— page ——— */

export function AccountPage() {
  const route = useRoute()
  const mode = route.query.get('mode') ?? ''

  useEffect(() => {
    document.title =
      mode === 'forgot'
        ? 'Reset password — Style Sence'
        : mode === 'reset'
          ? 'Choose a new password — Style Sence'
          : 'Your account — Style Sence'
  }, [mode])

  const { data: customer, isPending, isFetching } = useCustomer()
  // During a post-login refetch the cached profile is still null — hold the
  // skeleton so the sign-in form never flashes between states.
  const resolving = isPending || (customer === null && isFetching)

  // The password-reset modes render for everyone, signed-in included — a
  // reset link must work wherever it is opened (and completing one signs out
  // every device anyway). They don't depend on the profile query, so there is
  // no skeleton gate: the form is usable the moment the page mounts.
  if (mode === 'forgot') {
    return (
      <div className="container-site py-12 sm:py-16">
        <ResetRequestView />
      </div>
    )
  }
  if (mode === 'reset') {
    return (
      <div className="container-site py-12 sm:py-16">
        <ResetConfirmView token={route.query.get('token') ?? ''} />
      </div>
    )
  }

  return (
    <div className="container-site py-12 sm:py-16">
      {resolving ? <AccountSkeleton /> : customer ? <AccountOverview customer={customer} /> : <SignedOut />}
    </div>
  )
}

function AccountSkeleton() {
  return (
    <div className="animate-pulse" aria-busy="true">
      <Skeleton className="h-4 w-24 bg-secondary" />
      <Skeleton className="mt-4 h-12 w-72 bg-secondary" />
      <div className="mt-12 grid gap-10 lg:grid-cols-[26rem_minmax(0,1fr)]">
        <div className="space-y-8">
          <Skeleton className="h-96 w-full bg-secondary" />
          <Skeleton className="h-44 w-full bg-secondary" />
        </div>
        <Skeleton className="h-96 w-full bg-secondary" />
      </div>
      <p className="sr-only">Loading your account…</p>
    </div>
  )
}

/* ——— signed out ——— */

function SignedOut() {
  const route = useRoute()
  const signup = route.query.get('mode') === 'signup'

  return (
    <div>
      <Reveal>
        <p className="eyebrow">Your account</p>
        <h1 className="mt-3 font-display text-4xl font-light tracking-tight text-balance sm:text-5xl">
          {signup ? 'Create your account' : 'Sign in'}
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Orders, saved details and your wishlist — gathered in one quiet place.
          Checkout stays open to guests, always.
        </p>
      </Reveal>

      <div className="mt-10 grid gap-12 lg:grid-cols-2 lg:gap-16">
        <Reveal className={cn(signup && 'order-2')} delay={0.05}>
          <SignInForm />
        </Reveal>
        <Reveal className={cn(signup && 'order-1')} delay={0.1}>
          <BenefitsPanel />
          <RegisterForm />
        </Reveal>
      </div>
    </div>
  )
}

function SignInForm() {
  const login = useCustomerLogin()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const serverError =
    login.isError && login.error instanceof Error ? login.error.message : null
  const error = formError ?? serverError
  const busy = login.isPending

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const nextEmail = email.trim().toLowerCase()
    if (!EMAIL_PATTERN.test(nextEmail) || password.length < 1) {
      setFormError('Enter your email address and password to sign in.')
      return
    }
    setFormError(null)
    login.mutate(
      { email: nextEmail, password },
      {
        onSuccess: () => {
          toast.success('Welcome back.')
          navigate('/account')
        },
      },
    )
  }

  return (
    <section aria-label="Sign in" className="border border-line bg-card p-6 sm:p-8">
      <p className="eyebrow">Sign in</p>
      <h2 className="mt-2 font-display text-2xl font-light tracking-tight">Welcome back</h2>

      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="si-email" className="eyebrow">Email</Label>
          <Input
            id="si-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              login.reset()
            }}
            placeholder="you@example.com"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'si-error' : undefined}
            className={fieldCls}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="si-password" className="eyebrow">Password</Label>
          <Input
            id="si-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              login.reset()
            }}
            placeholder="Your password"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'si-error' : undefined}
            className={fieldCls}
          />
          <div className="flex justify-end">
            <Link
              to="/account?mode=forgot"
              className="link-underline inline-flex min-h-11 items-center text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
            >
              Forgot your password?
            </Link>
          </div>
        </div>

        {error ? (
          <p
            id="si-error"
            role="alert"
            className="border border-destructive/40 bg-[color-mix(in_oklch,var(--destructive)_7%,transparent)] px-4 py-3 text-xs leading-relaxed text-destructive"
          >
            {error}
          </p>
        ) : null}

        <Button type="submit" disabled={busy} className="h-12 w-full uppercase tracking-[0.2em] text-[0.66rem]">
          {busy ? 'Signing in…' : 'Sign in'}
          <ArrowRight className="ml-2 h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
        </Button>
      </form>

      <div className="mt-6 space-y-2 text-sm leading-relaxed text-muted-foreground">
        <p>
          New to Style Sence?{' '}
          <Link to="/account?mode=signup" className="link-underline font-medium text-foreground">
            Create an account
          </Link>
        </p>
        <p>
          Track an order without an account —{' '}
          <Link to="/track" className="link-underline font-medium text-foreground">
            order tracking
          </Link>
        </p>
      </div>
    </section>
  )
}

const BENEFITS = [
  {
    icon: Package,
    title: 'Every order, remembered',
    copy: 'Your full order history, one quiet tap away.',
  },
  {
    icon: Truck,
    title: 'Faster checkout',
    copy: 'Saved details prefill delivery in seconds.',
  },
  {
    icon: Heart,
    title: 'Wishlist, everywhere',
    copy: 'Saved pieces follow you across devices.',
  },
] as const

function BenefitsPanel() {
  return (
    <section aria-label="Account benefits" className="border border-line bg-card p-6 sm:p-8">
      <p className="eyebrow">Create an account</p>
      <h2 className="mt-2 font-display text-2xl font-light tracking-tight">
        The considered way to shop
      </h2>
      <ul className="mt-6 divide-y divide-line">
        {BENEFITS.map((b) => (
          <li key={b.title} className="flex items-start gap-4 py-4 first:pt-0 last:pb-0">
            <b.icon className="mt-0.5 h-4 w-4 shrink-0 text-espresso" strokeWidth={1.5} aria-hidden />
            <div>
              <p className="text-sm font-medium">{b.title}</p>
              <p className="mt-1 text-[0.8rem] leading-relaxed text-muted-foreground">{b.copy}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function RegisterForm() {
  const register = useCustomerRegister()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const serverError =
    register.isError && register.error instanceof Error ? register.error.message : null
  const error = formError ?? serverError
  const busy = register.isPending

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const nextName = name.trim()
    const nextEmail = email.trim().toLowerCase()
    if (nextName.length < 2 || !EMAIL_PATTERN.test(nextEmail) || password.length < 8) {
      setFormError(
        password.length > 0 && password.length < 8
          ? 'Your password needs at least 8 characters.'
          : 'Enter your name, a valid email and a password of at least 8 characters.',
      )
      return
    }
    setFormError(null)
    register.mutate(
      { name: nextName, email: nextEmail, password },
      {
        onSuccess: () => {
          toast.success('Welcome to Style Sence — your account is ready.')
          navigate('/account')
        },
      },
    )
  }

  return (
    <section aria-label="Create an account" className="mt-8 border border-line bg-card p-6 sm:p-8">
      <p className="eyebrow">Register</p>
      <h2 className="mt-2 font-display text-2xl font-light tracking-tight">Create your account</h2>

      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="reg-name" className="eyebrow">Name</Label>
          <Input
            id="reg-name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              register.reset()
            }}
            placeholder="Adaeze Okonkwo"
            className={fieldCls}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="reg-email" className="eyebrow">Email</Label>
          <Input
            id="reg-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              register.reset()
            }}
            placeholder="you@example.com"
            className={fieldCls}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="reg-password" className="eyebrow">Password</Label>
          <Input
            id="reg-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              register.reset()
            }}
            placeholder="At least 8 characters"
            aria-describedby="reg-password-hint"
            className={fieldCls}
          />
          <p id="reg-password-hint" className="text-[0.66rem] text-muted-foreground">
            At least 8 characters.
          </p>
        </div>

        {error ? (
          <p
            role="alert"
            className="border border-destructive/40 bg-[color-mix(in_oklch,var(--destructive)_7%,transparent)] px-4 py-3 text-xs leading-relaxed text-destructive"
          >
            {error}
          </p>
        ) : null}

        <Button type="submit" disabled={busy} className="h-12 w-full uppercase tracking-[0.2em] text-[0.66rem]">
          {busy ? 'Creating account…' : 'Create account'}
        </Button>
      </form>

      <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
        Already have an account?{' '}
        <Link to="/account" className="link-underline font-medium text-foreground">
          Sign in
        </Link>
      </p>
    </section>
  )
}

/* ——— password reset: request a link (?mode=forgot) ——— */

function ResetRequestView() {
  const [email, setEmail] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [sent, setSent] = useState<{ email: string; devResetUrl: string | null } | null>(null)
  const request = useMutation({ mutationFn: requestResetLink })
  const serverError = request.isError && request.error instanceof Error ? request.error.message : null
  const error = formError ?? serverError
  const busy = request.isPending

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const nextEmail = email.trim().toLowerCase()
    if (!EMAIL_PATTERN.test(nextEmail)) {
      setFormError('Enter the email address on your account.')
      return
    }
    setFormError(null)
    request.mutate(
      { email: nextEmail },
      { onSuccess: (res) => setSent({ email: nextEmail, devResetUrl: res.devResetUrl }) },
    )
  }

  return (
    <div className="mx-auto max-w-xl">
      <Reveal>
        <p className="eyebrow">Your account</p>
        <h1 className="mt-3 font-display text-4xl font-light tracking-tight text-balance sm:text-5xl">
          Reset your password
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Enter the email address on your account — we&apos;ll send a single-use
          link to choose a new password. It expires within the hour.
        </p>
      </Reveal>

      <Reveal delay={0.05}>
        {sent ? (
          <section aria-label="Reset link sent" className="mt-10 border border-line bg-card p-6 sm:p-8">
            <span className="flex h-11 w-11 items-center justify-center rounded-full border border-espresso/40 text-espresso">
              <Check className="h-5 w-5" strokeWidth={1.5} aria-hidden />
            </span>
            <h2 className="mt-4 font-display text-2xl font-light tracking-tight">Check your inbox</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              If an account exists for{' '}
              <span className="font-medium text-foreground">{sent.email}</span>, a reset link is on its way.
            </p>
            <p className="mt-2 text-[0.8rem] leading-relaxed text-muted-foreground">
              The link expires in 1 hour and can be used once.
            </p>

            {sent.devResetUrl ? (
              <div className="mt-6 border border-line bg-secondary/50 px-4 py-3.5">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Email not arrived yet? Open your reset link directly below to continue.
                </p>
                <Link
                  to={sent.devResetUrl.replace(/^\/#/, '')}
                  className="link-underline mt-2 inline-flex min-h-11 items-center font-medium text-foreground"
                >
                  Open my reset link
                  <ArrowRight className="ml-2 h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
                </Link>
              </div>
            ) : null}

            <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
              <Link to="/account" className="link-underline font-medium text-foreground">
                Back to sign in
              </Link>
            </p>
          </section>
        ) : (
          <section aria-label="Request a password reset" className="mt-10 border border-line bg-card p-6 sm:p-8">
            <p className="eyebrow">Password reset</p>
            <h2 className="mt-2 font-display text-2xl font-light tracking-tight">Send a reset link</h2>

            <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="fr-email" className="eyebrow">Email</Label>
                <Input
                  id="fr-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    request.reset()
                  }}
                  placeholder="you@example.com"
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? 'fr-error' : undefined}
                  className={fieldCls}
                />
              </div>

              {error ? (
                <p
                  id="fr-error"
                  role="alert"
                  className="border border-destructive/40 bg-[color-mix(in_oklch,var(--destructive)_7%,transparent)] px-4 py-3 text-xs leading-relaxed text-destructive"
                >
                  {error}
                </p>
              ) : null}

              <Button type="submit" disabled={busy} className="h-12 w-full uppercase tracking-[0.2em] text-[0.66rem]">
                {busy ? 'Sending…' : 'Send reset link'}
              </Button>
            </form>

            <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
              Remembered it after all?{' '}
              <Link to="/account" className="link-underline font-medium text-foreground">
                Back to sign in
              </Link>
            </p>
          </section>
        )}
      </Reveal>
    </div>
  )
}

/* ——— password reset: choose a new password (?mode=reset&token=…) ——— */

function ResetConfirmView({ token }: { token: string }) {
  const qc = useQueryClient()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const confirm = useMutation({
    mutationFn: confirmPasswordReset,
    onSuccess: () => {
      // A completed reset deletes every session — refetch so the header and
      // this page reflect the signed-out state if this browser was signed in.
      qc.invalidateQueries({ queryKey: ['customer-me'] })
      setDone(true)
    },
  })
  const serverError = confirm.isError && confirm.error instanceof Error ? confirm.error.message : null
  const error = formError ?? serverError
  const busy = confirm.isPending

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (password.length < 8) {
      setFormError('Your new password needs at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setFormError('Both password fields must match.')
      return
    }
    setFormError(null)
    confirm.mutate({ token, password })
  }

  return (
    <div className="mx-auto max-w-xl">
      <Reveal>
        <p className="eyebrow">Your account</p>
        <h1 className="mt-3 font-display text-4xl font-light tracking-tight text-balance sm:text-5xl">
          Choose a new password
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Set the new password below. Using the link signs out every device on
          the account — yours included.
        </p>
      </Reveal>

      <Reveal delay={0.05}>
        {!token ? (
          <section
            aria-label="Reset link required"
            className="mt-10 flex flex-col items-center border border-dashed border-line-strong bg-card px-6 py-14 text-center sm:px-8"
          >
            <p className="font-display text-2xl font-light italic text-balance">This link is incomplete.</p>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
              The reset link is missing its token — request a fresh one and it
              will arrive within the hour.
            </p>
            <Link
              to="/account?mode=forgot"
              className="link-underline mt-7 inline-flex min-h-11 items-center text-sm font-medium"
            >
              Request a new link
              <ArrowRight className="ml-2 h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
            </Link>
          </section>
        ) : done ? (
          <section aria-label="Password updated" className="mt-10 border border-line bg-card p-6 sm:p-8">
            <span className="flex h-11 w-11 items-center justify-center rounded-full border border-espresso/40 text-espresso">
              <Check className="h-5 w-5" strokeWidth={1.5} aria-hidden />
            </span>
            <h2 className="mt-4 font-display text-2xl font-light tracking-tight">Your password has been updated</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              All devices were signed out for your security — sign in with your
              new password to continue.
            </p>
            <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
              <Link to="/account" className="link-underline font-medium text-foreground">
                Continue to sign in
              </Link>
            </p>
          </section>
        ) : (
          <section aria-label="Choose a new password" className="mt-10 border border-line bg-card p-6 sm:p-8">
            <p className="eyebrow">Password reset</p>
            <h2 className="mt-2 font-display text-2xl font-light tracking-tight">Your new password</h2>

            <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="np-password" className="eyebrow">New password</Label>
                <Input
                  id="np-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    confirm.reset()
                  }}
                  placeholder="At least 8 characters"
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? 'np-error' : 'np-password-hint'}
                  className={fieldCls}
                />
                <p id="np-password-hint" className="text-[0.66rem] text-muted-foreground">
                  At least 8 characters.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="np-confirm" className="eyebrow">Confirm password</Label>
                <Input
                  id="np-confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value)
                    confirm.reset()
                  }}
                  placeholder="Once more"
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? 'np-error' : undefined}
                  className={fieldCls}
                />
              </div>

              {error ? (
                <p
                  id="np-error"
                  role="alert"
                  className="border border-destructive/40 bg-[color-mix(in_oklch,var(--destructive)_7%,transparent)] px-4 py-3 text-xs leading-relaxed text-destructive"
                >
                  {error}
                </p>
              ) : null}
              {serverError ? (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  <Link to="/account?mode=forgot" className="link-underline font-medium text-foreground">
                    Request a new link
                  </Link>
                </p>
              ) : null}

              <Button type="submit" disabled={busy} className="h-12 w-full uppercase tracking-[0.2em] text-[0.66rem]">
                {busy ? 'Updating…' : 'Update password'}
              </Button>
            </form>
          </section>
        )}
      </Reveal>
    </div>
  )
}

/* ——— signed in: overview ——— */

function AccountOverview({ customer }: { customer: CustomerView }) {
  const logout = useCustomerLogout()

  return (
    <div>
      <Reveal>
        <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4 border-b border-line pb-8">
          <div>
            <p className="eyebrow">Your account</p>
            <h1 className="mt-2 font-display text-4xl font-light tracking-tight text-balance sm:text-5xl">
              {customer.name}
            </h1>
            <p className="mt-3 font-mono text-[0.72rem] uppercase tracking-[0.14em] text-muted-foreground tabular-nums">
              {customer.email} · Member since {formatDateShort(customer.createdAt)}
            </p>
          </div>
          <Button
            variant="outline"
            className="h-11 px-6 uppercase tracking-[0.2em] text-[0.64rem]"
            disabled={logout.isPending}
            onClick={() =>
              logout.mutate(undefined, {
                onSuccess: () => {
                  toast('Signed out — see you soon.')
                  navigate('/account')
                },
              })
            }
          >
            {logout.isPending ? 'Signing out…' : 'Sign out'}
          </Button>
        </div>
      </Reveal>

      <div className="mt-10 grid gap-10 lg:grid-cols-[26rem_minmax(0,1fr)]">
        <div className="space-y-8">
          <Reveal delay={0.05}>
            <ProfileForm customer={customer} />
          </Reveal>
          <Reveal delay={0.1}>
            <WishlistPreview />
          </Reveal>
        </div>
        <Reveal delay={0.08}>
          <OrderHistory />
        </Reveal>
      </div>
    </div>
  )
}

/* ——— profile & default shipping details ——— */

function ProfileForm({ customer }: { customer: CustomerView }) {
  const update = useUpdateCustomerProfile()
  const [name, setName] = useState(() => customer.name)
  const [phone, setPhone] = useState(() => customer.phone ?? '')
  const [address, setAddress] = useState(() => customer.defaultAddress ?? '')
  const [city, setCity] = useState(() => customer.defaultCity ?? '')
  const [state, setState] = useState(() =>
    customer.defaultState && NG_STATES.includes(customer.defaultState) ? customer.defaultState : '',
  )
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = (): boolean => {
    const e: Record<string, string> = {}
    if (name.trim().length < 2) e.name = 'Your name is required.'
    if (phone.trim().length > 0 && phone.trim().length < 7) e.phone = 'A reachable phone number is required.'
    if (address.trim().length > 0 && address.trim().length < 5) e.address = 'Your street address is required.'
    if (city.trim().length > 0 && city.trim().length < 2) e.city = 'Your city is required.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!validate()) return
    // Empty strings clear server-side (stored as null); absent fields are untouched.
    update.mutate(
      {
        name: name.trim(),
        phone: phone.trim(),
        defaultAddress: address.trim(),
        defaultCity: city.trim(),
        defaultState: state,
      },
      {
        onSuccess: (saved) => {
          setName(saved.name)
          setPhone(saved.phone ?? '')
          setAddress(saved.defaultAddress ?? '')
          setCity(saved.defaultCity ?? '')
          setState(saved.defaultState ?? '')
        },
      },
    )
  }

  const err = (k: string) =>
    errors[k] ? (
      <p className="text-[0.7rem] text-destructive" role="alert">
        {errors[k]}
      </p>
    ) : null

  return (
    <section aria-label="Profile and default shipping details" className="border border-line bg-card p-6 sm:p-8">
      <p className="eyebrow">Saved details</p>
      <h2 className="mt-2 font-display text-2xl font-light tracking-tight">Profile & delivery</h2>
      <p className="mt-2 text-[0.8rem] leading-relaxed text-muted-foreground">
        These prefill checkout — set them once, shop faster after.
      </p>

      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="pf-name" className="eyebrow">Name</Label>
          <Input
            id="pf-name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={cn(fieldCls, errors.name && 'border-destructive')}
            aria-invalid={errors.name ? true : undefined}
          />
          {err('name')}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pf-phone" className="eyebrow">Phone</Label>
          <Input
            id="pf-phone"
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+234 801 234 5678"
            className={cn(fieldCls, errors.phone && 'border-destructive')}
            aria-invalid={errors.phone ? true : undefined}
          />
          {err('phone')}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pf-address" className="eyebrow">Default address</Label>
          <Input
            id="pf-address"
            type="text"
            autoComplete="street-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="14A Awolowo Road, Ikoyi"
            className={cn(fieldCls, errors.address && 'border-destructive')}
            aria-invalid={errors.address ? true : undefined}
          />
          {err('address')}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="pf-city" className="eyebrow">City</Label>
            <Input
              id="pf-city"
              type="text"
              autoComplete="address-level2"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Lagos"
              className={cn(fieldCls, errors.city && 'border-destructive')}
              aria-invalid={errors.city ? true : undefined}
            />
            {err('city')}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pf-state" className="eyebrow">State</Label>
            <select
              id="pf-state"
              value={state}
              onChange={(e) => setState(e.target.value)}
              className={cn(
                'h-12 w-full rounded-[--radius] border border-line-strong bg-background px-3 text-sm focus:outline-none focus-visible:outline-2 focus-visible:outline-ring',
              )}
            >
              <option value="">Optional…</option>
              {NG_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <Button
          type="submit"
          disabled={update.isPending}
          className="h-12 w-full uppercase tracking-[0.2em] text-[0.66rem]"
        >
          {update.isPending ? 'Saving…' : 'Save details'}
        </Button>
      </form>
    </section>
  )
}

/* ——— wishlist preview ——— */

function WishlistPreview() {
  const items = useWishlist((s) => s.items)
  const mounted = useMounted()
  const list = mounted ? items : []
  const count = list.length

  return (
    <section aria-label="Wishlist preview" className="border border-line bg-card p-6 sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Wishlist</p>
          <p className="mt-2 font-display text-2xl font-light tracking-tight">
            {count} {count === 1 ? 'piece' : 'pieces'}
          </p>
          <p className="mt-2 text-[0.8rem] leading-relaxed text-muted-foreground">
            {count === 0
              ? 'Pieces you love will gather here — on every device.'
              : 'Kept in step with this account on every device.'}
          </p>
        </div>
        <Heart className="h-5 w-5 shrink-0 text-espresso" strokeWidth={1.5} aria-hidden />
      </div>

      {count > 0 ? (
        <ul className="mt-5 flex gap-3" aria-hidden>
          {list.slice(0, 4).map((item) => (
            <li key={item.slug}>
              <ProductImage
                src={item.primaryImage}
                alt={item.name}
                label={item.name}
                ratio="aspect-[3/4]"
                className="w-14"
              />
            </li>
          ))}
        </ul>
      ) : null}

      <Link
        to="/wishlist"
        className="link-underline mt-6 inline-flex min-h-11 items-center text-sm font-medium"
      >
        {count > 0 ? 'Open the wishlist' : 'Start saving pieces'}
        <ArrowRight className="ml-2 h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
      </Link>
    </section>
  )
}

/* ——— order history ——— */

async function fetchCustomerOrders(): Promise<CustomerOrderSummary[]> {
  const res = await fetch('/api/customer/orders')
  const body = (await res.json().catch(() => ({}))) as { orders?: CustomerOrderSummary[]; error?: string }
  if (!res.ok || !body.orders) throw new Error(body.error ?? 'Order history is unavailable right now.')
  return body.orders
}

function OrderHistory() {
  const query = useQuery({
    queryKey: ['customer-orders'],
    queryFn: fetchCustomerOrders,
    staleTime: 60_000,
    retry: false,
  })

  const orders = query.data ?? []

  return (
    <section aria-label="Order history">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-line pb-4">
        <h2 className="font-display text-2xl font-light tracking-tight">Order history</h2>
        {query.isSuccess ? (
          <p className="text-[0.7rem] uppercase tracking-[0.16em] text-muted-foreground">
            {orders.length} {orders.length === 1 ? 'order' : 'orders'} on file
          </p>
        ) : null}
      </div>

      {query.isLoading ? (
        <div className="mt-2 space-y-3" aria-busy="true">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full bg-secondary" />
          ))}
          <p className="sr-only">Gathering your orders…</p>
        </div>
      ) : query.isError ? (
        <div className="mt-6 flex flex-col items-center border border-dashed border-line-strong px-6 py-14 text-center">
          <p className="font-display text-2xl font-light italic text-balance">
            We couldn’t gather those orders.
          </p>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            {query.error instanceof Error ? query.error.message : 'Something went wrong.'}{' '}
            <Link to="/help" className="link-underline font-medium text-foreground">
              The studio can help
            </Link>
            .
          </p>
        </div>
      ) : orders.length === 0 ? (
        <div className="mt-6 flex flex-col items-center border border-dashed border-line-strong px-6 py-16 text-center">
          <Package className="h-7 w-7 text-muted-foreground/40" strokeWidth={1} aria-hidden />
          <p className="mt-4 font-display text-3xl font-light italic">No orders yet.</p>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
            When you place an order it will gather here, ready to follow from
            the atelier to your door.
          </p>
          <Link
            to="/shop"
            className="link-underline mt-7 inline-flex min-h-11 items-center text-sm font-medium"
          >
            Browse the collection
          </Link>
        </div>
      ) : (
        <ul className="scroll-elegant max-h-[34rem] divide-y divide-line overflow-y-auto" aria-label="Your orders">
          {orders.map((o) => (
            <li key={o.orderNumber}>
              <Link
                to={`/order/${o.orderNumber}`}
                aria-label={`View order ${o.orderNumber} — ${formatNaira(o.total)}`}
                className="group grid w-full grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-1 px-2 py-5 transition-colors hover:bg-secondary/60 sm:grid-cols-[10rem_1fr_auto_auto] sm:px-4"
              >
                <p className="font-mono text-xs font-medium tracking-[0.08em] transition-colors group-hover:text-espresso">
                  {o.orderNumber}
                </p>
                <p className="text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground">
                  Placed {formatDate(o.createdAt)} · {o.itemCount} {o.itemCount === 1 ? 'piece' : 'pieces'}
                </p>
                <span
                  className={cn(
                    'col-start-3 row-start-1 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[0.56rem] font-medium uppercase tracking-[0.16em]',
                    STATUS_STYLES[o.status] ?? 'border-line-strong text-foreground',
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
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
