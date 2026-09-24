'use client'

/**
 * Admin — Customers panel.
 * Lifetime-value ranked roster with a top-clients strip.
 * Customers are derived from order history (labelled dev data).
 */
import { useQuery } from '@tanstack/react-query'
import { formatNaira, formatDateShort } from '@/lib/money'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { DevPlaceholder } from '@/components/site/dev-placeholder'
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
interface Customer {
  email: string
  name: string
  orderCount: number
  lifetimeValue: number
  lastOrderAt: string | null
}

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  const body = (await res.json().catch(() => ({}))) as { error?: string }
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`)
  return body as T
}

/* ------------------------------------------------------------------ *
 * Panel
 * ------------------------------------------------------------------ */
export function CustomersManager() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'customers'],
    queryFn: () => jsonFetch<{ customers: Customer[] }>('/api/admin/customers'),
    retry: false,
    staleTime: 60_000,
  })

  if (isLoading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading customers">
        <Skeleton className="h-16 rounded-none border border-line" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-none border border-line" />
          ))}
        </div>
        <Skeleton className="h-[50vh] rounded-none border border-line" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="border border-destructive/40 bg-destructive/5 p-6" role="alert">
        <p className="eyebrow text-destructive">Could not load customers</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {error instanceof Error ? error.message : 'Failed to load customers'}
        </p>
        <Button variant="outline" size="sm" className="mt-4 border-line-strong" onClick={() => void refetch()}>
          Try again
        </Button>
      </div>
    )
  }

  const customers = data.customers
  const topClients = customers.slice(0, 3)
  const topLtv = topClients[0]?.lifetimeValue ?? 0

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Clientele</p>
          <h2 className="mt-2 font-display text-2xl font-light sm:text-3xl">
            Customers{' '}
            <span className="font-mono text-base text-muted-foreground">({customers.length})</span>
          </h2>
        </div>
      </div>

      <DevPlaceholder title="Derived from orders" compact>
        This roster is computed from order history (dev data) — a dedicated CRM / accounts service
        arrives with the production rollout.
      </DevPlaceholder>

      {/* top clients strip */}
      {topClients.length > 0 ? (
        <section aria-label="Top clients by lifetime value" className="grid gap-4 sm:grid-cols-3">
          {topClients.map((c, i) => (
            <div key={c.email} className="border border-line bg-card p-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-display text-2xl font-light leading-none text-muted-foreground">
                  {String(i + 1).padStart(2, '0')}
                </p>
                <p className="font-mono text-sm tabular-nums">{formatNaira(c.lifetimeValue)}</p>
              </div>
              <p className="mt-3 truncate text-sm leading-tight">{c.name}</p>
              <p className="truncate text-[0.62rem] text-muted-foreground">
                {c.orderCount} order{c.orderCount === 1 ? '' : 's'} · {c.email}
              </p>
              <div className="mt-3 h-[3px] bg-secondary" aria-hidden>
                <div
                  className="h-full"
                  style={{
                    width: topLtv > 0 ? `${Math.max(6, Math.round((c.lifetimeValue / topLtv) * 100))}%` : '0%',
                    background: 'var(--chart-1)',
                  }}
                />
              </div>
            </div>
          ))}
        </section>
      ) : null}

      {/* table */}
      <div className="border border-line bg-card">
        {customers.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <p className="font-display text-lg font-light italic text-muted-foreground">
              No customers yet — the clientele builds with the first orders.
            </p>
          </div>
        ) : (
          <div className="max-h-[64vh] overflow-y-auto scroll-elegant">
            <Table>
              <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-card">
                <TableRow className="hover:bg-transparent">
                  <TableHead scope="col" className="pl-4 sm:pl-5">Customer</TableHead>
                  <TableHead scope="col" className="text-right">Orders</TableHead>
                  <TableHead scope="col" className="text-right">Lifetime value</TableHead>
                  <TableHead scope="col" className="pr-4 text-right sm:pr-5">Last order</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((c) => (
                  <TableRow key={c.email}>
                    <TableCell className="max-w-56 py-3 pl-4 sm:pl-5">
                      <p className="truncate text-sm leading-tight">{c.name}</p>
                      <p className="truncate text-[0.66rem] text-muted-foreground">{c.email}</p>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums">
                      {c.orderCount}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-right font-mono text-xs tabular-nums',
                        c.lifetimeValue >= 500_000 ? 'font-semibold text-espresso' : 'text-foreground',
                      )}
                    >
                      {formatNaira(c.lifetimeValue)}
                    </TableCell>
                    <TableCell className="pr-4 text-right text-[0.66rem] text-muted-foreground sm:pr-5">
                      {c.lastOrderAt ? formatDateShort(c.lastOrderAt) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}
