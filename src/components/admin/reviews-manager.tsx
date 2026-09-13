'use client'

/**
 * Admin — Reviews moderation panel.
 * Tabbed queue (Pending / Approved / Rejected / All) with counts,
 * editorial review cards and approve / reject / delete actions.
 */
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Check, Star, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/money'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

/* ------------------------------------------------------------------ *
 * Types (API contract)
 * ------------------------------------------------------------------ */
type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

interface AdminReview {
  id: string
  author: string
  email: string
  rating: number
  title: string
  body: string
  status: ReviewStatus
  createdAt: string
  productName: string
  productSlug: string
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
const REVIEW_STATUS_STYLES: Record<string, string> = {
  PENDING: 'border-espresso/35 bg-espresso/10 text-espresso',
  APPROVED: 'border-[oklch(0.55_0.08_140)]/45 bg-[oklch(0.55_0.08_140)]/10 text-[oklch(0.55_0.08_140)]',
  REJECTED: 'border-destructive/45 bg-destructive/10 text-destructive',
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-[3px] border px-2 py-0.5 text-[0.58rem] font-medium uppercase tracking-[0.16em]',
        REVIEW_STATUS_STYLES[status] ?? 'border-line-strong text-muted-foreground',
      )}
    >
      {status}
    </span>
  )
}

function PanelError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="border border-destructive/40 bg-destructive/5 p-6" role="alert">
      <p className="eyebrow text-destructive">Could not load reviews</p>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      <Button variant="outline" size="sm" className="mt-4 border-line-strong" onClick={onRetry}>
        Try again
      </Button>
    </div>
  )
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            'h-3.5 w-3.5',
            i < rating ? 'fill-espresso text-espresso' : 'text-line-strong',
          )}
          strokeWidth={1.5}
          aria-hidden
        />
      ))}
    </span>
  )
}

/* ------------------------------------------------------------------ *
 * Review card
 * ------------------------------------------------------------------ */
function ReviewCard({
  review,
  onSetStatus,
  onDelete,
  busy,
}: {
  review: AdminReview
  onSetStatus: (id: string, status: ReviewStatus) => void
  onDelete: (review: AdminReview) => void
  busy: boolean
}) {
  return (
    <article className="border border-line bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <Stars rating={review.rating} />
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {review.rating}.0
            </span>
          </div>
          <h3 className="mt-2 font-display text-lg font-light leading-snug">{review.title}</h3>
        </div>
        <StatusBadge status={review.status} />
      </div>

      <p className="mt-2.5 text-sm leading-relaxed text-foreground/90">{review.body}</p>

      <p className="mt-3 text-[0.66rem] leading-relaxed text-muted-foreground">
        By {review.author} · {formatDate(review.createdAt)} · on{' '}
        <a href={`#/product/${review.productSlug}`} className="link-underline text-foreground/80">
          {review.productName}
        </a>
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
        {review.status === 'PENDING' ? (
          <>
            <Button
              size="sm"
              className="h-8 uppercase tracking-[0.14em] text-[0.6rem]"
              disabled={busy}
              onClick={() => onSetStatus(review.id, 'APPROVED')}
              aria-label={`Approve review by ${review.author}`}
            >
              <Check className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 border-line-strong uppercase tracking-[0.14em] text-[0.6rem]"
              disabled={busy}
              onClick={() => onSetStatus(review.id, 'REJECTED')}
              aria-label={`Reject review by ${review.author}`}
            >
              <X className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
              Reject
            </Button>
          </>
        ) : null}
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto h-8 text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground hover:text-destructive"
          onClick={() => onDelete(review)}
          aria-label={`Delete review by ${review.author}`}
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
          Delete
        </Button>
      </div>
    </article>
  )
}

/* ------------------------------------------------------------------ *
 * Panel
 * ------------------------------------------------------------------ */
export function ReviewsManager() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<string>('PENDING')
  const [deleteTarget, setDeleteTarget] = useState<AdminReview | null>(null)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'reviews'],
    queryFn: () => jsonFetch<{ reviews: AdminReview[] }>('/api/admin/reviews'),
    retry: false,
    staleTime: 30_000,
  })

  const reviews = data?.reviews ?? []
  const counts = {
    PENDING: reviews.filter((r) => r.status === 'PENDING').length,
    APPROVED: reviews.filter((r) => r.status === 'APPROVED').length,
    REJECTED: reviews.filter((r) => r.status === 'REJECTED').length,
    ALL: reviews.length,
  }

  const invalidateReviews = () => {
    void qc.invalidateQueries({ queryKey: ['admin', 'reviews'] })
    void qc.invalidateQueries({ queryKey: ['admin', 'stats'] })
    void qc.invalidateQueries({ queryKey: ['admin', 'products'] })
    void qc.invalidateQueries({ queryKey: ['product'] })
    void qc.invalidateQueries({ queryKey: ['shop'] })
  }

  const patchMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ReviewStatus }) =>
      jsonFetch<{ review: AdminReview }>(`/api/admin/reviews/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onSuccess: (_review, vars) => {
      const author = reviews.find((r) => r.id === vars.id)?.author ?? 'The customer'
      toast.success(`Review by ${author} ${vars.status.toLowerCase()}.`)
      invalidateReviews()
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Could not update the review.')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => jsonFetch<{ ok: boolean }>(`/api/admin/reviews/${id}`, { method: 'DELETE' }),
    onSuccess: (_ok, id) => {
      const author = reviews.find((r) => r.id === id)?.author ?? 'The customer'
      toast.success(`Review by ${author} deleted.`)
      setDeleteTarget(null)
      invalidateReviews()
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Could not delete the review.')
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading reviews">
        <Skeleton className="h-12 rounded-none border border-line" />
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-none border border-line" />
          ))}
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <PanelError
        message={error instanceof Error ? error.message : 'Failed to load reviews'}
        onRetry={() => void refetch()}
      />
    )
  }

  const filtered =
    tab === 'ALL' ? reviews : reviews.filter((r) => r.status === (tab as ReviewStatus))

  const list = (items: AdminReview[]) =>
    items.length === 0 ? (
      <div className="border border-line bg-card px-5 py-16 text-center">
        <p className="font-display text-lg font-light italic text-muted-foreground">
          {tab === 'PENDING'
            ? 'Inbox zero — no reviews awaiting moderation.'
            : 'No reviews in this queue.'}
        </p>
      </div>
    ) : (
      <div className="grid gap-4 lg:grid-cols-2">
        {items.map((r) => (
          <ReviewCard
            key={r.id}
            review={r}
            onSetStatus={(id, status) => patchMutation.mutate({ id, status })}
            onDelete={setDeleteTarget}
            busy={patchMutation.isPending && patchMutation.variables?.id === r.id}
          />
        ))}
      </div>
    )

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Community</p>
          <h2 className="mt-2 font-display text-2xl font-light sm:text-3xl">
            Reviews{' '}
            <span className="font-mono text-base text-muted-foreground">({reviews.length})</span>
          </h2>
        </div>
        {counts.PENDING > 0 ? (
          <p className="border border-espresso/35 bg-espresso/10 px-3 py-1.5 text-[0.62rem] font-medium uppercase tracking-[0.16em] text-espresso">
            {counts.PENDING} awaiting moderation
          </p>
        ) : null}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto w-full justify-start gap-1 rounded-none border border-line bg-card p-1 sm:w-fit">
          {(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as const).map((t) => (
            <TabsTrigger
              key={t}
              value={t}
              className="rounded-none px-3 py-1.5 text-[0.62rem] font-medium uppercase tracking-[0.16em] data-[state=active]:bg-foreground data-[state=active]:text-background"
            >
              {t === 'ALL' ? 'All' : t === 'PENDING' ? 'Pending' : t === 'APPROVED' ? 'Approved' : 'Rejected'}
              <span className="ml-1.5 font-mono text-[0.62rem] tabular-nums opacity-70">
                {counts[t]}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="PENDING" className="mt-6">
          {list(filtered)}
        </TabsContent>
        <TabsContent value="APPROVED" className="mt-6">
          {list(filtered)}
        </TabsContent>
        <TabsContent value="REJECTED" className="mt-6">
          {list(filtered)}
        </TabsContent>
        <TabsContent value="ALL" className="mt-6">
          {list(filtered)}
        </TabsContent>
      </Tabs>

      {/* delete confirmation */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="border-line bg-background">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-xl font-light">
              Delete this review?
            </AlertDialogTitle>
            <AlertDialogDescription>
              “{deleteTarget?.title ?? ''}” by {deleteTarget?.author ?? ''} on{' '}
              {deleteTarget?.productName ?? ''} will be permanently removed. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-line-strong uppercase tracking-[0.16em] text-[0.62rem]">
              Keep review
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white uppercase tracking-[0.16em] text-[0.62rem] hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
