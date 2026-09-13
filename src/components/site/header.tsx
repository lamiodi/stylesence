'use client'

import { useEffect, useRef, useState } from 'react'
import { useTheme } from 'next-themes'
import { Search, Heart, ShoppingBag, Menu, X, Sun, Moon, User } from 'lucide-react'
import { Link, navigate, useRoute } from '@/lib/router'
import { cn } from '@/lib/utils'
import { useCart } from '@/lib/cart-client'
import { useWishlist, useUi } from '@/lib/store/wishlist'
import { useCustomer } from '@/hooks/use-customer'
import { useMounted } from '@/hooks/use-mounted'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import {
  Menubar,
  MenubarContent,
  MenubarMenu,
  MenubarTrigger,
} from '@/components/ui/menubar'

const CATEGORIES = [
  { slug: '', label: 'All Pieces' },
  { slug: 'ready-to-wear', label: 'Ready-to-Wear' },
  { slug: 'dresses', label: 'Dresses' },
  { slug: 'knitwear', label: 'Knitwear' },
  { slug: 'outerwear', label: 'Outerwear' },
  { slug: 'accessories', label: 'Accessories' },
]

function Wordmark({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn('group block text-center', className)} ariaLabel="Style Sence — home">
      <span className="font-display text-[1.15rem] font-light uppercase leading-none tracking-[0.22em] text-foreground transition-opacity group-hover:opacity-70 sm:text-[1.5rem] sm:tracking-[0.4em]">
        Style&nbsp;Sence
      </span>
      <span className="mt-1 block text-[0.5rem] font-medium uppercase tracking-[0.5em] text-muted-foreground">
        by SKR
      </span>
    </Link>
  )
}

function IconBadge({ count }: { count: number }) {
  if (!count) return null
  return (
    <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-espresso px-1 font-mono text-[0.58rem] font-semibold leading-none text-background tabular-nums">
      {count > 99 ? '99+' : count}
    </span>
  )
}

export function Header() {
  const route = useRoute()
  const [scrolled, setScrolled] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const [q, setQ] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const { data: cart } = useCart()
  const { data: customer } = useCustomer()
  const wishCount = useWishlist((s) => s.items.length)
  const setCartOpen = useUi((s) => s.setCartOpen)
  const { theme, setTheme } = useTheme()
  const mounted = useMounted()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus()
  }, [searchOpen])

  // close overlays whenever the route changes (event callback — safe)
  useEffect(() => {
    const close = () => {
      setSearchOpen(false)
      setNavOpen(false)
    }
    window.addEventListener('hashchange', close)
    return () => window.removeEventListener('hashchange', close)
  }, [])

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const term = q.trim()
    navigate(`/shop${term ? `?q=${encodeURIComponent(term)}` : ''}`)
  }

  const isShop = route.path.startsWith('/shop') || route.path.startsWith('/product')
  const isJournal = route.path.startsWith('/journal')
  const isAbout = route.path.startsWith('/about')

  const iconBtn = cn(
    'relative flex h-10 w-10 items-center justify-center text-foreground/85 transition-colors',
    'hover:text-espresso focus-visible:outline-2 focus-visible:outline-ring',
  )

  return (
    <header
      className={cn(
        'no-print sticky top-0 z-50 bg-background/92 backdrop-blur-md transition-[border-color,box-shadow] duration-500',
        scrolled ? 'border-b border-line-strong shadow-[0_1px_24px_-18px_rgba(0,0,0,0.5)]' : 'border-b border-transparent',
      )}
    >
      <div className="container-site">
        <div className="grid h-16 grid-cols-[1fr_auto_1fr] items-center gap-3 sm:h-[4.5rem]">
          {/* ——— left: desktop nav / mobile burger ——— */}
          <div className="flex items-center gap-7">
            <Sheet open={navOpen} onOpenChange={setNavOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  className={cn(iconBtn, 'md:hidden')}
                  aria-label="Open menu"
                >
                  <Menu className="h-5 w-5" strokeWidth={1.5} />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[19rem] border-r border-line bg-background p-0">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <div className="flex h-full flex-col">
                  <div className="border-b border-line px-6 py-5">
                    <Wordmark className="text-left" />
                  </div>
                  <nav className="scroll-elegant flex-1 overflow-y-auto px-6 py-6">
                    <p className="eyebrow mb-3">Shop</p>
                    <ul className="space-y-1">
                      {CATEGORIES.map((c) => (
                        <li key={c.slug || 'all'}>
                          <Link
                            to={`/shop${c.slug ? `?category=${c.slug}` : ''}`}
                            className="block py-2 font-display text-lg tracking-tight hover:text-espresso"
                          >
                            {c.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-7 border-t border-line pt-6">
                      <p className="eyebrow mb-3">The House</p>
                      <ul className="space-y-1">
                        <li>
                          <Link to="/journal" className="block py-2 font-display text-lg tracking-tight hover:text-espresso">
                            Journal
                          </Link>
                        </li>
                        <li>
                          <Link to="/about" className="block py-2 font-display text-lg tracking-tight hover:text-espresso">
                            About
                          </Link>
                        </li>
                        <li>
                          <Link to="/wishlist" className="block py-2 font-display text-lg tracking-tight hover:text-espresso">
                            Wishlist
                          </Link>
                        </li>
                        <li>
                          <Link to="/admin" className="block py-2 font-display text-lg tracking-tight hover:text-espresso">
                            Admin Console
                          </Link>
                        </li>
                      </ul>
                    </div>
                  </nav>
                  <div className="border-t border-line px-6 py-4">
                    <button
                      type="button"
                      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                      className="flex items-center gap-2.5 py-2 text-sm text-muted-foreground hover:text-foreground"
                    >
                      {theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                      {theme === 'dark' ? 'Charcoal mode' : 'Ivory mode'}
                    </button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            <nav className="hidden items-center gap-6 md:flex" aria-label="Primary">
              <Menubar className="h-auto border-0 bg-transparent p-0">
                <MenubarMenu>
                  <MenubarTrigger
                    className={cn(
                      'h-auto rounded-none border-0 bg-transparent px-0 py-2 text-[0.68rem] font-medium uppercase tracking-[0.22em] transition-colors data-[state=open]:bg-transparent data-[highlighted]:bg-transparent',
                      isShop ? 'text-foreground' : 'text-foreground/70 hover:text-foreground',
                    )}
                  >
                    Shop
                  </MenubarTrigger>
                  <MenubarContent className="min-w-[13rem] rounded-[--radius] border-line bg-popover p-2 shadow-lg">
                    {CATEGORIES.map((c) => (
                      <button
                        key={c.slug || 'all'}
                        type="button"
                        onClick={() => navigate(`/shop${c.slug ? `?category=${c.slug}` : ''}`)}
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-secondary focus-visible:bg-secondary focus-visible:outline-none"
                      >
                        {c.label}
                      </button>
                    ))}
                  </MenubarContent>
                </MenubarMenu>
              </Menubar>
              <Link
                to="/journal"
                className={cn(
                  'text-[0.68rem] font-medium uppercase tracking-[0.22em] transition-colors',
                  isJournal ? 'text-foreground' : 'text-foreground/70 hover:text-foreground',
                )}
              >
                Journal
              </Link>
              <Link
                to="/about"
                className={cn(
                  'text-[0.68rem] font-medium uppercase tracking-[0.22em] transition-colors',
                  isAbout ? 'text-foreground' : 'text-foreground/70 hover:text-foreground',
                )}
              >
                About
              </Link>
            </nav>
          </div>

          {/* ——— centre: wordmark ——— */}
          <Wordmark />

          {/* ——— right: icons ——— */}
          <div className="flex items-center justify-end gap-0.5">
            <button
              type="button"
              className={iconBtn}
              aria-label={searchOpen ? 'Close search' : 'Open search'}
              aria-expanded={searchOpen}
              onClick={() => setSearchOpen((v) => !v)}
            >
              {searchOpen ? <X className="h-5 w-5" strokeWidth={1.5} /> : <Search className="h-5 w-5" strokeWidth={1.5} />}
            </button>
            <button
              type="button"
              className={iconBtn}
              aria-label={mounted && customer ? `Account — signed in as ${customer.name}` : 'Account'}
              onClick={() => navigate('/account')}
            >
              <User className="h-5 w-5" strokeWidth={1.5} />
              {mounted && customer ? (
                <span
                  aria-hidden
                  className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-espresso"
                />
              ) : null}
            </button>
            <button
              type="button"
              className={cn(iconBtn, 'hidden sm:flex')}
              aria-label={`Wishlist (${mounted ? wishCount : 0} saved)`}
              onClick={() => navigate('/wishlist')}
            >
              <Heart className="h-5 w-5" strokeWidth={1.5} />
              {mounted ? <IconBadge count={wishCount} /> : null}
            </button>
            <button
              type="button"
              className={iconBtn}
              aria-label={`Shopping bag (${mounted ? cart?.itemCount ?? 0 : 0} items)`}
              onClick={() => setCartOpen(true)}
            >
              <ShoppingBag className="h-5 w-5" strokeWidth={1.5} />
              {mounted ? <IconBadge count={cart?.itemCount ?? 0} /> : null}
            </button>
            <button
              type="button"
              className={cn(iconBtn, 'hidden sm:flex')}
              aria-label="Toggle colour mode"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {mounted && theme === 'dark' ? (
                <Moon className="h-[1.1rem] w-[1.1rem]" strokeWidth={1.5} />
              ) : (
                <Sun className="h-[1.1rem] w-[1.1rem]" strokeWidth={1.5} />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ——— search drawer ——— */}
      {searchOpen ? (
        <div className="border-t border-line bg-background/98 backdrop-blur-md">
          <div className="container-site py-5">
            <form onSubmit={submitSearch} role="search" className="flex items-center gap-3">
              <Search className="h-5 w-5 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden />
              <input
                ref={searchRef}
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search silk, cashmere, tailoring…"
                aria-label="Search products"
                className="w-full border-0 bg-transparent font-display text-xl italic tracking-tight placeholder:text-muted-foreground/50 focus:outline-none focus-visible:outline-none"
              />
              <button
                type="submit"
                className="eyebrow-ink shrink-0 border-b border-foreground pb-0.5 transition-colors hover:text-espresso hover:border-espresso"
              >
                Search
              </button>
            </form>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="eyebrow !text-[0.55rem]">Try</span>
              {['silk', 'cashmere', 'blazer', 'coat', 'tote'].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => navigate(`/shop?q=${t}`)}
                  className="border border-line px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-espresso hover:text-espresso"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </header>
  )
}
