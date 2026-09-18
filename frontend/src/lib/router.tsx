'use client'

/**
 * Minimal hash router for the Style Sence SPA.
 * Routes live after `#` — e.g. `#/shop?category=knitwear&sort=price-asc`.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode, type MouseEvent } from 'react'

export interface Route {
  /** normalised path without leading '#', always starts with '/', e.g. '/shop' */
  path: string
  /** path segments, e.g. ['product', 'silk-slip-dress'] */
  segments: string[]
  /** query params from the hash */
  query: URLSearchParams
}

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, '') || '/'
  const [pathPart, queryPart] = raw.split('?')
  const path = pathPart.startsWith('/') ? pathPart : `/${pathPart}`
  const segments = path.split('/').filter(Boolean).map(decodeURIComponent)
  return { path, segments, query: new URLSearchParams(queryPart ?? '') }
}

export function navigate(to: string, opts?: { replace?: boolean }) {
  const target = to.startsWith('#') ? to : `#${to}`
  if (opts?.replace) {
    const url = `${window.location.pathname}${window.location.search}${target}`
    window.history.replaceState(null, '', url)
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  } else {
    window.location.hash = target
  }
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() =>
    typeof window === 'undefined' ? parseHash('/') : parseHash(window.location.hash),
  )

  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  return route
}

/** Serialise path + query object into a hash href. */
export function toHash(path: string, query?: Record<string, string | undefined | null>): string {
  const params = new URLSearchParams()
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') params.set(k, v)
    }
  }
  const qs = params.toString()
  return `#${path}${qs ? `?${qs}` : ''}`
}

/** Scroll to top whenever the path (not query) changes. */
export function useScrollTop(route: Route) {
  const { path } = route
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [path])
}

export function Link({
  to,
  children,
  className,
  onClick,
  ariaLabel,
  title,
}: {
  to: string
  children: ReactNode
  className?: string
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void
  ariaLabel?: string
  title?: string
}) {
  const href = to.startsWith('#') ? to : `#${to}`
  return (
    <a href={href} className={className} onClick={onClick} aria-label={ariaLabel} title={title}>
      {children}
    </a>
  )
}

/** Stable query string for query keys */
export function useQueryKey(prefix: string, route: Route): unknown[] {
  const qs = route.query.toString()
  return useMemo(() => [prefix, route.path, qs], [prefix, route.path, qs])
}

/** Small helper hook for imperative navigation outside JSX */
export function useNavigate() {
  return useCallback((to: string, opts?: { replace?: boolean }) => navigate(to, opts), [])
}
