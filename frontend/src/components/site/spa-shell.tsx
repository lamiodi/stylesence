'use client'

/**
 * Style Sence by SKR — path-routed SPA shell.
 * Served by the app/[[...slug]] catch-all: the server shell renders for
 * every address; the client router below decides which page shows.
 */
import { Suspense, lazy, useEffect, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { HERO_POSTER_URL } from '@/lib/site'
import { useRoute, useScrollTop, navigate } from '@/lib/router'
import { useMounted } from '@/hooks/use-mounted'
import { AnnouncementBar } from '@/components/site/announcement-bar'
import { Header } from '@/components/site/header'
import { Footer } from '@/components/site/footer'
import { CartSheet } from '@/components/site/cart-sheet'
import { CurrencyModal } from '@/components/site/currency-modal'
import { detectCurrency } from '@/lib/store/currency'
import { ScrollToTop } from '@/components/site/scroll-to-top'
import { WhatsAppWidget } from '@/components/site/whatsapp-widget'
import { PageFade } from '@/components/site/reveal'
import { HomePage } from '@/components/pages/home'
import { ShopPage } from '@/components/pages/shop'
import { ProductDetailPage } from '@/components/pages/product-detail'
import { CartPage } from '@/components/pages/cart-page'
import { CheckoutPage } from '@/components/pages/checkout'
import { NotFoundPage } from '@/components/pages/not-found'
import StyleSencePreloader from '@/components/site/StyleSencePreloader'
import { WishlistSync } from '@/lib/wishlist-sync'

/* Secondary routes load on demand: the storefront's first paint carries only
   the shopping path. The admin console (and its recharts dependency) no
   longer ships to every visitor's phone. Suspense fallback mirrors the
   preloader's tonal look so a lazy navigation reads as a page, not a stall. */
const OrderConfirmationPage = lazy(() =>
  import('@/components/pages/order-confirmation').then((m) => ({ default: m.OrderConfirmationPage })))
const WishlistPage = lazy(() =>
  import('@/components/pages/wishlist-page').then((m) => ({ default: m.WishlistPage })))
const JournalPage = lazy(() =>
  import('@/components/pages/journal').then((m) => ({ default: m.JournalPage })))
const JournalPostPage = lazy(() =>
  import('@/components/pages/journal-post').then((m) => ({ default: m.JournalPostPage })))
const AboutPage = lazy(() =>
  import('@/components/pages/about').then((m) => ({ default: m.AboutPage })))
const HelpPage = lazy(() =>
  import('@/components/pages/help').then((m) => ({ default: m.HelpPage })))
const TrackOrderPage = lazy(() =>
  import('@/components/pages/track-order').then((m) => ({ default: m.TrackOrderPage })))
const AccountPage = lazy(() =>
  import('@/components/pages/account-page').then((m) => ({ default: m.AccountPage })))
const AdminApp = lazy(() =>
  import('@/components/admin/admin-app').then((m) => ({ default: m.AdminApp })))

function RouteSuspense({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="container-site py-24" aria-busy="true">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-2/5 bg-secondary" />
            <div className="aspect-[3/4] w-full max-w-md bg-secondary" />
          </div>
        </div>
      }
    >
      {children}
    </Suspense>
  )
}

function Router() {
  const route = useRoute()
  const mounted = useMounted()
  useScrollTop(route)

  const [s0, s1, s2] = route.segments

  // Legacy rescue: gateway returns and external links may land on `/` with
  // `?order=SS-…` in the query — route them to the order page.
  useEffect(() => {
    if (route.path !== '/' || typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const orderNum = params.get('order') ?? params.get('orderNumber')
    if (orderNum) {
      params.delete('order')
      params.delete('orderNumber')
      const qs = params.toString()
      navigate(`/order/${encodeURIComponent(orderNum)}${qs ? `?${qs}` : ''}`, { replace: true })
    }
  }, [])

  let page: React.ReactNode
  let key = route.path

  switch (s0) {
    case undefined:
    case '':
      page = <HomePage />
      break
    case 'shop':
      page = <ShopPage />
      key = `shop:${route.query.get('category') ?? ''}:${route.query.get('q') ?? ''}`
      break
    case 'product':
      page = s1 ? <ProductDetailPage slug={s1} /> : <NotFoundPage />
      key = `product:${s1}`
      break
    case 'cart':
      page = <CartPage />
      break
    case 'checkout':
      page = <CheckoutPage />
      break
    case 'order':
      page = s1 ? <OrderConfirmationPage orderNumber={s1} /> : <NotFoundPage />
      key = `order:${s1}`
      break
    case 'wishlist':
      page = <WishlistPage />
      break
    case 'journal':
      page = s1 ? <JournalPostPage slug={s1} /> : <JournalPage />
      key = `journal:${s1 ?? ''}`
      break
    case 'about':
      page = <AboutPage />
      break
    case 'help':
      page = <HelpPage />
      key = `help:${route.query.get('topic') ?? ''}`
      break
    case 'track':
      page = <TrackOrderPage />
      key = `track:${route.query.get('mode') ?? ''}:${route.query.get('order') ?? ''}:${route.query.get('email') ?? ''}`
      break
    case 'account':
      page = <AccountPage />
      key = `account:${route.query.get('mode') ?? ''}`
      break
    case 'admin':
      page = <AdminApp />
      key = `admin:${route.query.get('tab') ?? ''}`
      break
    default:
      page = <NotFoundPage />
  }

  void s2

  // The server renders the shell for every path; the client may route
  // differently once mounted (deep links, legacy hash redirects). Rendering
  // nothing until mounted keeps hydration a match; the page then appears
  // keyed + animated on the very next frame.
  return (
    <main id="main" className="flex-1">
      {mounted ? (
        <PageFade keyName={key}>
          <RouteSuspense>{page}</RouteSuspense>
        </PageFade>
      ) : null}
    </main>
  )
}

export function SpaShell() {
  const mounted = useMounted()
  const [entranceDone, setEntranceDone] = useState(false)
  // Once per 7 days per browser (not per tab session): return visits skip
  // the entrance overlay entirely. Resolved AFTER hydration (an effect, like
  // useMounted) so the server render and first client paint always match —
  // reading storage in a render-time initializer would mismatch on every
  // reload. The pre-paint script in layout.tsx applies the same check as a
  // class before first paint.
  const ENTRANCE_TTL_MS = 7 * 24 * 60 * 60 * 1000
  const [entranceSkipped, setEntranceSkipped] = useState(false)
  useEffect(() => {
    let skip = false
    try {
      const seenAt = Number(localStorage.getItem('ss-entrance'))
      skip = Number.isFinite(seenAt) && Date.now() - seenAt < ENTRANCE_TTL_MS
      localStorage.setItem('ss-entrance', String(Date.now()))
    } catch {
      // Private mode — the entrance simply shows every visit.
    }
    if (!skip) return
    // Deferred a frame so the skip never cascades a synchronous re-render.
    const raf = requestAnimationFrame(() => setEntranceSkipped(true))
    return () => cancelAnimationFrame(raf)
  }, [])
  const showEntrance = !entranceSkipped
  const [heroReady, setHeroReady] = useState(false)

  // The entrance may only lift once the first screen can actually paint:
  // the hero poster (preloaded in <head>) decoded — or failed. Fails open
  // after 4s so a stalled CDN can never hold the storefront hostage; the
  // preloader's own maxWaitMs is the second belt.
  useEffect(() => {
    let settled = false
    const markReady = () => {
      if (!settled) {
        settled = true
        setHeroReady(true)
      }
    }
    const hero = new Image()
    hero.onload = hero.onerror = markReady
    hero.src = HERO_POSTER_URL
    const failOpen = window.setTimeout(markReady, 4000)
    return () => {
      window.clearTimeout(failOpen)
    }
  }, [])

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  )

  // Display-currency detection — never blocks first paint. One idle-time run
  // per visitor: cookie choice wins; else the geo route (once, then
  // cookie-persisted); else a timezone hint. May suggest the selector modal.
  useEffect(() => {
    if (!mounted) return
    const idle: number =
      typeof window.requestIdleCallback === 'function'
        ? window.requestIdleCallback(() => void detectCurrency(), { timeout: 4000 })
        : window.setTimeout(() => void detectCurrency(), 2000)
    return () => {
      if (typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(idle)
      else window.clearTimeout(idle)
    }
  }, [mounted])

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        {showEntrance ? (
          <StyleSencePreloader ready={mounted && heroReady} onExit={() => setEntranceDone(true)} />
        ) : null}
        <noscript><style>{`.ss-loader { display: none; }`}</style></noscript>
        <div className="flex min-h-screen flex-col" inert={mounted && showEntrance && !entranceDone} aria-busy={!mounted}>
          <AnnouncementBar />
          <Header />
          <Router />
          <Footer />
          <CartSheet />
          <CurrencyModal />
          <ScrollToTop />
          <WhatsAppWidget />
          <WishlistSync />
        </div>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
