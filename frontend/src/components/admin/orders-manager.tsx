'use client'

/**
 * Admin — Orders panel.
 * Search + status filters, inline status editing (optimistic PATCH),
 * and a full order detail dialog (items, shipping address, notes, totals).
 */
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Check, Eye, Package, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatNaira, formatDate, formatDateShort } from '@/lib/money'
import { formatMeasurements, shippingLabel, type CustomMeasurements } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

/* ------------------------------------------------------------------ *
 * Types (API contract)
 * ------------------------------------------------------------------ */
type OrderStatus = 'PENDING_PAYMENT' | 'PAID' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'

const ORDER_STATUSES: OrderStatus[] = ['PENDING_PAYMENT', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']

interface AdminOrderItem {
  productName: string
  productSlug: string
  size: string
  color: string
  imageUrl: string | null
  unitPrice: number
  qty: number
  /** Round 13 made-to-order snapshot (raw JSON string for measurements). */
  sizeMode?: string
  customMeasurements?: string | null
  notes?: string | null
}

interface AdminOrder {
  id: string
  orderNumber: string
  email: string
  fullName: string
  phone: string | null
  address: string
  city: string
  state: string
  country: string
  shippingMethod: string
  shipping: number
  subtotal: number
  total: number
  status: OrderStatus
  createdAt: string
  notes?: string | null
  /** Round 13 made-to-order: production tier, add-on fee, client confirmation. */
  productionTier?: string
  productionFee?: number
  confirmedProduction?: boolean
  items: AdminOrderItem[]
}

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    ...init,
  })
  const body = (await res.json().catch(() => ({}))) as { error?: string }
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`)
  return body as T
}

/* ------------------------------------------------------------------ *
 * Shared bits
 * ------------------------------------------------------------------ */
const STATUS_STYLES: Record<string, string> = {
  PENDING_PAYMENT: 'border-amber-600/45 bg-amber-500/10 text-amber-700',
  PAID: 'border-line-strong bg-secondary text-secondary-foreground',
  PROCESSING: 'border-espresso/35 bg-espresso/10 text-espresso',
  SHIPPED: 'border-[color:var(--chart-2)]/45 bg-[color:var(--chart-2)]/10 text-[color:var(--chart-2)]',
  DELIVERED: 'border-[oklch(0.55_0.08_140)]/45 bg-[oklch(0.55_0.08_140)]/10 text-[oklch(0.55_0.08_140)]',
  CANCELLED: 'border-destructive/45 bg-destructive/10 text-destructive',
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

/** Round 13 production timeline chip — what the atelier works to. */
function ProductionBadge({ tier }: { tier: string }) {
  const express = tier === 'express'
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-[3px] px-2 py-0.5 font-mono text-[0.58rem] font-medium uppercase tracking-[0.16em]',
        express
          ? 'bg-espresso text-accent-foreground'
          : 'border border-line-strong text-muted-foreground',
      )}
    >
      {express ? 'Express · 2–3 days' : 'Standard · 7–10 days'}
    </span>
  )
}

/** Parse a raw customMeasurements JSON string from the admin API. Falls back to
 *  the raw string (truncated) when the payload isn’t the expected shape. */
function measurementText(raw: string | null | undefined): string {
  if (!raw) return ''
  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      const formatted = formatMeasurements(parsed as CustomMeasurements)
      if (formatted) return formatted
    }
  } catch {
    // Not JSON — show the raw payload below.
  }
  return raw.length > 64 ? `${raw.slice(0, 64)}…` : raw
}

function PanelError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="border border-destructive/40 bg-destructive/5 p-6" role="alert">
      <p className="eyebrow text-destructive">Could not load orders</p>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      <Button variant="outline" size="sm" className="mt-4 border-line-strong" onClick={onRetry}>
        Try again
      </Button>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Order detail dialog
 * ------------------------------------------------------------------ */
function OrderDialog({ order, onClose }: { order: AdminOrder; onClose: () => void }) {
  const itemCount = order.items.reduce((sum, it) => sum + it.qty, 0)
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto scroll-elegant border-line bg-background sm:max-w-2xl">
        <DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-3 pr-6">
            <DialogTitle className="font-mono text-lg tracking-tight">{order.orderNumber}</DialogTitle>
            <div className="flex flex-wrap items-center gap-2">
              {order.productionTier ? <ProductionBadge tier={order.productionTier} /> : null}
              <StatusBadge status={order.status} />
            </div>
          </div>
          <DialogDescription className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>
              {formatDate(order.createdAt)} · {itemCount} item{itemCount === 1 ? '' : 's'} ·{' '}
              {formatNaira(order.total)}
            </span>
            {order.confirmedProduction ? (
              <span className="flex items-center gap-1.5 text-espresso">
                <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden />
                Client confirmed measurements/details
              </span>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* items */}
          <div>
            <p className="eyebrow">Items</p>
            <ul className="mt-3 divide-y divide-[color:var(--line)] border-y border-line">
              {order.items.map((it, i) => (
                <li key={`${it.productSlug}-${it.size}-${it.color}-${i}`} className="flex items-center gap-3 py-3">
                  {it.imageUrl ? (
                    <img
                      src={it.imageUrl}
                      alt={it.productName}
                      className="h-14 w-12 shrink-0 border border-line object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <span className="flex h-14 w-12 shrink-0 items-center justify-center border border-line bg-secondary">
                      <Package className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} aria-hidden />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <a
                      href={`#/product/${it.productSlug}`}
                      className="link-underline text-sm leading-tight"
                    >
                      {it.productName}
                    </a>
                    <p className="mt-0.5 text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
                      {it.color} · {it.size} · qty {it.qty} × {formatNaira(it.unitPrice)}
                    </p>
                    {it.sizeMode === 'custom' ? (
                      <div className="mt-1.5 min-w-0 space-y-1">
                        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="inline-flex items-center border border-line-strong px-1.5 py-px font-mono text-[0.56rem] font-medium uppercase tracking-[0.16em] text-espresso">
                            Custom
                          </span>
                          <span className="min-w-0 font-mono text-[0.66rem] tabular-nums text-muted-foreground [overflow-wrap:anywhere]">
                            {measurementText(it.customMeasurements)}
                          </span>
                        </p>
                        {it.notes ? (
                          <p className="text-[0.66rem] leading-relaxed italic text-muted-foreground">
                            <span className="not-italic text-foreground">Atelier note:</span> “{it.notes}”
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <p className="shrink-0 font-mono text-xs tabular-nums">{formatNaira(it.unitPrice * it.qty)}</p>
                </li>
              ))}
            </ul>
          </div>

          {/* customer + shipping */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <p className="eyebrow">Customer</p>
              <div className="mt-2 space-y-0.5 text-sm">
                <p>{order.fullName}</p>
                <p className="text-muted-foreground">{order.email}</p>
                {order.phone ? <p className="text-muted-foreground">{order.phone}</p> : null}
              </div>
            </div>
            <div>
              <p className="eyebrow">Shipping address</p>
              <div className="mt-2 space-y-0.5 text-sm">
                <p>{order.address}</p>
                <p className="text-muted-foreground">
                  {order.city}
                  {order.state ? `, ${order.state}` : ''}
                  {order.country ? ` · ${order.country}` : ''}
                </p>
                <p className="mt-1.5 text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground">
                  {shippingLabel(order.shippingMethod)} — {formatNaira(order.shipping)}
                </p>
              </div>
            </div>
          </div>

          {order.notes ? (
            <div>
              <p className="eyebrow">Notes</p>
              <p className="mt-2 border-l-2 border-line-strong pl-3 text-sm italic text-muted-foreground">
                {order.notes}
              </p>
            </div>
          ) : null}

          {/* totals */}
          <div className="border-t border-line pt-4">
            <dl className="ml-auto w-fit space-y-1.5 text-sm">
              <div className="flex justify-end gap-8">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="font-mono tabular-nums">{formatNaira(order.subtotal)}</dd>
              </div>
              <div className="flex justify-end gap-8">
                <dt className="text-muted-foreground">Shipping</dt>
                <dd className="font-mono tabular-nums">{formatNaira(order.shipping)}</dd>
              </div>
              {order.productionFee && order.productionFee > 0 ? (
                <div className="flex justify-end gap-8">
                  <dt className="text-muted-foreground">Express production</dt>
                  <dd className="font-mono tabular-nums">+{formatNaira(order.productionFee)}</dd>
                </div>
              ) : null}
              <Separator className="my-1 bg-line" />
              <div className="flex justify-end gap-8">
                <dt className="text-[0.68rem] uppercase tracking-[0.18em]">Total</dt>
                <dd className="font-mono font-semibold tabular-nums">{formatNaira(order.total)}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="flex justify-end border-t border-line pt-4">
          <Button
            variant="outline"
            className="border-line-strong uppercase tracking-[0.16em] text-[0.62rem]"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ *
 * Panel
 * ------------------------------------------------------------------ */
export function OrdersManager() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [viewId, setViewId] = useState<string | null>(null)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'orders'],
    queryFn: () => jsonFetch<{ orders: AdminOrder[] }>('/api/admin/orders'),
    retry: false,
    staleTime: 30_000,
  })

  const orders = data?.orders ?? []

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) =>
      jsonFetch<{ order: AdminOrder }>(`/api/admin/orders/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ['admin', 'orders'] })
      const prev = qc.getQueryData<{ orders: AdminOrder[] }>(['admin', 'orders'])
      if (prev) {
        qc.setQueryData(['admin', 'orders'], {
          orders: prev.orders.map((o) => (o.id === id ? { ...o, status } : o)),
        })
      }
      return { prev }
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['admin', 'orders'], ctx.prev)
      toast.error(err instanceof Error ? err.message : 'Could not update the order status.')
    },
    onSuccess: ({ order }) => {
      toast.success(`${order.orderNumber} marked as ${order.status}.`)
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'orders'] })
      void qc.invalidateQueries({ queryKey: ['admin', 'stats'] })
      void qc.invalidateQueries({ queryKey: ['order'] })
    },
  })

  const q = search.trim().toLowerCase()
  const filtered = useMemo(
    () =>
      orders.filter((o) => {
        const matchesQ =
          q === '' ||
          o.orderNumber.toLowerCase().includes(q) ||
          o.email.toLowerCase().includes(q) ||
          o.fullName.toLowerCase().includes(q)
        const matchesStatus = statusFilter === 'all' || o.status === statusFilter
        return matchesQ && matchesStatus
      }),
    [orders, q, statusFilter],
  )

  const viewing = useMemo(() => orders.find((o) => o.id === viewId) ?? null, [orders, viewId])

  if (isLoading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading orders">
        <Skeleton className="h-16 rounded-none border border-line" />
        <Skeleton className="h-[60vh] rounded-none border border-line" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <PanelError
        message={error instanceof Error ? error.message : 'Failed to load orders'}
        onRetry={() => void refetch()}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Fulfilment</p>
          <h2 className="mt-2 font-display text-2xl font-light sm:text-3xl">
            Orders <span className="font-mono text-base text-muted-foreground">({orders.length})</span>
          </h2>
        </div>
      </div>

      {/* filters */}
      <div className="flex flex-col gap-3 border border-line bg-card p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            strokeWidth={1.5}
            aria-hidden
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search order number, email or name…"
            aria-label="Search orders"
            className="h-9 border-line-strong pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-full border-line-strong sm:w-48" aria-label="Filter by status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {ORDER_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground sm:mb-0.5">
          {filtered.length} of {orders.length}
        </p>
      </div>

      {/* table */}
      <div className="border border-line bg-card">
        <div className="max-h-[64vh] overflow-y-auto scroll-elegant">
          <Table>
            <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-card">
              <TableRow className="hover:bg-transparent">
                <TableHead scope="col" className="pl-4 sm:pl-5">Order</TableHead>
                <TableHead scope="col">Customer</TableHead>
                <TableHead scope="col">Items</TableHead>
                <TableHead scope="col" className="text-right">Total</TableHead>
                <TableHead scope="col">Status</TableHead>
                <TableHead scope="col" className="text-right">Date</TableHead>
                <TableHead scope="col" className="pr-4 text-right sm:pr-5">
                  <span className="sr-only">View order</span>
                  View
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((o) => {
                const itemCount = o.items.reduce((sum, it) => sum + it.qty, 0)
                const pending = statusMutation.isPending && statusMutation.variables?.id === o.id
                return (
                  <TableRow key={o.id}>
                    <TableCell className="pl-4 font-mono text-xs sm:pl-5">{o.orderNumber}</TableCell>
                    <TableCell className="max-w-44">
                      <p className="truncate text-sm leading-tight">{o.fullName}</p>
                      <p className="truncate text-[0.66rem] text-muted-foreground">{o.email}</p>
                    </TableCell>
                    <TableCell className="max-w-52">
                      <p className="text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground">
                        {itemCount} item{itemCount === 1 ? '' : 's'}
                      </p>
                      <p className="truncate text-xs">
                        {o.items[0]?.productName ?? '—'}
                        {o.items.length > 1 ? ' +1 more' : ''}
                      </p>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums">
                      {formatNaira(o.total)}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={o.status}
                        onValueChange={(v) =>
                          statusMutation.mutate({ id: o.id, status: v as OrderStatus })
                        }
                        disabled={pending}
                      >
                        <SelectTrigger
                          size="sm"
                          className={cn(
                            'h-7 w-[8.5rem] border-line-strong text-[0.6rem] font-medium uppercase tracking-[0.14em]',
                            o.status === 'CANCELLED' && 'border-destructive/45 text-destructive',
                            o.status === 'DELIVERED' && 'text-[oklch(0.55_0.08_140)]',
                          )}
                          aria-label={`Change status for order ${o.orderNumber}`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ORDER_STATUSES.map((s) => (
                            <SelectItem key={s} value={s} className="text-[0.66rem] uppercase tracking-[0.12em]">
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right text-[0.66rem] text-muted-foreground">
                      {formatDateShort(o.createdAt)}
                    </TableCell>
                    <TableCell className="pr-4 text-right sm:pr-5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => setViewId(o.id)}
                        aria-label={`View details for order ${o.orderNumber}`}
                      >
                        <Eye className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
        {filtered.length === 0 ? (
          <div className="border-t border-line px-5 py-12 text-center">
            <p className="font-display text-lg font-light italic text-muted-foreground">
              No orders match the current filters.
            </p>
          </div>
        ) : null}
      </div>

      {/* detail dialog — derived from cache so status edits stay live */}
      {viewing ? <OrderDialog order={viewing} onClose={() => setViewId(null)} /> : null}
    </div>
  )
}
