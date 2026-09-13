'use client'

/**
 * Admin — Dashboard panel.
 * KPIs, 30-day revenue chart (recharts), order-status distribution,
 * recent orders, low-stock radar and review moderation summary.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ArrowRight, RefreshCw, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatNaira, formatDateShort } from '@/lib/money'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

/* ------------------------------------------------------------------ *
 * Types (API contract — GET /api/admin/stats)
 * ------------------------------------------------------------------ */
type OrderStatus = 'PAID' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'

interface SeriesPoint {
  date: string
  revenue: number
  orders: number
}

interface RecentOrder {
  orderNumber: string
  fullName: string
  email: string
  total: number
  status: OrderStatus
  createdAt: string
  itemCount: number
}

interface LowStockItem {
  productName: string
  variant: { size: string; color: string }
  stock: number
}

interface PromoTopCode {
  code: string
  label: string
  type: 'PERCENT' | 'AMOUNT' | 'SHIPPING'
  value: number
  usageCount: number
  maxUsage: number | null
  isActive: boolean
  orderCount: number
  discountTotal: number
}

interface AdminStats {
  revenue: { total: number; last30: number }
  orders: {
    total: number
    byStatus: Record<string, number>
    last30Series: SeriesPoint[]
    recent: RecentOrder[]
  }
  products: { total: number; active: number; lowStock: LowStockItem[] }
  reviews: { pending: number; approved: number; avgRating: number }
  subscribers: number
  customers: number
  promos: {
    activeCodes: number
    totalCodes: number
    ordersWithPromo: number
    discountTotal: number
    top: PromoTopCode[]
  }
}

/* ------------------------------------------------------------------ *
 * Small shared pieces
 * ------------------------------------------------------------------ */
const STATUS_ORDER: OrderStatus[] = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']

const STATUS_STYLES: Record<string, string> = {
  PAID: 'border-line-strong bg-secondary text-secondary-foreground',
  PROCESSING: 'border-espresso/35 bg-espresso/10 text-espresso',
  SHIPPED: 'border-[color:var(--chart-2)]/45 bg-[color:var(--chart-2)]/10 text-[color:var(--chart-2)]',
  DELIVERED: 'border-[oklch(0.55_0.08_140)]/45 bg-[oklch(0.55_0.08_140)]/10 text-[oklch(0.55_0.08_140)]',
  CANCELLED: 'border-destructive/45 bg-destructive/10 text-destructive',
}

const STATUS_BAR_COLOR: Record<string, string> = {
  PAID: 'var(--chart-2)',
  PROCESSING: 'var(--chart-1)',
  SHIPPED: 'var(--chart-3)',
  DELIVERED: 'oklch(0.55 0.08 140)',
  CANCELLED: 'var(--chart-5)',
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-[3px] border px-2 py-0.5 text-[0.58rem] font-medium uppercase tracking-[0.16em]',
        STATUS_STYLES[status] ?? 'border-line-strong text-muted-foreground',
      )}
    >
      {status}
    </span>
  )
}

function PanelError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="border border-destructive/40 bg-destructive/5 p-6" role="alert">
      <p className="eyebrow text-destructive">Something went wrong</p>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      <Button variant="outline" size="sm" className="mt-4 border-line-strong" onClick={onRetry}>
        Try again
      </Button>
    </div>
  )
}

function Kpi({
  label,
  value,
  sub,
  mono,
}: {
  label: string
  value: string
  sub?: string
  mono?: boolean
}) {
  return (
    <div className="border border-line bg-card p-4">
      <p className="eyebrow">{label}</p>
      <p
        className={cn(
          'mt-3 text-[1.55rem] leading-none tracking-tight',
          mono ? 'font-mono tabular-nums' : 'font-display font-light',
        )}
      >
        {value}
      </p>
      {sub ? <p className="mt-2 text-[0.66rem] leading-snug text-muted-foreground">{sub}</p> : null}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Chart
 * ------------------------------------------------------------------ */
interface TipItem {
  dataKey?: string | number
  name?: string
  value?: number | string
  color?: string
}

function ChartTip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: TipItem[]
  label?: string | number
}) {
  if (!active || !payload || payload.length === 0) return null
  const revenue = payload.find((p) => p.dataKey === 'revenue')
  const orders = payload.find((p) => p.dataKey === 'orders')
  return (
    <div className="border border-line-strong bg-card px-3 py-2 text-xs">
      <p className="eyebrow !text-[0.56rem]">
        {typeof label === 'string'
          ? new Date(`${label}T00:00:00`).toLocaleDateString('en-NG', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })
          : ''}
      </p>
      {revenue ? (
        <p className="mt-1.5 font-mono tabular-nums">
          {formatNaira(Number(revenue.value ?? 0))}{' '}
          <span className="font-sans text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
            revenue
          </span>
        </p>
      ) : null}
      {orders ? (
        <p className="mt-0.5 font-mono tabular-nums">
          {orders.value}{' '}
          <span className="font-sans text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
            orders
          </span>
        </p>
      ) : null}
    </div>
  )
}

function shortDay(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })
}

function moneyTick(v: number): string {
  return v >= 1000 ? `₦${Math.round(v / 1000)}k` : `₦${v}`
}

function RevenueChart({ data }: { data: SeriesPoint[] }) {
  return (
    <div className="h-72 sm:h-80" role="img" aria-label="Area chart of daily revenue and order count over the last 30 days">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
          <defs>
            <linearGradient id="ss-rev-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.22} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="2 4" />
          <XAxis
            dataKey="date"
            tickFormatter={shortDay}
            tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
            axisLine={{ stroke: 'var(--line-strong)' }}
            tickLine={false}
            minTickGap={28}
          />
          <YAxis
            yAxisId="revenue"
            width={52}
            tickFormatter={moneyTick}
            tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            yAxisId="orders"
            orientation="right"
            width={28}
            allowDecimals={false}
            tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<ChartTip />} cursor={{ stroke: 'var(--line-strong)' }} />
          <Area
            yAxisId="revenue"
            type="monotone"
            dataKey="revenue"
            name="Revenue"
            stroke="var(--chart-1)"
            strokeWidth={1.5}
            fill="url(#ss-rev-fill)"
          />
          <Line
            yAxisId="orders"
            type="monotone"
            dataKey="orders"
            name="Orders"
            stroke="var(--chart-2)"
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3, strokeWidth: 0 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

function promoRewardLabel(type: string, value: number): string {
  if (type === 'PERCENT') return `${value}% off`
  if (type === 'AMOUNT') return `${formatNaira(value)} off`
  return 'Free shipping'
}

function PromoPerformance({ promos, orderTotal }: { promos: AdminStats['promos']; orderTotal: number }) {
  const maxUsage = Math.max(...promos.top.map((c) => c.orderCount), 1)
  const sharePct = orderTotal > 0 ? Math.round((promos.ordersWithPromo / orderTotal) * 100) : 0
  return (
    <section className="border border-line bg-card" aria-labelledby="dash-promo-label">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5">
        <p className="eyebrow" id="dash-promo-label">Promo performance — all time</p>
        <button
          type="button"
          onClick={() => {
            window.location.hash = '#/admin?tab=promos'
          }}
          className="flex items-center gap-1 text-[0.62rem] font-medium uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground"
        >
          Manage codes
          <ArrowRight className="h-3 w-3" strokeWidth={1.5} aria-hidden />
        </button>
      </div>

      <div className="grid grid-cols-3 divide-x divide-line border-b border-line">
        <div className="px-4 py-4 sm:px-5">
          <p className="eyebrow !text-[0.55rem]">Orders with a code</p>
          <p className="mt-2 font-mono text-lg tabular-nums leading-none">
            {promos.ordersWithPromo}
            <span className="ml-1.5 text-[0.62rem] text-muted-foreground">{sharePct}% of all</span>
          </p>
        </div>
        <div className="px-4 py-4 sm:px-5">
          <p className="eyebrow !text-[0.55rem]">Discount given</p>
          <p className="mt-2 font-mono text-lg tabular-nums leading-none">
            {formatNaira(promos.discountTotal)}
          </p>
        </div>
        <div className="px-4 py-4 sm:px-5">
          <p className="eyebrow !text-[0.55rem]">Active codes</p>
          <p className="mt-2 font-mono text-lg tabular-nums leading-none">
            {promos.activeCodes}
            <span className="ml-1.5 text-[0.62rem] text-muted-foreground">of {promos.totalCodes}</span>
          </p>
        </div>
      </div>

      {promos.top.length === 0 ? (
        <p className="px-4 py-6 font-display text-lg font-light italic text-muted-foreground sm:px-5">
          No codes in the house yet.
        </p>
      ) : (
        <ul className="max-h-72 overflow-y-auto scroll-elegant">
          {promos.top.map((c) => (
            <li
              key={c.code}
              className="flex items-center gap-4 border-b border-line px-4 py-3 last:border-b-0 sm:px-5"
            >
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="font-mono text-xs font-semibold tracking-wide">{c.code}</span>
                  <span
                    className={cn(
                      'text-[0.56rem] font-medium uppercase tracking-[0.16em]',
                      c.isActive ? 'text-muted-foreground' : 'text-destructive',
                    )}
                  >
                    {c.isActive ? 'Active' : 'Retired'}
                  </span>
                </p>
                <p className="mt-0.5 truncate text-[0.66rem] text-muted-foreground">
                  {c.label} · {promoRewardLabel(c.type, c.value)}
                  {c.maxUsage != null ? ` · cap ${c.maxUsage}` : ''}
                </p>
              </div>
              <div className="hidden w-28 shrink-0 items-center gap-2 sm:flex" aria-hidden>
                <span className="h-[3px] flex-1 bg-secondary">
                  <span
                    className="block h-full bg-espresso"
                    style={{ width: `${Math.round((c.orderCount / maxUsage) * 100)}%` }}
                  />
                </span>
                <span className="w-4 shrink-0 text-right font-mono text-[0.62rem] tabular-nums text-muted-foreground">
                  {c.orderCount}
                </span>
              </div>
              <div className="w-24 shrink-0 text-right">
                <p className="font-mono text-xs tabular-nums">{formatNaira(c.discountTotal)}</p>
                <p className="text-[0.56rem] uppercase tracking-[0.14em] text-muted-foreground">
                  given · {c.orderCount} order{c.orderCount === 1 ? '' : 's'}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ *
 * Panel
 * ------------------------------------------------------------------ */
export function Dashboard() {
  const qc = useQueryClient()
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: async (): Promise<AdminStats> => {
      const res = await fetch('/api/admin/stats')
      const body = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(body.error ?? 'Failed to load stats')
      return body as unknown as AdminStats
    },
    retry: false,
    staleTime: 30_000,
  })

  if (isLoading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading dashboard">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-none border border-line" />
          ))}
        </div>
        <div className="grid gap-6 xl:grid-cols-3">
          <Skeleton className="h-96 rounded-none border border-line xl:col-span-2" />
          <div className="space-y-6">
            <Skeleton className="h-44 rounded-none border border-line" />
            <Skeleton className="h-44 rounded-none border border-line" />
          </div>
        </div>
        <Skeleton className="h-72 rounded-none border border-line" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <PanelError
        message={error instanceof Error ? error.message : 'Failed to load stats'}
        onRetry={() => void refetch()}
      />
    )
  }

  const ordersLast30 = data.orders.last30Series.reduce((sum, p) => sum + p.orders, 0)
  const aov = ordersLast30 > 0 ? Math.round(data.revenue.last30 / ordersLast30) : 0
  const maxStatus = Math.max(...STATUS_ORDER.map((s) => data.orders.byStatus[s] ?? 0), 1)
  const avgRounded = Math.round(data.reviews.avgRating)

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Overview</p>
          <h2 className="mt-2 font-display text-2xl font-light sm:text-3xl">The studio at a glance</h2>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="border-line-strong text-[0.62rem] uppercase tracking-[0.16em]"
          onClick={() => void qc.invalidateQueries({ queryKey: ['admin', 'stats'] })}
          aria-label="Refresh dashboard figures"
        >
          <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
          Refresh
        </Button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        <Kpi
          label="Revenue · 30d"
          value={formatNaira(data.revenue.last30)}
          sub={`of ${formatNaira(data.revenue.total)} all-time`}
          mono
        />
        <Kpi label="Orders · 30d" value={String(ordersLast30)} sub={`${data.orders.total} all-time`} />
        <Kpi label="Avg order · 30d" value={formatNaira(aov)} sub="revenue ÷ orders" mono />
        <Kpi
          label="Pending reviews"
          value={String(data.reviews.pending)}
          sub={`${data.reviews.avgRating.toFixed(1)}★ avg · ${data.reviews.approved} approved`}
        />
        <Kpi
          label="Low stock"
          value={String(data.products.lowStock.length)}
          sub="variants at ≤ 3 units"
        />
        <Kpi label="Subscribers" value={String(data.subscribers)} sub="newsletter list" />
      </div>

      {/* chart + side column */}
      <div className="grid gap-6 xl:grid-cols-3">
        <section className="border border-line bg-card p-4 sm:p-5 xl:col-span-2" aria-labelledby="dash-rev-label">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="eyebrow" id="dash-rev-label">Revenue — last 30 days</p>
            <div className="flex items-center gap-4 text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-[3px] w-4" style={{ background: 'var(--chart-1)' }} aria-hidden />
                Revenue
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-[3px] w-4" style={{ background: 'var(--chart-2)' }} aria-hidden />
                Orders / day
              </span>
            </div>
          </div>
          <div className="mt-4">
            <RevenueChart data={data.orders.last30Series} />
          </div>
        </section>

        <div className="space-y-6">
          {/* status distribution */}
          <section className="border border-line bg-card p-4 sm:p-5" aria-labelledby="dash-status-label">
            <p className="eyebrow" id="dash-status-label">Orders by status — all time</p>
            <ul className="mt-4 space-y-3">
              {STATUS_ORDER.map((status) => {
                const count = data.orders.byStatus[status] ?? 0
                const pct = Math.round((count / maxStatus) * 100)
                return (
                  <li key={status} className="flex items-center gap-3">
                    <span className="w-20 shrink-0 text-[0.6rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      {status}
                    </span>
                    <span className="h-[3px] flex-1 bg-secondary" aria-hidden>
                      <span
                        className="block h-full"
                        style={{ width: `${pct}%`, background: STATUS_BAR_COLOR[status] }}
                      />
                    </span>
                    <span className="w-8 shrink-0 text-right font-mono text-xs tabular-nums">{count}</span>
                  </li>
                )
              })}
            </ul>
          </section>

          {/* reviews summary */}
          <section className="border border-line bg-card p-4 sm:p-5" aria-labelledby="dash-rev-sum-label">
            <p className="eyebrow" id="dash-rev-sum-label">Reviews</p>
            <div className="mt-3 flex items-baseline gap-2">
              <p className="font-display text-4xl font-light leading-none">{data.reviews.pending}</p>
              <p className="text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground">
                awaiting moderation
              </p>
            </div>
            <div className="mt-3 flex items-center gap-1" aria-hidden>
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={cn('h-3.5 w-3.5', i < avgRounded ? 'fill-espresso text-espresso' : 'text-line-strong')}
                  strokeWidth={1.5}
                />
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              <span className="font-mono tabular-nums">{data.reviews.avgRating.toFixed(1)}</span> average ·{' '}
              <span className="font-mono tabular-nums">{data.reviews.approved}</span> approved
            </p>
            <button
              type="button"
              onClick={() => {
                window.location.hash = '#/admin?tab=reviews'
              }}
              className="mt-4 flex items-center gap-1.5 text-[0.66rem] font-medium uppercase tracking-[0.18em] text-espresso transition-colors hover:text-foreground"
            >
              Moderate reviews
              <ArrowRight className="h-3 w-3" strokeWidth={1.5} aria-hidden />
            </button>
          </section>
        </div>
      </div>

      {/* recent orders + low stock */}
      <div className="grid gap-6 xl:grid-cols-3">
        <section className="border border-line bg-card xl:col-span-2" aria-labelledby="dash-recent-label">
          <div className="flex items-center justify-between border-b border-line px-4 py-3.5 sm:px-5">
            <p className="eyebrow" id="dash-recent-label">Recent orders</p>
            <button
              type="button"
              onClick={() => {
                window.location.hash = '#/admin?tab=orders'
              }}
              className="flex items-center gap-1 text-[0.62rem] font-medium uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground"
            >
              All orders
              <ArrowRight className="h-3 w-3" strokeWidth={1.5} aria-hidden />
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto scroll-elegant">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead scope="col" className="pl-4 sm:pl-5">Order</TableHead>
                  <TableHead scope="col">Customer</TableHead>
                  <TableHead scope="col" className="text-right">Items</TableHead>
                  <TableHead scope="col" className="text-right">Total</TableHead>
                  <TableHead scope="col">Status</TableHead>
                  <TableHead scope="col" className="pr-4 text-right sm:pr-5">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.orders.recent.map((o) => (
                  <TableRow
                    key={o.orderNumber}
                    tabIndex={0}
                    aria-label={`View order ${o.orderNumber} in the Orders panel`}
                    onClick={() => {
                      window.location.hash = '#/admin?tab=orders'
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        window.location.hash = '#/admin?tab=orders'
                      }
                    }}
                    className="cursor-pointer"
                  >
                    <TableCell className="pl-4 font-mono text-xs sm:pl-5">{o.orderNumber}</TableCell>
                    <TableCell className="max-w-44 truncate">
                      <p className="text-sm leading-tight">{o.fullName}</p>
                      <p className="truncate text-[0.66rem] text-muted-foreground">{o.email}</p>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums">
                      {o.itemCount}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums">
                      {formatNaira(o.total)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={o.status} />
                    </TableCell>
                    <TableCell className="pr-4 text-right text-[0.66rem] text-muted-foreground sm:pr-5">
                      {formatDateShort(o.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>

        <section className="border border-line bg-card p-4 sm:p-5" aria-labelledby="dash-low-label">
          <div className="flex items-center justify-between">
            <p className="eyebrow" id="dash-low-label">Low-stock radar</p>
            <p className="text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground">≤ 3 units</p>
          </div>
          {data.products.lowStock.length === 0 ? (
            <p className="mt-6 font-display text-lg font-light italic text-muted-foreground">
              Every variant is healthily stocked.
            </p>
          ) : (
            <ul className="mt-4 max-h-80 space-y-3 overflow-y-auto scroll-elegant pr-1">
              {data.products.lowStock.map((item, i) => (
                <li
                  key={`${item.productName}-${item.variant.size}-${item.variant.color}-${i}`}
                  className="flex items-center justify-between gap-3 border-b border-line pb-3 last:border-b-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm leading-tight">{item.productName}</p>
                    <p className="mt-0.5 text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
                      {item.variant.size} · {item.variant.color}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 font-mono text-sm tabular-nums',
                      item.stock <= 3 ? 'font-semibold text-espresso' : 'text-foreground',
                    )}
                  >
                    {item.stock}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={() => {
              window.location.hash = '#/admin?tab=products'
            }}
            className="mt-5 flex items-center gap-1.5 text-[0.66rem] font-medium uppercase tracking-[0.18em] text-espresso transition-colors hover:text-foreground"
          >
            Manage stock
            <ArrowRight className="h-3 w-3" strokeWidth={1.5} aria-hidden />
          </button>
        </section>
      </div>

      {/* promo performance */}
      <PromoPerformance promos={data.promos} orderTotal={data.orders.total} />
    </div>
  )
}
