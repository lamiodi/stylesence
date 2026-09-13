'use client'

import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Tag, Plus, Trash2, Infinity as InfinityIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatNaira, formatDateShort } from '@/lib/money'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
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

interface AdminPromo {
  id: string
  code: string
  label: string | null
  type: string
  value: number
  minSubtotal: number
  maxUsage: number | null
  usageCount: number
  singleUsePerCustomer: boolean
  isActive: boolean
  expiresAt: string | null
  createdAt: string
}

function valueLabel(p: AdminPromo): string {
  if (p.type === 'PERCENT') return `${p.value}% off`
  if (p.type === 'AMOUNT') return `${formatNaira(p.value)} off`
  return 'Complimentary shipping'
}

function NewPromoDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void }) {
  const qc = useQueryClient()
  const [code, setCode] = useState('')
  const [label, setLabel] = useState('')
  const [type, setType] = useState<'PERCENT' | 'AMOUNT' | 'SHIPPING'>('PERCENT')
  const [value, setValue] = useState('10')
  const [minSubtotal, setMinSubtotal] = useState('0')
  const [maxUsage, setMaxUsage] = useState('')
  const [singleUse, setSingleUse] = useState(false)
  const [expiresAt, setExpiresAt] = useState('')
  const [busy, setBusy] = useState(false)

  const create = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/promos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.trim(),
          label: label.trim() || undefined,
          type,
          value: type === 'SHIPPING' ? 0 : Math.max(0, Number(value) || 0),
          minSubtotal: Math.max(0, Number(minSubtotal) || 0),
          maxUsage: maxUsage.trim() ? Math.max(1, Number(maxUsage)) : null,
          singleUsePerCustomer: singleUse,
          expiresAt: expiresAt || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not create the code')
      return data.promo
    },
    onSuccess: () => {
      toast.success(`${code.trim().toUpperCase()} is on the books.`)
      qc.invalidateQueries({ queryKey: ['admin', 'promos'] })
      onOpenChange(false)
      setCode('')
      setLabel('')
      setType('PERCENT')
      setValue('10')
      setMinSubtotal('0')
      setMaxUsage('')
      setSingleUse(false)
      setExpiresAt('')
      onCreated()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const field = 'h-10 border-line-strong bg-background'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-[--radius] border-line bg-background">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-light">New promo code</DialogTitle>
          <DialogDescription>Codes are validated at checkout — the server stays authoritative.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (code.trim().length < 2) return toast.error('Give the code at least 2 characters.')
            setBusy(true)
            create.mutate(undefined, { onSettled: () => setBusy(false) })
          }}
          className="space-y-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="np-code" className="eyebrow">Code *</Label>
              <Input
                id="np-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="SS-FRIEND"
                className={cn(field, 'font-mono tracking-[0.08em]')}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="np-type" className="eyebrow">Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as 'PERCENT' | 'AMOUNT' | 'SHIPPING')}>
                <SelectTrigger id="np-type" className={cn(field, 'border-line-strong')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERCENT">Percent off</SelectItem>
                  <SelectItem value="AMOUNT">Amount off (₦)</SelectItem>
                  <SelectItem value="SHIPPING">Free shipping</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="np-label" className="eyebrow">Label</Label>
            <Input
              id="np-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Friends of the house — 10% off"
              className={field}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="np-value" className="eyebrow">{type === 'PERCENT' ? 'Percent' : type === 'AMOUNT' ? 'Amount (₦)' : 'Value'}</Label>
              <Input
                id="np-value"
                type="number"
                min={0}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                disabled={type === 'SHIPPING'}
                className={cn(field, 'font-mono tabular-nums')}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="np-min" className="eyebrow">Min subtotal (₦)</Label>
              <Input
                id="np-min"
                type="number"
                min={0}
                value={minSubtotal}
                onChange={(e) => setMinSubtotal(e.target.value)}
                className={cn(field, 'font-mono tabular-nums')}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="np-max" className="eyebrow">Max usage</Label>
              <Input
                id="np-max"
                type="number"
                min={1}
                value={maxUsage}
                onChange={(e) => setMaxUsage(e.target.value)}
                placeholder="∞"
                className={cn(field, 'font-mono tabular-nums')}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="np-exp" className="eyebrow">Expires (optional)</Label>
            <Input
              id="np-exp"
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className={cn(field, 'font-mono')}
            />
          </div>
          <div className="flex items-center justify-between gap-4 border border-line bg-secondary/40 px-4 py-3.5">
            <div className="min-w-0">
              <Label htmlFor="np-single" className="eyebrow">One per customer</Label>
              <p className="mt-1 text-[0.7rem] leading-relaxed text-muted-foreground">
                The same email can redeem this code once — checked against past orders at checkout.
              </p>
            </div>
            <Switch
              id="np-single"
              checked={singleUse}
              onCheckedChange={setSingleUse}
              aria-label="Restrict this code to one use per customer email"
            />
          </div>
          <DialogFooter className="pt-2">
            <Button type="submit" disabled={busy} className="uppercase tracking-[0.16em] text-[0.62rem]">
              {busy ? 'Creating…' : 'Create code'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function PromosManager() {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AdminPromo | null>(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'promos'],
    queryFn: async () => {
      const res = await fetch('/api/admin/promos')
      if (!res.ok) throw new Error('Failed to load promo codes')
      return (await res.json()) as { promos: AdminPromo[] }
    },
  })

  const toggleActive = useMutation({
    mutationFn: async (p: AdminPromo) => {
      const res = await fetch(`/api/admin/promos/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !p.isActive }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Could not update the code')
      return body.promo
    },
    onMutate: async (p) => {
      await qc.cancelQueries({ queryKey: ['admin', 'promos'] })
      const prev = qc.getQueryData<{ promos: AdminPromo[] }>(['admin', 'promos'])
      qc.setQueryData(['admin', 'promos'], {
        promos: (prev?.promos ?? []).map((x) => (x.id === p.id ? { ...x, isActive: !p.isActive } : x)),
      })
      return { prev }
    },
    onError: (e: Error, _p, ctx) => {
      if (ctx?.prev) qc.setQueryData(['admin', 'promos'], ctx.prev)
      toast.error(e.message)
    },
    onSuccess: (promo) => {
      const p = promo as AdminPromo
      toast.success(`${p.code} is ${p.isActive ? 'active' : 'paused'}.`)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['admin', 'promos'] }),
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/promos/${id}`, { method: 'DELETE' })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Could not delete the code')
      return body
    },
    onSuccess: () => {
      toast('Code deleted.')
      qc.invalidateQueries({ queryKey: ['admin', 'promos'] })
      setDeleteTarget(null)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const promos = useMemo(() => data?.promos ?? [], [data])
  const activeCount = promos.filter((p) => p.isActive).length

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Promotions</p>
          <h1 className="mt-1.5 font-display text-3xl font-light tracking-tight">Promo codes</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {activeCount} active of {promos.length} — validated server-side at checkout.
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="h-11 gap-2 uppercase tracking-[0.16em] text-[0.62rem]"
        >
          <Plus className="h-4 w-4" strokeWidth={1.5} aria-hidden />
          New code
        </Button>
      </div>

      <div className="mt-6 border border-line bg-card">
        <div className="scroll-elegant max-h-[34rem] overflow-y-auto overflow-x-auto">
          <table className="w-full min-w-[52rem] text-sm">
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="border-b border-line text-left">
                <th scope="col" className="eyebrow px-4 py-3">Code</th>
                <th scope="col" className="eyebrow px-4 py-3">Reward</th>
                <th scope="col" className="eyebrow px-4 py-3">Min basket</th>
                <th scope="col" className="eyebrow px-4 py-3">Usage</th>
                <th scope="col" className="eyebrow px-4 py-3">Expires</th>
                <th scope="col" className="eyebrow px-4 py-3 text-center">Active</th>
                <th scope="col" className="eyebrow px-4 py-3 text-right">Remove</th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="border-b border-line">
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="px-4 py-4">
                          <Skeleton className="h-4 w-full" />
                        </td>
                      ))}
                    </tr>
                  ))
                : promos.map((p) => (
                    <tr key={p.id} className="border-b border-line transition-colors hover:bg-secondary/40">
                      <td className="px-4 py-3.5">
                        <span className="flex items-center gap-2 font-mono text-[0.8rem] font-medium tracking-[0.06em]">
                          <Tag className="h-3.5 w-3.5 text-espresso" strokeWidth={1.5} aria-hidden />
                          {p.code}
                        </span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          {p.label ? (
                            <span className="max-w-[16rem] truncate text-[0.68rem] text-muted-foreground">
                              {p.label}
                            </span>
                          ) : null}
                          {p.singleUsePerCustomer ? (
                            <span
                              className="border border-line-strong px-1.5 py-0.5 text-[0.56rem] font-medium uppercase tracking-[0.14em] text-muted-foreground"
                              title="One redemption per customer email"
                            >
                              1×/customer
                            </span>
                          ) : null}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-[0.82rem]">{valueLabel(p)}</td>
                      <td className="px-4 py-3.5 font-mono text-[0.78rem] tabular-nums text-muted-foreground">
                        {p.minSubtotal > 0 ? formatNaira(p.minSubtotal) : '—'}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-mono text-[0.78rem] tabular-nums">
                          {p.usageCount}
                          <span className="text-muted-foreground/60">
                            {' / '}
                            {p.maxUsage ?? <InfinityIcon className="inline h-3 w-3" aria-label="unlimited" />}
                          </span>
                        </span>
                        {p.maxUsage ? (
                          <span className="mt-1 block h-1 w-16 overflow-hidden bg-secondary">
                            <span
                              className="block h-full bg-espresso"
                              style={{ width: `${Math.min(100, (p.usageCount / p.maxUsage) * 100)}%` }}
                            />
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3.5 text-[0.75rem] text-muted-foreground">
                        {p.expiresAt ? formatDateShort(p.expiresAt) : '—'}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <Switch
                          checked={p.isActive}
                          onCheckedChange={() => toggleActive.mutate(p)}
                          aria-label={`${p.isActive ? 'Pause' : 'Activate'} ${p.code}`}
                        />
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(p)}
                          className="inline-flex h-8 w-8 items-center justify-center text-muted-foreground/70 transition-colors hover:text-destructive"
                          aria-label={`Delete ${p.code}`}
                        >
                          <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                        </button>
                      </td>
                    </tr>
                  ))}
              {!isLoading && promos.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <p className="font-display text-lg italic text-muted-foreground">
                      No codes on the books yet.
                    </p>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <NewPromoDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={() => {}} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-[--radius] border-line bg-background">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-xl font-light">
              Strike {deleteTarget?.code}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The code will stop validating immediately. Past orders keep their recorded discount.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="uppercase tracking-[0.14em] text-[0.62rem]">Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && remove.mutate(deleteTarget.id)}
              className="bg-destructive uppercase tracking-[0.14em] text-[0.62rem] hover:bg-destructive/90"
            >
              Delete code
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isError ? (
        <p className="mt-4 text-sm text-destructive">
          Could not load promo codes — refresh or check the console.
        </p>
      ) : null}
    </div>
  )
}
