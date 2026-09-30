'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Row = { id?: string; size: string; color: string; colorHex: string; stock: string; waitingCount?: number }

function ColorRow({ name, hex, count, onSave }: { name: string; hex: string; count: number; onSave: (name: string, hex: string) => void }) {
  const [draft, setDraft] = useState(name)
  const [swatch, setSwatch] = useState(hex || '#EDE7DC')
  return <div className="flex flex-wrap items-center gap-2">
    <Input className="h-10 min-w-32 flex-1" value={draft} maxLength={40} onChange={e => setDraft(e.target.value)} aria-label={`Rename colour ${name}`} />
    <input type="color" className="h-10 w-10 shrink-0 cursor-pointer" value={/^#[0-9a-f]{6}$/i.test(swatch) ? swatch : '#EDE7DC'} onChange={e => setSwatch(e.target.value)} aria-label={`Swatch for ${name}`} />
    <Input className="h-10 w-28 font-mono" value={swatch} onChange={e => setSwatch(e.target.value)} aria-label={`Hex for ${name}`} />
    <Button type="button" variant="outline" onClick={() => onSave(draft.trim(), swatch.trim())}>Apply</Button>
    <span className="text-xs text-muted-foreground">{count} sizes</span>
  </div>
}

export function ProductColorsEditor({ variants, onChange, onRename }: {
  variants: Row[]; onChange: (rows: Row[]) => void; onRename: (oldName: string, newName: string) => void
}) {
  const [name, setName] = useState('')
  const [hex, setHex] = useState('#EDE7DC')
  const names = [...new Set(variants.map(v => v.color).filter(Boolean))]
  const valid = (next: string, colorHex: string, oldName?: string) => {
    if (!next || next.length > 40) { toast.error('Enter a colour name of up to 40 characters.'); return false }
    if (!/^#[0-9a-f]{6}$/i.test(colorHex)) { toast.error('Enter a six-digit hex colour such as #EDE7DC.'); return false }
    if (names.some(c => c !== oldName && c.toLowerCase() === next.toLowerCase())) { toast.error('That colour already exists.'); return false }
    return true
  }
  const addColor = () => {
    const next = name.trim()
    if (!valid(next, hex)) return
    const sizes = [...new Set(variants.map(v => v.size.trim()).filter(Boolean))]
    const newSizes = sizes.length ? sizes : ['XS', 'S', 'M', 'L', 'XL', 'XXL']
    if (variants.length + newSizes.length > 50) { toast.error('This would exceed the 50 size/colour variant limit.'); return }
    onChange([...variants, ...newSizes.map(size => ({ size, color: next, colorHex: hex, stock: '0' }))])
    setName('')
    toast.success(`${next} added. Set stock for its sizes below, then assign or upload images.`)
  }
  return <section className="space-y-3 border-t border-line pt-4" aria-label="Product colours">
    <p className="eyebrow">Colours &amp; their images</p>
    <p className="text-xs text-muted-foreground">Rename a colour here to keep its images together. Changes are saved with the product.</p>
    {names.map(c => <ColorRow key={`${c}-${variants.find(v => v.color === c)?.colorHex}`} name={c} hex={variants.find(v => v.color === c)?.colorHex ?? '#EDE7DC'} count={variants.filter(v => v.color === c).length}
      onSave={(next, swatch) => {
        if (!valid(next, swatch, c)) return
        onChange(variants.map(v => v.color === c ? { ...v, color: next, colorHex: swatch } : v))
        onRename(c, next)
      }} />)}
    <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
      <Input className="min-w-32 flex-1" value={name} onChange={e => setName(e.target.value)} placeholder="New colour name" maxLength={40} aria-label="New colour name" />
      <input type="color" value={hex} onChange={e => setHex(e.target.value)} aria-label="New colour swatch" className="h-10 w-10" />
      <Button type="button" variant="outline" onClick={addColor}>Add colour</Button>
    </div>
    <p className="text-xs text-muted-foreground">A new colour gets the existing sizes with stock set to zero.</p>
  </section>
}
