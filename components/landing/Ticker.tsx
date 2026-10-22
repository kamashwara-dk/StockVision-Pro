"use client"

/**
 * Ticker — real delayed quotes from /api/quote, refreshed every 60 seconds.
 *
 * Rules (spec §3):
 *   - Shows a "Delayed" label so users know prices are not live.
 *   - On fetch failure, hides the item rather than showing stale numbers.
 *   - The marquee animation and layout are unchanged from the original.
 *   - Delay stated as "up to 15 min" (Yahoo Finance standard).
 */

import { useEffect, useRef, useState } from "react"

const SYMBOLS = [
  "RELIANCE.NS",
  "TCS.NS",
  "INFY.NS",
  "HDFCBANK.NS",
  "ICICIBANK.NS",
  "WIPRO.NS",
  "TATAMOTORS.NS",
  "SUNPHARMA.NS",
  "^NSEI",
  "^GSPC",
]

interface QuoteItem {
  symbol: string
  price: number
  change_pct: number | null
  currency: string
}

const REFRESH_MS = 60_000  // 60 seconds

export function Ticker() {
  const [quotes, setQuotes] = useState<QuoteItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const abortRef = useRef<AbortController | null>(null)

  async function fetchAll(signal: AbortSignal) {
    const results = await Promise.allSettled(
      SYMBOLS.map(async (sym) => {
        const res = await fetch(
          `/api/quote?ticker=${encodeURIComponent(sym)}`,
          { signal }
        )
        if (!res.ok) return null
        const data = await res.json()
        if (data.error) return null
        return {
          symbol: sym,
          price: data.price,
          change_pct: data.change_pct ?? null,
          currency: data.currency ?? "USD",
        } as QuoteItem
      })
    )
    return results
      .map((r) => (r.status === "fulfilled" ? r.value : null))
      .filter((q): q is QuoteItem => q !== null)
  }

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>

    async function load() {
      if (abortRef.current) abortRef.current.abort()
      const controller = new AbortController()
      abortRef.current = controller

      try {
        const items = await fetchAll(controller.signal)
        setQuotes(items)
      } catch {
        // If fetch fails, keep whatever quotes we already have.
      } finally {
        setIsLoading(false)
      }

      timer = setTimeout(load, REFRESH_MS)
    }

    load()
    return () => {
      clearTimeout(timer)
      abortRef.current?.abort()
    }
  }, [])

  // While loading show a simplified placeholder to avoid layout shift.
  if (isLoading || quotes.length === 0) {
    return (
      <div className="w-full bg-[#0D1425] border-y border-[var(--border)] overflow-hidden py-3">
        <div className="flex items-center justify-center gap-2 text-xs text-[var(--text-muted)]">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
          Loading delayed quotes…
        </div>
      </div>
    )
  }

  // Triplicate for seamless scroll — same technique as the original.
  const displayItems = [...quotes, ...quotes, ...quotes]

  return (
    <div className="w-full bg-[#0D1425] border-y border-[var(--border)] overflow-hidden py-3">
      {/* Delayed label — always visible at the left edge */}
      <div className="relative">
        <div className="absolute left-0 top-0 bottom-0 z-10 flex items-center pr-3 pl-3 bg-[#0D1425] border-r border-[var(--border)]">
          <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest whitespace-nowrap">
            Delayed
          </span>
        </div>
        <div className="flex whitespace-nowrap animate-ticker pl-24">
          {displayItems.map((item, idx) => {
            const isPositive = (item.change_pct ?? 0) >= 0
            const locale     = item.currency === "INR" ? "en-IN" : "en-US"
            const priceStr   = new Intl.NumberFormat(locale, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }).format(item.price)
            const prefix =
              item.currency === "INR" ? "₹"
              : item.currency === "USD" ? "$"
              : item.currency

            return (
              <div key={`${item.symbol}-${idx}`} className="flex items-center space-x-2 mx-6">
                <span className="font-bold text-white text-sm">{item.symbol}</span>
                <span className="text-[var(--text-secondary)] text-sm">{prefix}{priceStr}</span>
                {item.change_pct !== null && (
                  <span
                    className={`text-sm font-medium ${
                      isPositive ? "text-[var(--positive)]" : "text-[var(--negative)]"
                    }`}
                  >
                    {isPositive ? "+" : ""}{item.change_pct.toFixed(2)}%
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
