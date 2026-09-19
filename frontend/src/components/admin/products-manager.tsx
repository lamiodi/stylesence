'use client'

/**
 * Admin — Products panel.
 * Catalogue table with live active/featured toggles (optimistic PATCH),
 * search + category filters, and create/edit dialogs incl. a repeatable
 * variant editor (create) and per-variant stock editing (edit).
 */
import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ChevronDown, ChevronUp, Loader2, Package, Pencil, Plus, Search, Sparkles, Trash2, Upload, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatNaira, formatDateShort } from '@/lib/money'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
interface AdminVariant {
  id: string
  size: string
  color: string
  colorHex: string | null
  sku: string
  stock: number
  /** Un-notified back-in-stock waitlist signups for this variant (list endpoint). */
  waitingCount?: number
}

interface AdminProduct {
  id: string
  slug: string
  name: string
  subtitle: string | null
  description: string
  details: string | null
  material: string | null
  care: string | null
  price: number
  compareAtPrice: number | null
  category: { slug: string; name: string } | null
  isActive: boolean
  isFeatured: boolean
  createdAt: string
  stock: number
  reviewCount: number
  /** Curated "Complete the look" piece slugs, in display order. */
  curatedRelated: string[]
  images: { url: string; alt: string | null; position: number }[]
  variants: AdminVariant[]
}

interface CategoryInfo {
  id: string
  slug: string
  name: string
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
function PanelError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="border border-destructive/40 bg-destructive/5 p-6" role="alert">
      <p className="eyebrow text-destructive">Could not load the catalogue</p>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      <Button variant="outline" size="sm" className="mt-4 border-line-strong" onClick={onRetry}>
        Try again
      </Button>
    </div>
  )
}

function HexSwatch({ hex }: { hex: string }) {
  const valid = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex.trim())
  return (
    <span
      className="h-3.5 w-3.5 shrink-0 border border-line-strong"
      style={{ background: valid ? hex.trim() : 'transparent' }}
      aria-hidden
    />
  )
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string
  htmlFor: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="eyebrow">
        {label}
      </Label>
      {children}
      {hint ? <p className="text-[0.62rem] leading-snug text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Variant editor rows
 * ------------------------------------------------------------------ */
interface VariantRow {
  id?: string
  size: string
  color: string
  colorHex: string
  stock: string
  /** Un-notified waitlist count (edit mode only — informational). */
  waitingCount?: number
}

const DEFAULT_VARIANT_ROWS: VariantRow[] = ['XS', 'S', 'M', 'L', 'XL'].map((size) => ({
  size,
  color: 'Ivory',
  colorHex: '#EDE7DC',
  stock: '10',
}))

function VariantEditor({
  variants,
  onChange,
  editable,
}: {
  variants: VariantRow[]
  onChange: (rows: VariantRow[]) => void
  editable: boolean
}) {
  const update = (i: number, patch: Partial<VariantRow>) => {
    onChange(variants.map((v, idx) => (idx === i ? { ...v, ...patch } : v)))
  }

  return (
    <div className="space-y-2">
      <div
        className={cn(
          'grid items-center gap-2 text-[0.58rem] font-medium uppercase tracking-[0.18em] text-muted-foreground',
          editable ? 'grid-cols-[3.75rem_1fr_5.25rem_4.25rem_1.75rem]' : 'grid-cols-[3.75rem_1fr_4.25rem]',
        )}
        aria-hidden
      >
        <span>Size</span>
        <span>Colour</span>
        {editable ? <span>Hex</span> : null}
        <span className="text-right">Stock</span>
        <span />
      </div>
      {variants.map((v, i) => (
        <div
          key={v.id ?? `new-${i}`}
          className={cn(
            'grid items-center gap-2',
            editable ? 'grid-cols-[3.75rem_1fr_5.25rem_4.25rem_1.75rem]' : 'grid-cols-[3.75rem_1fr_4.25rem]',
          )}
        >
          {editable ? (
            <Input
              value={v.size}
              onChange={(e) => update(i, { size: e.target.value })}
              aria-label={`Variant ${i + 1} size`}
              className="h-9 border-line-strong"
              placeholder="S"
            />
          ) : (
            <p className="font-mono text-sm">{v.size}</p>
          )}
          {editable ? (
            <Input
              value={v.color}
              onChange={(e) => update(i, { color: e.target.value })}
              aria-label={`Variant ${i + 1} colour`}
              className="h-9 border-line-strong"
              placeholder="Ivory"
            />
          ) : (
            <p className="flex items-center gap-2 truncate text-sm">
              <HexSwatch hex={v.colorHex} />
              {v.color}
              {(v.waitingCount ?? 0) > 0 ? (
                <span
                  className="shrink-0 border border-line px-1.5 py-0.5 font-mono text-[0.58rem] tracking-[0.08em] text-muted-foreground"
                  aria-label={`${v.waitingCount} waitlist customer${v.waitingCount === 1 ? '' : 's'} waiting for ${v.color} ${v.size} to return`}
                  title={`${v.waitingCount} waitlist signup${v.waitingCount === 1 ? '' : 's'} — notified when this size is restocked`}
                >
                  {v.waitingCount} waiting
                </span>
              ) : null}
            </p>
          )}
          {editable ? (
            <div className="flex items-center gap-1.5">
              <HexSwatch hex={v.colorHex} />
              <Input
                value={v.colorHex}
                onChange={(e) => update(i, { colorHex: e.target.value })}
                aria-label={`Variant ${i + 1} colour hex`}
                className="h-9 border-line-strong font-mono text-xs"
                placeholder="#EDE7DC"
              />
            </div>
          ) : null}
          <div className="flex justify-end">
            <Input
              type="number"
              min={0}
              value={v.stock}
              onChange={(e) => update(i, { stock: e.target.value })}
              aria-label={`Variant ${i + 1} stock`}
              className="h-9 w-20 border-line-strong text-right font-mono tabular-nums"
            />
          </div>
          {editable ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => onChange(variants.filter((_, idx) => idx !== i))}
              aria-label={`Remove variant ${i + 1}`}
            >
              <X className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
            </Button>
          ) : (
            <span />
          )}
        </div>
      ))}
      {editable ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-dashed border-line-strong text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground"
          onClick={() => onChange([...variants, { size: '', color: '', colorHex: '', stock: '0' }])}
        >
          <Plus className="h-3 w-3" strokeWidth={1.5} aria-hidden />
          Add variant
        </Button>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Curated "Complete the look" editor (edit dialog only)
 * ------------------------------------------------------------------ */
function RelatedPiecesEditor({
  relatedSlugs,
  catalogue,
  currentSlug,
  onChange,
}: {
  relatedSlugs: string[]
  catalogue: AdminProduct[]
  currentSlug: string
  onChange: (slugs: string[]) => void
}) {
  const addRelated = (slug: string) => {
    if (!relatedSlugs.includes(slug) && relatedSlugs.length < 8) onChange([...relatedSlugs, slug])
  }
  // Controlled with "" (Radix: empty value clears the selection → placeholder).
  const [addValue, setAddValue] = useState('')
  const handleAdd = (slug: string) => {
    addRelated(slug)
    setAddValue('')
  }

  const moveRelated = (index: number, delta: -1 | 1) => {
    const target = index + delta
    if (target < 0 || target >= relatedSlugs.length) return
    const next = [...relatedSlugs]
    const [moved] = next.splice(index, 1)
    next.splice(target, 0, moved)
    onChange(next)
  }

  const addable = catalogue.filter(
    (p) => p.isActive && p.slug !== currentSlug && !relatedSlugs.includes(p.slug),
  )
  const atLimit = relatedSlugs.length >= 8

  return (
    <div className="space-y-3">
      <div>
        <p className="eyebrow">Complete the look — curated pieces, in order</p>
        <p className="mt-1.5 text-[0.62rem] leading-snug text-muted-foreground">
          Shown as “Complete the look” on the piece’s page, in this order — up to 8. Pieces hidden from the
          shop are skipped there, and any unfilled slots fall back to the same category.
        </p>
      </div>

      {relatedSlugs.length === 0 ? (
        <p className="border border-dashed border-line-strong px-4 py-5 text-center text-sm italic text-muted-foreground">
          No curated pieces yet — the product page shows the automatic fallback.
        </p>
      ) : (
        <ul className="max-h-72 divide-y divide-line overflow-y-auto border border-line scroll-elegant">
          {relatedSlugs.map((slug, i) => {
            const piece = catalogue.find((p) => p.slug === slug)
            const label = piece?.name ?? slug
            return (
              <li key={slug} className="flex items-center gap-2.5 px-3 py-2 sm:gap-3 sm:px-4">
                <span
                  className="w-6 shrink-0 font-mono text-[0.68rem] tabular-nums text-muted-foreground"
                  aria-hidden
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm leading-snug" title={label}>
                    {label}
                    {piece && !piece.isActive ? (
                      <span className="ml-1.5 align-middle text-[0.58rem] uppercase tracking-[0.14em] text-espresso">
                        hidden
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 truncate font-mono text-[0.68rem] tabular-nums text-muted-foreground">
                    {piece ? `${formatNaira(piece.price)} · ${piece.category?.name ?? 'No category'}` : slug}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-11 w-11 border-line"
                    disabled={i === 0}
                    onClick={() => moveRelated(i, -1)}
                    aria-label={`Move ${label} up in the look`}
                  >
                    <ChevronUp className="h-4 w-4" strokeWidth={1.5} aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-11 w-11 border-line"
                    disabled={i === relatedSlugs.length - 1}
                    onClick={() => moveRelated(i, 1)}
                    aria-label={`Move ${label} down in the look`}
                  >
                    <ChevronDown className="h-4 w-4" strokeWidth={1.5} aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-11 w-11 border-line hover:border-destructive hover:text-destructive"
                    onClick={() => onChange(relatedSlugs.filter((s) => s !== slug))}
                    aria-label={`Remove ${label} from the look`}
                  >
                    <X className="h-4 w-4" strokeWidth={1.5} aria-hidden />
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <Field
        label="Add piece"
        htmlFor="pf-related-add"
        hint={atLimit ? 'Eight pieces is the limit for one look.' : undefined}
      >
        <Select value={addValue} onValueChange={handleAdd}>
          <SelectTrigger
            id="pf-related-add"
            className="h-10 w-full border-line-strong"
            disabled={atLimit || addable.length === 0}
            aria-label="Add a piece to the look"
          >
            <SelectValue
              placeholder={
                atLimit
                  ? 'Look is full — 8 pieces'
                  : addable.length === 0
                    ? 'No more active pieces to add'
                    : 'Choose a piece to add…'
              }
            />
          </SelectTrigger>
          <SelectContent>
            {addable.map((p) => (
              <SelectItem key={p.slug} value={p.slug}>
                {p.name} — {formatNaira(p.price)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Atelier image studio — AI-generated editorial imagery (create dialog)
 * ------------------------------------------------------------------ */
const STUDIO_SIZES = [
  { value: '864x1152', label: 'Portrait 3:4 — cards' },
  { value: '1024x1024', label: 'Square 1:1' },
  { value: '1152x864', label: 'Landscape 4:3 — editorial' },
] as const

function ImageStudio({ onGenerated }: { onGenerated: (url: string) => void }) {
  const [prompt, setPrompt] = useState('')
  const [size, setSize] = useState<string>('864x1152')
  const [lastUrl, setLastUrl] = useState<string | null>(null)

  const generate = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim(), size }),
      })
      const body = (await res.json()) as { url?: string; error?: string }
      if (!res.ok || !body.url) throw new Error(body.error ?? 'Image generation failed')
      return body.url
    },
    onSuccess: (url) => {
      setLastUrl(url)
      onGenerated(url)
      toast.success('Image generated and added to the list.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const onGenerate = () => {
    if (prompt.trim().length < 8) {
      toast.error('Describe the image first — at least a short phrase.')
      return
    }
    generate.mutate()
  }

  return (
    <div className="border border-dashed border-line-strong bg-secondary/40 p-3">
      <p className="eyebrow flex items-center gap-1.5">
        <Sparkles className="h-3 w-3 text-espresso" strokeWidth={1.5} aria-hidden />
        Atelier image studio
      </p>
      <p className="mt-1 text-[0.62rem] leading-snug text-muted-foreground">
        Describe the shot — the house style (ivory studio light, muted palette, editorial mood) is
        applied automatically. Each image takes a few seconds.
      </p>
      <Textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="e.g. Full-length photograph of a model wearing a flowing ivory pleated maxi skirt in gentle motion"
        className="mt-2.5 min-h-16 border-line-strong text-xs"
        aria-label="Image description for the atelier studio"
      />
      <div className="mt-2.5 flex flex-col gap-2 sm:flex-row">
        <Select value={size} onValueChange={setSize}>
          <SelectTrigger
            className="h-11 border-line-strong text-xs sm:w-52"
            aria-label="Image proportions"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STUDIO_SIZES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          onClick={onGenerate}
          disabled={generate.isPending}
          className="h-11 flex-1 text-[0.66rem] uppercase tracking-[0.18em]"
        >
          {generate.isPending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} aria-hidden />
              Painting…
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
              Generate image
            </>
          )}
        </Button>
      </div>
      {lastUrl ? (
        <div className="mt-3 flex items-center gap-3 border-t border-line pt-3">
          <img
            src={lastUrl}
            alt="Last generated image"
            className="h-16 w-12 shrink-0 border border-line object-cover"
          />
          <div className="min-w-0">
            <p className="truncate font-mono text-[0.62rem] text-muted-foreground">{lastUrl}</p>
            <p className="mt-0.5 text-[0.62rem] text-muted-foreground">
              Added to the image list above — generate as many as the piece needs.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Media pipeline — editable product gallery (edit dialog)
 * ------------------------------------------------------------------ */
interface EditableImage {
  url: string
  alt: string
}

function ImagesEditor({
  images,
  onChange,
  nameHint,
}: {
  images: EditableImage[]
  onChange: (images: EditableImage[]) => void
  nameHint: string
}) {
  const [addUrl, setAddUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      add(data.url)
      toast.success('Uploaded to Cloudinary successfully')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed'
      toast.error(msg)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }
  const atLimit = images.length >= 12

  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta
    if (target < 0 || target >= images.length) return
    const next = [...images]
    const [moved] = next.splice(index, 1)
    next.splice(target, 0, moved)
    onChange(next)
  }

  const add = (url: string) => {
    const trimmed = url.trim()
    if (!trimmed) {
      toast.error('Paste an image URL first.')
      return
    }
    if (images.some((img) => img.url === trimmed)) {
      toast.error('That image URL is already in the gallery.')
      return
    }
    if (atLimit) {
      toast.error('Twelve images is the limit for one piece.')
      return
    }
    onChange([...images, { url: trimmed, alt: '' }])
    setAddUrl('')
  }

  const setAlt = (index: number, alt: string) => {
    onChange(images.map((img, i) => (i === index ? { ...img, alt } : img)))
  }

  const remove = (index: number) => {
    if (images.length <= 1) return // a piece always keeps at least one image
    onChange(images.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="eyebrow">Gallery — images, in order</p>
        <p className="mt-1.5 text-[0.62rem] leading-snug text-muted-foreground">
          The first image is the shop card; the rest form the product gallery. Reorder with the
          arrows, refine the alt text, or paint a new one below — a piece always keeps at least
          one image.
        </p>
      </div>

      {images.length === 0 ? (
        <p className="border border-dashed border-line-strong px-4 py-5 text-center text-sm italic text-muted-foreground">
          No images yet — add a URL or paint one with the atelier studio below.
        </p>
      ) : (
        <ul className="max-h-72 divide-y divide-line overflow-y-auto border border-line scroll-elegant">
          {images.map((img, i) => {
            const rowLabel = img.url.split('/').pop() || img.url
            return (
              <li key={`${img.url}-${i}`} className="flex items-center gap-2.5 px-3 py-2.5 sm:gap-3 sm:px-4">
                <span className="w-6 shrink-0 font-mono text-[0.68rem] tabular-nums text-muted-foreground" aria-hidden>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <img
                  src={img.url}
                  alt={img.alt || rowLabel}
                  className="h-16 w-12 shrink-0 border border-line object-cover"
                  loading="lazy"
                />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <p className="truncate font-mono text-[0.68rem] text-muted-foreground" title={img.url}>
                    {img.url}
                  </p>
                  <Input
                    value={img.alt}
                    onChange={(e) => setAlt(i, e.target.value)}
                    placeholder={`Alt text — describes “${nameHint}”`}
                    className="h-9 border-line text-xs"
                    aria-label={`Alt text for image ${i + 1}`}
                    maxLength={200}
                  />
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-11 w-11 border-line"
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                    aria-label={`Move image ${i + 1} up in the gallery`}
                  >
                    <ChevronUp className="h-4 w-4" strokeWidth={1.5} aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-11 w-11 border-line"
                    disabled={i === images.length - 1}
                    onClick={() => move(i, 1)}
                    aria-label={`Move image ${i + 1} down in the gallery`}
                  >
                    <ChevronDown className="h-4 w-4" strokeWidth={1.5} aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-11 w-11 border-line hover:border-destructive hover:text-destructive"
                    disabled={images.length <= 1}
                    onClick={() => remove(i)}
                    aria-label={`Remove image ${i + 1} from the gallery`}
                    title={images.length <= 1 ? 'A piece keeps at least one image' : undefined}
                  >
                    <X className="h-4 w-4" strokeWidth={1.5} aria-hidden />
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={handleFileUpload}
        />
        <Button
          type="button"
          variant="outline"
          className="h-10 shrink-0 border-line-strong uppercase tracking-[0.16em] text-[0.62rem]"
          onClick={() => fileInputRef.current?.click()}
          disabled={atLimit || uploading}
        >
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Upload className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
          )}
          {uploading ? 'Uploading to Cloudinary...' : 'Upload Media to Cloudinary'}
        </Button>
        <Input
          value={addUrl}
          onChange={(e) => setAddUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add(addUrl)
            }
          }}
          placeholder="Or paste media URL (https://res.cloudinary.com/...)"
          className="h-10 border-line-strong font-mono text-xs"
          aria-label="Add an image URL to the gallery"
          disabled={atLimit || uploading}
        />
        <Button
          type="button"
          variant="outline"
          className="h-10 shrink-0 border-line-strong uppercase tracking-[0.16em] text-[0.62rem]"
          onClick={() => add(addUrl)}
          disabled={atLimit || !addUrl.trim() || uploading}
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
          Add
          <span className="sr-only">image by URL</span>
        </Button>
      </div>

      <ImageStudio onGenerated={(url) => add(url)} />
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Create / edit dialog
 * ------------------------------------------------------------------ */
function ProductDialog({
  mode,
  product,
  categories,
  catalogue,
  onOpenChange,
  onSubmit,
  busy,
}: {
  mode: 'create' | 'edit'
  product: AdminProduct | null
  categories: CategoryInfo[]
  catalogue: AdminProduct[]
  onOpenChange: (open: boolean) => void
  onSubmit: (id: string | null, body: Record<string, unknown>) => void
  busy: boolean
}) {
  const initialCategory =
    mode === 'edit' && product?.category
      ? (categories.find((c) => c.slug === product.category?.slug)?.id ?? 'none')
      : 'none'

  const [name, setName] = useState(product?.name ?? '')
  const [slug, setSlug] = useState(product?.slug ?? '')
  const [subtitle, setSubtitle] = useState(product?.subtitle ?? '')
  const [price, setPrice] = useState(product ? String(product.price) : '')
  const [compareAt, setCompareAt] = useState(product?.compareAtPrice != null ? String(product.compareAtPrice) : '')
  const [categoryId, setCategoryId] = useState(initialCategory)
  const [description, setDescription] = useState(product?.description ?? '')
  const [details, setDetails] = useState(product?.details ?? '')
  const [material, setMaterial] = useState(product?.material ?? '')
  const [care, setCare] = useState(product?.care ?? '')
  const [isActive, setIsActive] = useState(product?.isActive ?? true)
  const [isFeatured, setIsFeatured] = useState(product?.isFeatured ?? false)
  const [images, setImages] = useState('')
  const [editImages, setEditImages] = useState<EditableImage[]>(
    mode === 'edit' && product ? product.images.map((img) => ({ url: img.url, alt: img.alt ?? '' })) : [],
  )
  const [relatedSlugs, setRelatedSlugs] = useState<string[]>(product?.curatedRelated ?? [])
  const [variants, setVariants] = useState<VariantRow[]>(
    mode === 'edit' && product
      ? product.variants.map((v) => ({
          id: v.id,
          size: v.size,
          color: v.color,
          colorHex: v.colorHex ?? '',
          stock: String(v.stock),
          waitingCount: v.waitingCount ?? 0,
        }))
      : DEFAULT_VARIANT_ROWS,
  )

  const submit = () => {
    const trimmedName = name.trim()
    const parsedPrice = Math.round(Number(price))
    if (!trimmedName) {
      toast.error('Give the piece a name before saving.')
      return
    }
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      toast.error('Price must be a whole number of naira, greater than zero.')
      return
    }
    if (mode === 'create' && !description.trim()) {
      toast.error('Add a short description — it is required for new pieces.')
      return
    }

    const body: Record<string, unknown> = { name: trimmedName, price: parsedPrice }

    if (mode === 'create') {
      if (slug.trim()) body.slug = slug.trim()
      if (subtitle.trim()) body.subtitle = subtitle.trim()
      if (description.trim()) body.description = description.trim()
      if (details.trim()) body.details = details.trim()
      if (material.trim()) body.material = material.trim()
      if (care.trim()) body.care = care.trim()
      if (compareAt.trim()) {
        const parsed = Math.round(Number(compareAt))
        if (Number.isFinite(parsed) && parsed > 0) body.compareAtPrice = parsed
      }
      if (categoryId !== 'none') body.categoryId = categoryId
      body.isActive = isActive
      body.isFeatured = isFeatured
      const urls = images
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
      if (urls.length > 0) {
        body.images = urls.map((url) => ({ url, alt: `${trimmedName} — ${subtitle.trim() || 'product'}` }))
      }
      const rows = variants
        .filter((v) => v.size.trim() && v.color.trim())
        .map((v) => ({
          size: v.size.trim(),
          color: v.color.trim(),
          colorHex: v.colorHex.trim() || undefined,
          stock: Math.max(0, Math.round(Number(v.stock) || 0)),
        }))
      if (rows.length > 0) body.variants = rows
    } else {
      if (slug.trim() && product && slug.trim() !== product.slug) body.slug = slug.trim()
      body.subtitle = subtitle.trim() || null
      if (description.trim()) body.description = description.trim()
      body.details = details.trim() || null
      body.material = material.trim() || null
      body.care = care.trim() || null
      body.compareAtPrice = compareAt.trim()
        ? Math.max(1, Math.round(Number(compareAt)) || 1)
        : null
      body.categoryId = categoryId === 'none' ? null : categoryId
      body.isActive = isActive
      body.isFeatured = isFeatured
      body.relatedSlugs = relatedSlugs
      // Media pipeline — full image-set replace, position = gallery order.
      if (editImages.length > 0) {
        body.images = editImages.map(({ url, alt }) => ({ url, alt: alt.trim() || undefined }))
      }
      const stocks = variants
        .filter((v) => v.id)
        .map((v) => ({ id: v.id as string, stock: Math.max(0, Math.round(Number(v.stock) || 0)) }))
      if (stocks.length > 0) body.variantStocks = stocks
    }

    onSubmit(product?.id ?? null, body)
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto scroll-elegant border-line bg-background sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-light">
            {mode === 'create' ? 'New piece' : `Edit — ${product?.name ?? ''}`}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Add a new piece to the catalogue with its variants.'
              : 'Adjust details, pricing, imagery, visibility and per-variant stock.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="pf-name">
              <Input
                id="pf-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="The Atelier Blazer"
                className="h-10 border-line-strong"
                required
              />
            </Field>
            <Field label="Slug" htmlFor="pf-slug" hint={mode === 'create' ? 'Optional — generated from the name.' : 'Changing this breaks existing links.'}>
              <Input
                id="pf-slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="atelier-blazer"
                className="h-10 border-line-strong font-mono text-sm"
              />
            </Field>
          </div>

          <Field label="Subtitle" htmlFor="pf-subtitle">
            <Input
              id="pf-subtitle"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="Soft-shoulder tailored wool"
              className="h-10 border-line-strong"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Price (₦)" htmlFor="pf-price">
              <Input
                id="pf-price"
                type="number"
                min={1}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="165000"
                className="h-10 border-line-strong font-mono tabular-nums"
                required
              />
            </Field>
            <Field label="Compare-at (₦)" htmlFor="pf-compare" hint={mode === 'edit' ? 'Leave empty to clear.' : undefined}>
              <Input
                id="pf-compare"
                type="number"
                min={1}
                value={compareAt}
                onChange={(e) => setCompareAt(e.target.value)}
                placeholder="190000"
                className="h-10 border-line-strong font-mono tabular-nums"
              />
            </Field>
          </div>

          <Field label="Category" htmlFor="pf-category">
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger id="pf-category" className="h-10 w-full border-line-strong" aria-label="Category">
                <SelectValue placeholder="Choose a category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No category</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Description" htmlFor="pf-description">
            <Textarea
              id="pf-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Two years in development…"
              className="min-h-24 border-line-strong"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Details" htmlFor="pf-details" hint="One bullet per line.">
              <Textarea
                id="pf-details"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder={'Hand-padded chest and lapel\nOne-button closure, horn button'}
                className="min-h-24 border-line-strong"
              />
            </Field>
            <div className="space-y-4">
              <Field label="Material" htmlFor="pf-material">
                <Input
                  id="pf-material"
                  value={material}
                  onChange={(e) => setMaterial(e.target.value)}
                  placeholder="98% virgin wool, 2% elastane"
                  className="h-10 border-line-strong"
                />
              </Field>
              <Field label="Care" htmlFor="pf-care">
                <Input
                  id="pf-care"
                  value={care}
                  onChange={(e) => setCare(e.target.value)}
                  placeholder="Dry clean only"
                  className="h-10 border-line-strong"
                />
              </Field>
            </div>
          </div>

          <div className="flex flex-wrap gap-8 border-y border-line py-4">
            <div className="flex items-center gap-3">
              <Switch
                id="pf-active"
                checked={isActive}
                onCheckedChange={setIsActive}
                aria-label="Piece is active and visible in the storefront"
              />
              <Label htmlFor="pf-active" className="cursor-pointer text-[0.68rem] uppercase tracking-[0.18em]">
                Active
              </Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="pf-featured"
                checked={isFeatured}
                onCheckedChange={setIsFeatured}
                aria-label="Piece is featured"
              />
              <Label htmlFor="pf-featured" className="cursor-pointer text-[0.68rem] uppercase tracking-[0.18em]">
                Featured
              </Label>
            </div>
          </div>

          {mode === 'create' ? (
            <Field label="Images" htmlFor="pf-images" hint="One image URL per line — up to 12.">
              <Textarea
                id="pf-images"
                value={images}
                onChange={(e) => setImages(e.target.value)}
                placeholder={'/images/products/your-piece-name.png\n/images/products/your-piece-name-detail.png'}
                className="min-h-20 border-line-strong font-mono text-xs"
              />
              <ImageStudio
                onGenerated={(url) =>
                  setImages((prev) => (prev.trim() ? `${prev.trim()}\n${url}` : url))
                }
              />
            </Field>
          ) : (
            <ImagesEditor
              images={editImages}
              onChange={setEditImages}
              nameHint={product?.name ?? 'the piece'}
            />
          )}

          <div className="space-y-3">
            <p className="eyebrow">Variants {mode === 'edit' ? '— stock' : ''}</p>
            {mode === 'edit' ? (
              <p className="text-[0.62rem] text-muted-foreground">
                Sizes and colours are fixed after creation; adjust per-variant stock here. A “waiting”
                tag marks sizes with customers on the back-in-stock list — they’re notified when
                stock returns.
              </p>
            ) : null}
            <VariantEditor variants={variants} onChange={setVariants} editable={mode === 'create'} />
          </div>

          {mode === 'edit' ? (
            <div className="border-t border-line pt-4">
              <RelatedPiecesEditor
                relatedSlugs={relatedSlugs}
                catalogue={catalogue}
                currentSlug={product?.slug ?? ''}
                onChange={setRelatedSlugs}
              />
            </div>
          ) : null}
        </div>

        <DialogFooter className="mt-2 gap-2 border-t border-line pt-4">
          <Button
            variant="outline"
            className="border-line-strong uppercase tracking-[0.16em] text-[0.62rem]"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            className="uppercase tracking-[0.16em] text-[0.62rem]"
            onClick={submit}
            disabled={busy}
          >
            {busy ? 'Saving…' : mode === 'create' ? 'Add piece' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ *
 * Panel
 * ------------------------------------------------------------------ */
export function ProductsManager() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [dialog, setDialog] = useState<{ mode: 'create' | 'edit'; product: AdminProduct | null } | null>(null)
  const [dialogKey, setDialogKey] = useState(0)
  const [deleteTarget, setDeleteTarget] = useState<AdminProduct | null>(null)

  const productsQuery = useQuery({
    queryKey: ['admin', 'products'],
    queryFn: () => jsonFetch<{ products: AdminProduct[] }>('/api/admin/products'),
    retry: false,
    staleTime: 30_000,
  })

  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: () => jsonFetch<{ categories: CategoryInfo[] }>('/api/categories'),
    staleTime: 300_000,
  })

  const products = productsQuery.data?.products ?? []
  const categories = categoriesQuery.data?.categories ?? []

  const invalidateCatalogue = () => {
    void qc.invalidateQueries({ queryKey: ['admin', 'products'] })
    void qc.invalidateQueries({ queryKey: ['admin', 'stats'] })
    void qc.invalidateQueries({ queryKey: ['categories'] })
    void qc.invalidateQueries({ queryKey: ['shop'] })
    void qc.invalidateQueries({ queryKey: ['product'] })
    void qc.invalidateQueries({ queryKey: ['home'] })
  }

  const saveMutation = useMutation({
    mutationFn: ({ id, body }: { id: string | null; body: Record<string, unknown> }) =>
      jsonFetch<{ product: AdminProduct; notifiedStockAlerts?: number }>(
        id ? `/api/admin/products/${id}` : '/api/admin/products',
        { method: id ? 'PATCH' : 'POST', body: JSON.stringify(body) },
      ),
    onSuccess: ({ product, notifiedStockAlerts }, vars) => {
      toast.success(vars.id ? `“${product.name}” updated.` : `“${product.name}” added to the catalogue.`)
      if (vars.id && (notifiedStockAlerts ?? 0) > 0) {
        toast.success(
          `Restocked — ${notifiedStockAlerts} waitlist customer${notifiedStockAlerts === 1 ? '' : 's'} would be notified (email simulated).`,
        )
      }
      setDialog(null)
      invalidateCatalogue()
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Could not save the piece.')
    },
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { isActive?: boolean; isFeatured?: boolean } }) =>
      jsonFetch<{ product: AdminProduct }>(`/api/admin/products/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: ['admin', 'products'] })
      const prev = qc.getQueryData<{ products: AdminProduct[] }>(['admin', 'products'])
      if (prev) {
        qc.setQueryData(['admin', 'products'], {
          products: prev.products.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        })
      }
      return { prev }
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['admin', 'products'], ctx.prev)
      toast.error(err instanceof Error ? err.message : 'Could not update the piece.')
    },
    onSuccess: ({ product }, vars) => {
      if (vars.patch.isActive !== undefined) {
        toast.success(`“${product.name}” is now ${product.isActive ? 'visible in the shop' : 'hidden from the shop'}.`)
      } else if (vars.patch.isFeatured !== undefined) {
        toast.success(`“${product.name}” is ${product.isFeatured ? 'now featured' : 'no longer featured'}.`)
      }
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'products'] })
      void qc.invalidateQueries({ queryKey: ['admin', 'stats'] })
      void qc.invalidateQueries({ queryKey: ['shop'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => jsonFetch<{ ok: boolean }>(`/api/admin/products/${id}`, { method: 'DELETE' }),
    onSuccess: (_data, id) => {
      const name = products.find((p) => p.id === id)?.name ?? 'The piece'
      toast.success(`“${name}” deleted from the catalogue.`)
      setDeleteTarget(null)
      invalidateCatalogue()
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Could not delete the piece.')
    },
  })

  const openCreate = () => {
    setDialog({ mode: 'create', product: null })
    setDialogKey((k) => k + 1)
  }

  const openEdit = (product: AdminProduct) => {
    setDialog({ mode: 'edit', product })
    setDialogKey((k) => k + 1)
  }

  const q = search.trim().toLowerCase()
  const filtered = products.filter((p) => {
    const matchesQ =
      q === '' ||
      p.name.toLowerCase().includes(q) ||
      (p.subtitle ?? '').toLowerCase().includes(q) ||
      p.slug.toLowerCase().includes(q)
    const matchesCategory = categoryFilter === 'all' || p.category?.slug === categoryFilter
    return matchesQ && matchesCategory
  })

  if (productsQuery.isLoading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading products">
        <Skeleton className="h-16 rounded-none border border-line" />
        <Skeleton className="h-[60vh] rounded-none border border-line" />
      </div>
    )
  }

  if (productsQuery.error || !productsQuery.data) {
    return (
      <PanelError
        message={productsQuery.error instanceof Error ? productsQuery.error.message : 'Failed to load products'}
        onRetry={() => void productsQuery.refetch()}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Catalogue</p>
          <h2 className="mt-2 font-display text-2xl font-light sm:text-3xl">
            Pieces <span className="font-mono text-base text-muted-foreground">({products.length})</span>
          </h2>
        </div>
        <Button
          className="uppercase tracking-[0.16em] text-[0.62rem]"
          onClick={openCreate}
          aria-label="Create a new product"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
          New piece
        </Button>
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
            placeholder="Search by name or slug…"
            aria-label="Search products"
            className="h-9 border-line-strong pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger
            className="h-9 w-full border-line-strong sm:w-52"
            aria-label="Filter by category"
          >
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.slug} value={c.slug}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground sm:mb-0.5">
          {filtered.length} of {products.length}
        </p>
      </div>

      {/* table */}
      <div className="border border-line bg-card">
        <div className="max-h-[64vh] overflow-y-auto scroll-elegant">
          <Table>
              <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-card">
                <TableRow className="hover:bg-transparent">
                  <TableHead scope="col" className="pl-4 sm:pl-5">Piece</TableHead>
                  <TableHead scope="col" className="text-right">Price</TableHead>
                  <TableHead scope="col" className="text-right">Stock</TableHead>
                  <TableHead scope="col" className="text-right">Reviews</TableHead>
                  <TableHead scope="col" className="text-center">Active</TableHead>
                  <TableHead scope="col" className="text-center">Featured</TableHead>
                  <TableHead scope="col" className="text-right">Added</TableHead>
                  <TableHead scope="col" className="pr-4 text-right sm:pr-5">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => {
                  const toggling = toggleMutation.isPending && toggleMutation.variables?.id === p.id
                  return (
                    <TableRow key={p.id} className="transition-colors hover:bg-secondary/50">
                      <TableCell className="pl-4 sm:pl-5">
                        <div className="flex items-center gap-3 py-1">
                          {p.images[0] ? (
                            <img
                              src={p.images[0].url}
                              alt={p.images[0].alt ?? p.name}
                              className="h-10 w-10 shrink-0 border border-line object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center border border-line bg-secondary">
                              <Package className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} aria-hidden />
                            </span>
                          )}
                          <div className="min-w-0 max-w-56">
                            <p className="truncate text-sm leading-tight">
                              {p.name}
                              {p.isFeatured ? <span className="ml-1.5 align-middle text-[0.58rem] uppercase tracking-[0.14em] text-espresso">★</span> : null}
                            </p>
                            <p className="truncate text-[0.62rem] text-muted-foreground">
                              {p.category?.name ?? 'No category'} · <span className="font-mono">{p.slug}</span>
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <p className="font-mono text-xs tabular-nums">{formatNaira(p.price)}</p>
                        {p.compareAtPrice != null ? (
                          <p className="font-mono text-[0.62rem] tabular-nums text-muted-foreground line-through">
                            {formatNaira(p.compareAtPrice)}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell
                        className={cn(
                          'text-right font-mono text-xs tabular-nums',
                          p.stock <= 5 ? 'font-semibold text-espresso' : 'text-foreground',
                        )}
                      >
                        {p.stock}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                        {p.reviewCount}
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={p.isActive}
                          disabled={toggling}
                          onCheckedChange={(v) => toggleMutation.mutate({ id: p.id, patch: { isActive: v } })}
                          aria-label={`Toggle active for ${p.name}`}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={p.isFeatured}
                          disabled={toggling}
                          onCheckedChange={(v) => toggleMutation.mutate({ id: p.id, patch: { isFeatured: v } })}
                          aria-label={`Toggle featured for ${p.name}`}
                        />
                      </TableCell>
                      <TableCell className="text-right text-[0.62rem] text-muted-foreground">
                        {formatDateShort(p.createdAt)}
                      </TableCell>
                      <TableCell className="pr-4 sm:pr-5">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => openEdit(p)}
                            aria-label={`Edit ${p.name}`}
                          >
                            <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => setDeleteTarget(p)}
                            aria-label={`Delete ${p.name}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
                          </Button>
                        </div>
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
              No pieces match the current filters.
            </p>
          </div>
        ) : null}
      </div>

      {/* create / edit dialog — remounts fresh via key */}
      {dialog ? (
        <ProductDialog
          key={dialogKey}
          mode={dialog.mode}
          product={dialog.product}
          categories={categories}
          catalogue={products}
          onOpenChange={(open) => {
            if (!open) setDialog(null)
          }}
          onSubmit={(id, body) => saveMutation.mutate({ id, body })}
          busy={saveMutation.isPending}
        />
      ) : null}

      {/* delete confirmation */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="border-line bg-background">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-xl font-light">
              Delete “{deleteTarget?.name ?? ''}”?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This removes the piece with its variants, images and reviews from the catalogue. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Separator className="bg-line" />
          <AlertDialogFooter>
            <AlertDialogCancel className="border-line-strong uppercase tracking-[0.16em] text-[0.62rem]">
              Keep piece
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
