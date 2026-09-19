'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Send, Sparkles, MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

const WHATSAPP_PHONE = '2348163022233'
const DISPLAY_PHONE = '+234 816 302 2233'

const QUICK_INQUIRIES = [
  {
    label: '✨ Custom Measurements & Fit',
    message: 'Hello Style Sence, I would like to ask about custom measurements and bespoke fit for an order.',
  },
  {
    label: '📦 Order Status',
    message: 'Hello Style Sence, I would like to check on the progress/status of my order.',
  },
  {
    label: '🧵 Fabric & Styling Advice',
    message: 'Hello Style Sence, I would love some fabric and styling recommendations from your atelier.',
  },
  {
    label: '💬 General Inquiry',
    message: 'Hello Style Sence, I have a question regarding your current collection.',
  },
]

function WhatsAppIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M12.031 2C6.495 2 2 6.495 2 12.031c0 1.767.461 3.488 1.336 5.006L2 22l5.105-1.338A9.99 9.99 0 0 0 12.031 22c5.536 0 10.031-4.495 10.031-10.031S17.567 2 12.031 2zm0 18.281c-1.579 0-3.125-.424-4.475-1.226l-.321-.19-3.32.87.886-3.235-.208-.332A8.256 8.256 0 0 1 3.75 12.03c0-4.566 3.715-8.281 8.281-8.281 4.566 0 8.281 3.715 8.281 8.281 0 4.566-3.715 8.281-8.281 8.281zm4.536-6.195c-.249-.125-1.472-.726-1.7-.809-.229-.083-.395-.125-.562.125-.166.249-.645.809-.791.975-.145.166-.291.187-.54.062s-1.05-.387-2-1.234c-.739-.659-1.238-1.473-1.383-1.722-.145-.249-.015-.384.109-.508.112-.111.249-.291.374-.436.125-.145.166-.249.249-.415.083-.166.042-.312-.021-.436s-.562-1.354-.77-1.854c-.203-.487-.409-.42-.562-.428l-.478-.008c-.166 0-.436.062-.665.312-.229.249-.873.853-.873 2.08s.894 2.411 1.019 2.577c.125.166 1.758 2.685 4.26 3.766.595.257 1.06.41 1.423.525.599.19 1.144.163 1.575.099.48-.072 1.472-.602 1.68-1.184.208-.582.208-1.081.145-1.184-.062-.104-.228-.166-.477-.291z" />
    </svg>
  )
}

export function WhatsAppWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [showTooltip, setShowTooltip] = useState(false)
  const widgetRef = useRef<HTMLDivElement>(null)

  // Show a gentle introductory prompt tooltip once on load, fade after 6s
  useEffect(() => {
    const timer = setTimeout(() => setShowTooltip(true), 2500)
    const hideTimer = setTimeout(() => setShowTooltip(false), 9000)
    return () => {
      clearTimeout(timer)
      clearTimeout(hideTimer)
    }
  }, [])

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (widgetRef.current && !widgetRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const handleStartChat = (customMsg?: string) => {
    const textToSend = customMsg ?? (message.trim() || 'Hello Style Sence, I would like to inquire about your collection.')
    const url = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(textToSend)}`
    window.open(url, '_blank', 'noopener,noreferrer')
    setIsOpen(false)
  }

  const handleSelectQuickInquiry = (inquiryMessage: string) => {
    setMessage(inquiryMessage)
  }

  return (
    <div
      ref={widgetRef}
      className="no-print fixed bottom-6 right-4 z-40 font-sans lg:bottom-8 lg:right-8"
      aria-label="WhatsApp Concierge"
    >
      {/* Floating expanded concierge card */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="concierge-heading"
          className={cn(
            'absolute bottom-16 right-0 mb-2 w-[calc(100vw-2rem)] max-w-sm overflow-hidden',
            'border border-line-strong bg-background/95 text-foreground backdrop-blur-xl',
            'shadow-[0_16px_40px_-12px_oklch(0.235_0.008_70_/_0.22)]',
            'animate-in fade-in zoom-in-95 duration-200 ease-out',
            'rounded-sm'
          )}
        >
          {/* Header */}
          <div className="relative border-b border-line bg-secondary/80 px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="relative flex h-10 w-10 shrink-0 items-center justify-center border border-line-strong bg-background text-foreground font-display text-sm tracking-wider">
                  SKR
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-emerald-500" />
                </div>
                <div>
                  <h3 id="concierge-heading" className="font-display text-[1rem] font-medium leading-snug tracking-tight text-foreground">
                    Atelier Concierge
                  </h3>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Direct Line • Typically replies within minutes
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close concierge window"
                className="rounded-sm p-1 text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Chat Body */}
          <div className="max-h-[60vh] overflow-y-auto p-5 space-y-4 text-sm">
            {/* Atelier Welcome Note */}
            <div className="rounded-sm border border-line bg-background/80 p-3.5 shadow-xs">
              <p className="font-serif italic text-xs text-muted-foreground mb-1">Style Sence Client Relations</p>
              <p className="leading-relaxed text-foreground text-[0.825rem]">
                Welcome to Style Sence by SKR. How may our Lagos atelier assist your order, bespoke measurements, or fabric selection today?
              </p>
              <span className="mt-2 block text-[0.65rem] text-muted-foreground/70 text-right">
                Mon – Sat, 9am – 8pm WAT
              </span>
            </div>

            {/* Quick Inquiries */}
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-[0.75rem] font-medium uppercase tracking-wider text-muted-foreground">
                <Sparkles className="h-3 w-3 text-espresso" />
                Quick Inquiries
              </p>
              <div className="grid grid-cols-1 gap-1.5">
                {QUICK_INQUIRIES.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => handleSelectQuickInquiry(item.message)}
                    className="flex items-center justify-between rounded-sm border border-line bg-secondary/40 px-3 py-2 text-left text-xs text-foreground transition-all hover:border-line-strong hover:bg-secondary/90 hover:translate-x-0.5 focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <span>{item.label}</span>
                    <span className="text-muted-foreground text-[0.7rem]">Select</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Input */}
            <div className="space-y-2 pt-1">
              <label htmlFor="whatsapp-concierge-msg" className="block text-xs font-medium text-muted-foreground">
                Your message:
              </label>
              <textarea
                id="whatsapp-concierge-msg"
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your question or custom request here..."
                className="w-full resize-none rounded-sm border border-line bg-background px-3 py-2 text-xs leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:border-foreground focus:outline-hidden"
              />

              <button
                type="button"
                onClick={() => handleStartChat()}
                className="flex w-full items-center justify-center gap-2 rounded-sm bg-foreground px-4 py-2.5 text-xs font-medium text-background transition-all hover:opacity-90 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-ring"
              >
                <WhatsAppIcon className="h-4 w-4 fill-background" />
                <span>Start WhatsApp Chat</span>
                <Send className="h-3.5 w-3.5 opacity-70" />
              </button>
            </div>
          </div>

          {/* Footer Line */}
          <div className="border-t border-line bg-secondary/50 px-5 py-2.5 text-center text-[0.7rem] text-muted-foreground">
            Official House Number: <span className="font-mono text-foreground font-medium">{DISPLAY_PHONE}</span>
          </div>
        </div>
      )}

      {/* Floating Prompt Tooltip (auto-shown once, or on hover) */}
      {!isOpen && showTooltip && (
        <div
          className={cn(
            'absolute bottom-full right-0 mb-3 whitespace-nowrap rounded-sm border border-line-strong bg-background/95 px-3 py-1.5',
            'text-xs font-medium text-foreground shadow-md backdrop-blur-md',
            'animate-in fade-in slide-in-from-bottom-2 duration-300'
          )}
        >
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
            <span>Chat with our Atelier Stylist</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setShowTooltip(false)
              }}
              className="ml-1 text-muted-foreground hover:text-foreground"
              aria-label="Dismiss tooltip"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      {/* Floating Trigger Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen)
          setShowTooltip(false)
        }}
        aria-expanded={isOpen}
        aria-label={isOpen ? 'Close WhatsApp Concierge' : 'Open WhatsApp Concierge'}
        className={cn(
          'group relative flex items-center gap-2.5 rounded-full border border-line-strong bg-background/95 p-3 text-foreground',
          'shadow-[0_4px_20px_oklch(0.235_0.008_70_/_0.12)] backdrop-blur-md',
          'transition-all duration-300 hover:border-foreground hover:shadow-lg focus-visible:outline-2 focus-visible:outline-ring',
          isOpen ? 'bg-secondary' : 'hover:scale-[1.03]'
        )}
      >
        {/* Status indicator badge */}
        <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 border border-background" />
        </span>

        {isOpen ? (
          <div className="flex h-6 w-6 items-center justify-center">
            <X className="h-4 w-4 transition-transform duration-200 group-hover:rotate-90" />
          </div>
        ) : (
          <>
            <div className="flex h-6 w-6 items-center justify-center text-[#25D366] transition-transform duration-200 group-hover:scale-110">
              <WhatsAppIcon className="h-5 w-5 fill-current" />
            </div>
            <span className="hidden pr-1 font-display text-xs font-medium tracking-tight sm:inline-block">
              Atelier Concierge
            </span>
          </>
        )}
      </button>
    </div>
  )
}
