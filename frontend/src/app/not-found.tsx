import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <p className="font-mono text-[0.6rem] uppercase tracking-[0.3em] text-muted-foreground">
        404
      </p>
      <h1 className="mt-4 font-display text-4xl font-light tracking-tight sm:text-5xl">
        This page has left the atelier.
      </h1>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
        The address may be mistyped, or the piece has moved on. The collection,
        as always, is one click away.
      </p>
      <Link
        href="/shop"
        className="mt-8 inline-block border border-line-strong px-8 py-3.5 text-[0.64rem] font-medium uppercase tracking-[0.2em] transition-colors hover:border-foreground"
      >
        Shop the collection
      </Link>
    </main>
  )
}
