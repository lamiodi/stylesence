'use client'

/**
 * Admin — Back-in-stock waitlist panel.
 * Consolidated StockAlert roster: summary tiles, status filter tabs
 * (Waiting / Notified / All), hairline table with a client-side CSV
 * export (notification emails are simulated — labelled dev placeholder).
 */
import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Bell, Check, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDate, formatDateShort } from '@/lib/money'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { DevPlaceholder } from '@/components/site/dev-placeholder'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

/* ------------------------------------------------------------------ *
 * Types (API contract — GET /api/admin/waitlist)
 * ------------------------------------------------------------------ */
type WaitlistTab = 'pending' | 'notified' | 'all'

interface WaitlistRow {
  id: string
  email: string
  createdAt: string
  notifiedAt: string | null
  productName: string
  productSlug: string
  productActive: boolean
  variantId: string
  size: string
  color: string
  stock: number
}

interface WaitlistSummary {
  total: number
  pending: number
  notified: number
  uniqueEmails: number
}

interface WaitlistResponse {
  waitlist: WaitlistRow[]
  summary: WaitlistSummary
  /** Present only when the applicable set exceeded the server's 500-row cap. */
  truncated?: boolean
}

const TABS: { value: WaitlistTab; label: string }[] = [
  { value: 'pending', label: 'Waiting' },
  { value: 'notified', label: 'Notified' },
  { value: 'all', label: 'All' },
]

const EMPTY_COPY: Record<WaitlistTab, string> = {
  pending: 'No one is waiting — sold-out pieces with waitlists appear here.',
  notified: 'Nothing sent yet — restock a sold-out variant to notify its list.',
  all: 'The waitlist is empty — no back-in-stock requests yet.',
}

async function jsonFetch<T>(url: string): Promise<T> {
  const res = await fetch(url)
  const body = (await res.json().catch(() => ({}))) as { error?: string }
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`)
  return body as T
}

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

/* ------------------------------------------------------------------ *
 * Small shared pieces
 * ------------------------------------------------------------------ */
function PanelError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="border border-destructive/40 bg-destructive/5 p-6" role="alert">
      <p className="eyebrow text-destructive">Could not load the waitlist</p>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      <Button variant="outline" size="sm" className="mt-4 border-line-strong" onClick={onRetry}>
        Try again
      </Button>
    </div>
  )
}

/** Summary strip tile — mono numeral on a hairline cell. */
function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-card px-4 py-4 sm:px-5">
      <p className="eyebrow !text-[0.55rem]">{label}</p>
      <p className="mt-2 font-mono text-lg tabular-nums leading-none">{value}</p>
    </div>
  )
}

/** WAITING — charcoal outline; NOTIFIED — muted with a check. No colour extremes. */
function StatusChip({ notified }: { notified: string | null }) {
  return notified ? (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-[3px] border border-line-strong px-2 py-0.5 text-[0.58rem] font-medium uppercase tracking-[0.16em] text-muted-foreground">
      Notified
      <Check className="h-3 w-3" strokeWidth={1.5} aria-hidden />
    </span>
  ) : (
    <span className="inline-flex shrink-0 items-center rounded-[3px] border border-foreground/45 px-2 py-0.5 text-[0.58rem] font-medium uppercase tracking-[0.16em] text-foreground">
      Waiting
    </span>
  )
}

/* ------------------------------------------------------------------ *
 * Panel
 * ------------------------------------------------------------------ */
export function WaitlistManager() {
  const [tab, setTab] = useState<WaitlistTab>('pending')

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'waitlist', tab],
    queryFn: () =>
      jsonFetch<WaitlistResponse>(
        tab === 'all' ? '/api/admin/waitlist' : `/api/admin/waitlist?status=${tab}`,
      ),
    retry: false,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  })

  if (isLoading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading waitlist">
        <Skeleton className="h-16 rounded-none border border-line" />
        <Skeleton className="h-20 rounded-none border border-line" />
        <Skeleton className="h-11 rounded-none border border-line" />
        <Skeleton className="h-[50vh] rounded-none border border-line" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <PanelError
        message={error instanceof Error ? error.message : 'Failed to load the waitlist'}
        onRetry={() => void refetch()}
      />
    )
  }

  const rows = data.waitlist
  const summary = data.summary
  const tabLabel = TABS.find((t) => t.value === tab)?.label ?? 'All'
  const applicableTotal =
    tab === 'pending' ? summary.pending : tab === 'notified' ? summary.notified : summary.total

  const exportCsv = () => {
    if (rows.length === 0) {
      toast.error('No waitlist requests to export yet.')
      return
    }
    const csvRows = [
      ['email', 'piece', 'product_slug', 'variant', 'stock_now', 'requested_at', 'notified_at', 'status'],
      ...rows.map((r) =>
        [
          r.email,
          r.productName,
          r.productSlug,
          `${r.color} · ${r.size}`,
          String(r.stock),
          r.createdAt,
          r.notifiedAt ?? '',
          r.notifiedAt ? 'NOTIFIED' : 'WAITING',
        ] as string[],
      ),
    ]
    const csv = csvRows.map((r) => r.map(csvEscape).join(',')).join('\n')
    const url = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`
    const link = document.createElement('a')
    link.href = url
    link.download = `waitlist-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    const scope = tab === 'all' ? '' : ` ${tabLabel.toLowerCase()}`
    toast.success(`Exported ${rows.length}${scope} request${rows.length === 1 ? '' : 's'} as CSV.`)
  }

  const tableBlock = (
    <div className="space-y-2">
      {/* meta line — currently-applied filter */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground">
          {tabLabel} · {rows.length} of {applicableTotal} requests
        </p>
        {data.truncated ? (
          <p className="text-[0.62rem] font-medium uppercase tracking-[0.16em] text-espresso">
            First 500 shown — refine with a filter
          </p>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <div className="border border-line bg-card px-5 py-16 text-center">
          <Bell className="mx-auto h-5 w-5 text-muted-foreground" strokeWidth={1.5} aria-hidden />
          <p className="mt-3 font-display text-lg font-light italic text-muted-foreground">
            {EMPTY_COPY[tab]}
          </p>
        </div>
      ) : (
        <div
          className={cn('border border-line bg-card transition-opacity', isFetching && 'opacity-60')}
          aria-busy={isFetching}
        >
          <div className="max-h-[64vh] overflow-y-auto scroll-elegant">
            <Table>
              <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-card">
                <TableRow className="hover:bg-transparent">
                  <TableHead scope="col" className="pl-4 sm:pl-5">Email</TableHead>
                  <TableHead scope="col">Piece</TableHead>
                  <TableHead scope="col">Variant</TableHead>
                  <TableHead scope="col" className="text-right">Stock now</TableHead>
                  <TableHead scope="col" className="text-right">Requested</TableHead>
                  <TableHead scope="col" className="pr-4 text-right sm:pr-5">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} className="transition-colors hover:bg-secondary/50">
                    <TableCell className="pl-4 py-3 sm:pl-5">
                      <a
                        href={`mailto:${r.email}`}
                        className="link-underline font-mono text-sm tabular-nums"
                      >
                        {r.email}
                      </a>
                    </TableCell>
                    <TableCell>
                      <a
                        href={`#/product/${r.productSlug}`}
                        className="link-underline text-foreground/90"
                      >
                        {r.productName}
                      </a>
                      {r.productActive ? null : (
                        <span className="ml-2 inline-flex items-center rounded-[3px] border border-espresso/35 bg-espresso/10 px-1.5 py-0.5 text-[0.56rem] font-medium uppercase tracking-[0.14em] text-espresso">
                          Retired
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {r.color} · {r.size}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums">
                      {r.stock === 0 ? (
                        <span className="font-medium text-espresso" title="Still sold out">
                          0<span className="sr-only"> — still sold out</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">{r.stock}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-[0.66rem] text-muted-foreground">
                      {formatDate(r.createdAt)}
                    </TableCell>
                    <TableCell className="pr-4 sm:pr-5">
                      <div className="flex flex-col items-end gap-1">
                        <StatusChip notified={r.notifiedAt} />
                        {r.notifiedAt ? (
                          <span className="text-[0.6rem] text-muted-foreground">
                            {formatDateShort(r.notifiedAt)}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Back in stock</p>
          <h2 className="mt-2 font-display text-2xl font-light sm:text-3xl">
            Waitlist{' '}
            <span className="font-mono text-base text-muted-foreground">({summary.total})</span>
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Everyone waiting on a sold-out size. Restock a variant from Products and its list is
            notified automatically.
          </p>
        </div>
        <Button
          variant="outline"
          className="border-line-strong uppercase tracking-[0.16em] text-[0.62rem]"
          onClick={exportCsv}
          aria-label={`Export ${rows.length} waitlist request${rows.length === 1 ? '' : 's'} as CSV`}
        >
          <Download className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
          Export CSV
        </Button>
      </div>

      {/* summary strip */}
      <section
        className="grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-4"
        aria-label="Waitlist summary"
      >
        <Stat label="Total requests" value={summary.total} />
        <Stat label="Still waiting" value={summary.pending} />
        <Stat label="Notified" value={summary.notified} />
        <Stat label="Unique emails" value={summary.uniqueEmails} />
      </section>

      <DevPlaceholder title="Simulated notifications" compact>
        Notification emails are simulated in this dev preview — notifiedAt marks when a restock
        would have triggered them.
      </DevPlaceholder>

      {/* status filter + table */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as WaitlistTab)}>
        <TabsList className="h-auto w-full justify-start gap-1 rounded-none border border-line bg-card p-1 sm:w-fit">
          {TABS.map(({ value, label }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="rounded-none px-3 py-1.5 text-[0.62rem] font-medium uppercase tracking-[0.16em] data-[state=active]:bg-foreground data-[state=active]:text-background"
            >
              {label}
              <span className="ml-1.5 font-mono text-[0.62rem] tabular-nums opacity-70">
                {value === 'pending'
                  ? summary.pending
                  : value === 'notified'
                    ? summary.notified
                    : summary.total}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="pending" className="mt-6">
          {tableBlock}
        </TabsContent>
        <TabsContent value="notified" className="mt-6">
          {tableBlock}
        </TabsContent>
        <TabsContent value="all" className="mt-6">
          {tableBlock}
        </TabsContent>
      </Tabs>
    </div>
  )
}
