/** Whole-Naira money formatting — Style Sence displays ₦ without kobo. */

export function formatNaira(n: number): string {
  return `₦${Math.round(n).toLocaleString('en-NG')}`
}

export function formatDate(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function formatDateShort(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: '2-digit' })
}
