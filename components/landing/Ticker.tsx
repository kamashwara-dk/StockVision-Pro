// Static ticker — no client fetching needed, avoids hydration flicker
const TICKER_ITEMS = [
  { symbol: "RELIANCE.NS",  price: 2950.00, change: 0.9,  currency: "₹" },
  { symbol: "TCS.NS",       price: 3600.00, change: 1.2,  currency: "₹" },
  { symbol: "INFY.NS",      price: 1480.00, change: -0.5, currency: "₹" },
  { symbol: "HDFCBANK.NS",  price: 1620.00, change: 0.7,  currency: "₹" },
  { symbol: "ICICIBANK.NS", price: 970.00,  change: 1.1,  currency: "₹" },
  { symbol: "WIPRO.NS",     price: 460.00,  change: -0.3, currency: "₹" },
  { symbol: "TATAMOTORS.NS",price: 780.00,  change: 2.1,  currency: "₹" },
  { symbol: "SUNPHARMA.NS", price: 1350.00, change: 0.8,  currency: "₹" },
  { symbol: "ONGC.NS",      price: 195.00,  change: -0.4, currency: "₹" },
  { symbol: "CUPID.NS",     price: 282.00,  change: 2.05, currency: "₹" },
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
              <span className="text-[var(--text-secondary)] text-sm">{item.currency}{item.price.toLocaleString("en-IN")}</span>
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
