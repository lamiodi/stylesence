'use client'

/**
 * Style Sence by SKR — hash-routed SPA.
 * The entire storefront + admin console is served from this single route.
 */
import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { useRoute, useScrollTop } from '@/lib/router'
import { useMounted } from '@/hooks/use-mounted'
import { AnnouncementBar } from '@/components/site/announcement-bar'
import { Header } from '@/components/site/header'
import { Footer } from '@/components/site/footer'
import { CartSheet } from '@/components/site/cart-sheet'
import { PageFade } from '@/components/site/reveal'
import { HomePage } from '@/components/pages/home'
import { ShopPage } from '@/components/pages/shop'
import { ProductDetailPage } from '@/components/pages/product-detail'
import { CartPage } from '@/components/pages/cart-page'
import { CheckoutPage } from '@/components/pages/checkout'
import { OrderConfirmationPage } from '@/components/pages/order-confirmation'
import { WishlistPage } from '@/components/pages/wishlist-page'
import { JournalPage } from '@/components/pages/journal'
import { JournalPostPage } from '@/components/pages/journal-post'
import { AboutPage } from '@/components/pages/about'
import { HelpPage } from '@/components/pages/help'
import { TrackOrderPage } from '@/components/pages/track-order'
import { NotFoundPage } from '@/components/pages/not-found'
import { AdminApp } from '@/components/admin/admin-app'

function Router() {
  const route = useRoute()
  const mounted = useMounted()
  useScrollTop(route)

  const [s0, s1, s2] = route.segments

  // ensure a canonical hash on first load
  if (typeof window !== 'undefined' && !window.location.hash) {
    window.location.replace(`${window.location.pathname}#/`)
  }

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
      key = `track:${route.query.get('order') ?? ''}`
      break
    case 'admin':
      page = <AdminApp />
      key = `admin:${route.query.get('tab') ?? ''}`
      break
    default:
      page = <NotFoundPage />
  }

  void s2

  // SSR renders `/` (home) — the client may hydrate against a deep hash link
  // (#/product/…). Rendering nothing until mounted keeps hydration a match;
  // the page then appears keyed + animated on the very next frame.
  return (
    <main id="main" className="flex-1">
      {mounted ? <PageFade keyName={key}>{page}</PageFade> : null}
    </main>
  )
}

export default function Home() {
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

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <div className="flex min-h-screen flex-col">
          <AnnouncementBar />
          <Header />
          <Router />
          <Footer />
          <CartSheet />
        </div>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
