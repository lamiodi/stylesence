import { Clock3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/money'
import type { JournalCard } from '@/lib/types'

/** Issue numbering in the editorial style — "№ 01" for index 0. */
export function issueNo(index: number): string {
  return `№ ${String(index + 1).padStart(2, '0')}`
}

/**
 * Monospace reading meta row — clock icon, reading time, publication date.
 * Shared by the journal index and the home journal section so both surfaces
 * speak the same meta language.
 */
export function ReadingMeta({ post, className }: { post: JournalCard; className?: string }) {
  return (
    <p
      className={cn(
        'flex flex-wrap items-center gap-2 font-mono text-[0.66rem] uppercase tracking-[0.12em] text-muted-foreground/80',
        className,
      )}
    >
      <Clock3 className="h-3 w-3 shrink-0 text-muted-foreground/60" strokeWidth={1.5} aria-hidden />
      <span className="tabular-nums">{post.readTime} min read</span>
      <span className="text-muted-foreground/40" aria-hidden>
        ·
      </span>
      <span>{formatDate(post.publishedAt)}</span>
    </p>
  )
}
