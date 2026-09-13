'use client'

/**
 * Admin console shell — auth + navigation.
 * Feature panels live in ./dashboard.tsx, ./products-manager.tsx etc.
 */
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { LogOut, ExternalLink, LayoutDashboard, Package, ClipboardList, Star, Mail, Users } from 'lucide-react'
import { navigate, useRoute, Link } from '@/lib/router'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DevPlaceholder } from '@/components/site/dev-placeholder'
import { Dashboard } from './dashboard'
import { ProductsManager } from './products-manager'
import { OrdersManager } from './orders-manager'
import { ReviewsManager } from './reviews-manager'
import { SubscribersManager } from './subscribers-manager'
import { CustomersManager } from './customers-manager'

interface AdminInfo {
  name: string
  email: string
  role: string
}

const TABS = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'products', label: 'Products', icon: Package },
  { key: 'orders', label: 'Orders', icon: ClipboardList },
  { key: 'reviews', label: 'Reviews', icon: Star },
  { key: 'subscribers', label: 'Subscribers', icon: Mail },
  { key: 'customers', label: 'Customers', icon: Users },
] as const

type TabKey = (typeof TABS)[number]['key']

function AdminLogin() {
  const qc = useQueryClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Login failed')
      toast.success(`Welcome back, ${data.admin.name}.`)
      qc.setQueryData(['admin-me'], { admin: data.admin })
      qc.invalidateQueries({ queryKey: ['admin'] })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="text-center">
          <p className="font-display text-2xl font-light uppercase tracking-[0.34em]">Style Sence</p>
          <p className="mt-1 text-[0.55rem] font-medium uppercase tracking-[0.5em] text-muted-foreground">
            by SKR — Admin
          </p>
        </div>

        <form onSubmit={submit} className="mt-8 border border-line bg-card p-6 sm:p-7">
          <p className="eyebrow">Sign in</p>
          <div className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="adm-email" className="eyebrow">Email</Label>
              <Input
                id="adm-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="owner@stylesence.example"
                className="h-11 border-line-strong"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adm-password" className="eyebrow">Password</Label>
              <Input
                id="adm-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="h-11 border-line-strong"
                required
              />
            </div>
            {error ? (
              <p className="border-l-2 border-destructive pl-3 text-[0.78rem] text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <Button type="submit" disabled={busy} className="h-11 w-full uppercase tracking-[0.18em] text-[0.64rem]">
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </div>
        </form>

        <div className="mt-5">
          <DevPlaceholder title="Development credentials">
            email <span className="font-mono">owner@stylesence.example</span> · password{' '}
            <span className="font-mono">stylesence-dev-2026</span>
          </DevPlaceholder>
        </div>

        <p className="mt-6 text-center">
          <Link to="/" className="text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground">
            ← Back to storefront
          </Link>
        </p>
      </div>
    </div>
  )
}

function AdminShell({ admin }: { admin: AdminInfo }) {
  const route = useRoute()
  const qc = useQueryClient()
  const tab = (TABS.find((t) => t.key === route.query.get('tab'))?.key ?? 'dashboard') as TabKey

  const setTab = (key: TabKey) => navigate(`/admin?tab=${key}`)

  const logout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' }).catch(() => {})
    qc.setQueryData(['admin-me'], null)
    qc.invalidateQueries({ queryKey: ['admin'] })
    toast('Signed out of the console.')
  }

  return (
    <div className="min-h-[calc(100vh-8rem)]">
      {/* top bar */}
      <div className="sticky top-16 z-30 border-b border-line bg-background/92 backdrop-blur-md sm:top-[4.5rem]">
        <div className="container-site flex h-14 items-center justify-between gap-4">
          <div className="flex items-baseline gap-3">
            <span className="font-display text-sm font-light uppercase tracking-[0.3em]">Admin</span>
            <span className="hidden text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground sm:inline">
              {admin.name} · {admin.role}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="flex items-center gap-1.5 border border-line-strong px-3 py-1.5 text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
            >
              Storefront
              <ExternalLink className="h-3 w-3" strokeWidth={1.5} aria-hidden />
            </Link>
            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-1.5 border border-line-strong px-3 py-1.5 text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:border-destructive hover:text-destructive"
            >
              <LogOut className="h-3 w-3" strokeWidth={1.5} aria-hidden />
              Sign out
            </button>
          </div>
        </div>
      </div>

      <div className="container-site grid gap-8 py-8 lg:grid-cols-[13rem_1fr] lg:gap-10">
        {/* sidebar */}
        <nav aria-label="Admin sections" className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:px-0">
          {TABS.map((t) => {
            const Icon = t.icon
            const active = tab === t.key
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex shrink-0 items-center gap-2.5 border px-4 py-2.5 text-[0.66rem] font-medium uppercase tracking-[0.14em] transition-colors lg:w-full',
                  active
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-line-strong text-muted-foreground hover:border-foreground hover:text-foreground',
                )}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
                {t.label}
              </button>
            )
          })}
        </nav>

        {/* panel */}
        <div className="min-w-0">
          {tab === 'dashboard' ? <Dashboard /> : null}
          {tab === 'products' ? <ProductsManager /> : null}
          {tab === 'orders' ? <OrdersManager /> : null}
          {tab === 'reviews' ? <ReviewsManager /> : null}
          {tab === 'subscribers' ? <SubscribersManager /> : null}
          {tab === 'customers' ? <CustomersManager /> : null}
        </div>
      </div>
    </div>
  )
}

export function AdminApp() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-me'],
    queryFn: async () => {
      const res = await fetch('/api/admin/me')
      if (res.status === 401) return { admin: null }
      if (!res.ok) throw new Error('Failed')
      return (await res.json()) as { admin: AdminInfo | null }
    },
    retry: false,
    staleTime: 60_000,
  })

  if (isLoading) {
    return (
      <div className="container-site flex min-h-[60vh] items-center justify-center" aria-busy>
        <div className="flex flex-col items-center gap-4">
          <div className="h-1 w-40 overflow-hidden bg-secondary">
            <div className="h-full w-1/2 animate-pulse bg-foreground" />
          </div>
          <p className="eyebrow">Checking credentials…</p>
        </div>
      </div>
    )
  }

  if (!data?.admin) return <AdminLogin />
  return <AdminShell admin={data.admin} />
}
