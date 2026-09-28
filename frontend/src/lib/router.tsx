'use client'

/**
 * Path-based SPA router for the Style Sence storefront.
 *
 * Every page is served by the app/[[...slug]] catch-all and rendered
 * client-side from the path (`/shop?category=knitwear`), so each URL is a
 * distinct, crawlable, shareable address. Legacy hash URLs (`/#/shop`),
 * still present in old emails and bookmarks, are redirected once on load.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode, type MouseEvent } from 'react'

export interface Route {
  /** normalised path, always starts with '/', e.g. '/shop' */
  path: string
  /** path segments, e.g. ['product', 'silk-slip-dress'] */
  segments: string[]
  /** query params from the location search */
  query: URLSearchParams
}

export function parseRoute(pathname: string, search?: string): Route {
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`
  const segments = path.split('/').filter(Boolean).map(decodeURIComponent)
  const query = new URLSearchParams(search ?? '')
  return { path, segments, query }
}

/**
 * One-time redirect of legacy hash URLs: `/#/shop?a=1` (plus any top-level
 * `?b=2`) becomes `/shop?a=1&b=2`. Runs before the first route parse and on
 * any late-arriving hashchange, so old emails and bookmarks keep working.
 */
function migrateLegacyHash(): void {
  const hash = window.location.hash
  if (!hash.startsWith('#/')) return
  const raw = hash.slice(1)
  const [pathPart, queryPart] = raw.split('?')
  const merged = new URLSearchParams(queryPart ?? '')
  new URLSearchParams(window.location.search).forEach((val, key) => {
    if (!merged.has(key)) merged.set(key, val)
  })
  const qs = merged.toString()
  const path = pathPart.startsWith('/') ? pathPart : `/${pathPart}`
  window.history.replaceState(null, '', `${path}${qs ? `?${qs}` : ''}`)
}

export function navigate(to: string, opts?: { replace?: boolean }) {
  const target = to.startsWith('#') ? to.slice(1) : to
  if (opts?.replace) {
    window.history.replaceState(null, '', target)
  } else {
    window.history.pushState(null, '', target)
  }
  // pushState/replaceState fire no event — notify the route subscribers.
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => {
    if (typeof window === 'undefined') return parseRoute('/')
    migrateLegacyHash()
    return parseRoute(window.location.pathname, window.location.search)
  })

  useEffect(() => {
    const onChange = () => setRoute(parseRoute(window.location.pathname, window.location.search))
    const onHashChange = () => {
      migrateLegacyHash()
      onChange()
    }
    window.addEventListener('popstate', onChange)
    window.addEventListener('hashchange', onHashChange)
    return () => {
      window.removeEventListener('popstate', onChange)
      window.removeEventListener('hashchange', onHashChange)
    }
  }, [])

  return route
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
  // Tolerate legacy '#/path' targets; the href itself is the clean path so
  // crawlers and middle/⌘-clicks get a real address.
  const path = to.startsWith('#') ? to.slice(1) : to
  return (
    <a
      href={path}
      className={className}
      aria-label={ariaLabel}
      title={title}
      onClick={(e) => {
        onClick?.(e)
        if (e.defaultPrevented) return
        // Plain left clicks navigate in-app; modified clicks fall through to
        // the browser (new tab / new window).
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
        if (!path.startsWith('/')) return
        e.preventDefault()
        navigate(path)
      }}
    >
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
