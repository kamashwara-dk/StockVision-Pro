// Static ticker — no client fetching needed, avoids hydration flicker
const TICKER_ITEMS = [
  { symbol: "AAPL", price: 195.40, change: 1.2 },
  { symbol: "TSLA", price: 185.10, change: -0.8 },
  { symbol: "NVDA", price: 850.30, change: 3.4 },
  { symbol: "MSFT", price: 420.55, change: 0.6 },
  { symbol: "AMZN", price: 178.15, change: 1.9 },
  { symbol: "GOOGL", price: 160.20, change: -0.3 },
  { symbol: "META", price: 490.10, change: 2.1 },
  { symbol: "NFLX", price: 620.45, change: -1.1 },
  { symbol: "AMD", price: 170.80, change: 1.5 },
  { symbol: "RELIANCE.NS", price: 2950.00, change: 0.9 },
]

// Triplicate for seamless infinite scroll
const displayItems = [...TICKER_ITEMS, ...TICKER_ITEMS, ...TICKER_ITEMS]

export function Ticker() {
  return (
    <div className="w-full bg-[#0D1425] border-y border-[var(--border)] overflow-hidden py-3">
      <div className="flex whitespace-nowrap animate-ticker">
        {displayItems.map((item, idx) => {
          const isPositive = item.change >= 0
          return (
            <div key={`${item.symbol}-${idx}`} className="flex items-center space-x-2 mx-6">
              <span className="font-bold text-white text-sm">{item.symbol}</span>
              <span className="text-[var(--text-secondary)] text-sm">${item.price.toFixed(2)}</span>
              <span className={`text-sm font-medium ${isPositive ? "text-[var(--positive)]" : "text-[var(--negative)]"}`}>
                {isPositive ? "+" : ""}{item.change}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
