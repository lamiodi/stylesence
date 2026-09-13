'use client'

/**
 * Admin — Newsletter subscribers panel.
 * Elegant roster table with a client-side CSV export
 * (ESP synchronisation is a labelled dev placeholder).
 */
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Download, Mail } from 'lucide-react'
import { formatDate } from '@/lib/money'
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
interface Subscriber {
  id: string
  email: string
  source: string
  createdAt: string
}

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  const body = (await res.json().catch(() => ({}))) as { error?: string }
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`)
  return body as T
}

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

/* ------------------------------------------------------------------ *
 * Panel
 * ------------------------------------------------------------------ */
export function SubscribersManager() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'subscribers'],
    queryFn: () => jsonFetch<{ subscribers: Subscriber[] }>('/api/admin/subscribers'),
    retry: false,
    staleTime: 60_000,
  })

  if (isLoading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading subscribers">
        <Skeleton className="h-16 rounded-none border border-line" />
        <Skeleton className="h-[50vh] rounded-none border border-line" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="border border-destructive/40 bg-destructive/5 p-6" role="alert">
        <p className="eyebrow text-destructive">Could not load subscribers</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {error instanceof Error ? error.message : 'Failed to load subscribers'}
        </p>
        <Button variant="outline" size="sm" className="mt-4 border-line-strong" onClick={() => void refetch()}>
          Try again
        </Button>
      </div>
    )
  }

  const subscribers = data.subscribers

  const exportCsv = () => {
    if (subscribers.length === 0) {
      toast.error('No subscribers to export yet.')
      return
    }
    const rows = [
      ['email', 'source', 'joined_at'],
      ...subscribers.map((s) => [s.email, s.source, s.createdAt] as string[]),
    ]
    const csv = rows.map((r) => r.map(csvEscape).join(',')).join('\n')
    const url = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`
    const link = document.createElement('a')
    link.href = url
    link.download = `stylesence-subscribers-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    toast.success(`Exported ${subscribers.length} subscribers as CSV.`)
  }

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Audience</p>
          <h2 className="mt-2 font-display text-2xl font-light sm:text-3xl">
            Subscribers{' '}
            <span className="font-mono text-base text-muted-foreground">({subscribers.length})</span>
          </h2>
        </div>
        <Button
          variant="outline"
          className="border-line-strong uppercase tracking-[0.16em] text-[0.62rem]"
          onClick={exportCsv}
          aria-label={`Export ${subscribers.length} subscribers as CSV`}
        >
          <Download className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
          Export CSV
        </Button>
      </div>

      <DevPlaceholder title="ESP sync pending" compact>
        Email service provider synchronisation is not wired yet — export is generated client-side
        from dev data.
      </DevPlaceholder>

      {/* table */}
      <div className="border border-line bg-card">
        {subscribers.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <Mail className="mx-auto h-5 w-5 text-muted-foreground" strokeWidth={1.5} aria-hidden />
            <p className="mt-3 font-display text-lg font-light italic text-muted-foreground">
              The list is empty — no subscribers yet.
            </p>
          </div>
        ) : (
          <div className="max-h-[64vh] overflow-y-auto scroll-elegant">
            <Table>
              <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-card">
                <TableRow className="hover:bg-transparent">
                  <TableHead scope="col" className="pl-4 sm:pl-5">Email</TableHead>
                  <TableHead scope="col">Source</TableHead>
                  <TableHead scope="col" className="pr-4 text-right sm:pr-5">Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscribers.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="pl-4 py-3 sm:pl-5">
                      <a
                        href={`mailto:${s.email}`}
                        className="link-underline font-mono text-sm tabular-nums"
                      >
                        {s.email}
                      </a>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-[3px] border border-line-strong px-2 py-0.5 text-[0.58rem] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                        {s.source}
                      </span>
                    </TableCell>
                    <TableCell className="pr-4 text-right text-[0.66rem] text-muted-foreground sm:pr-5">
                      {formatDate(s.createdAt)}
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
