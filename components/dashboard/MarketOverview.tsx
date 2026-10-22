"use client";

import { useEffect, useState } from "react";
import { usePortfolio } from "@/components/providers/PortfolioProvider";
import { TrendingUp, TrendingDown, RefreshCw } from "lucide-react";

interface MarketItem {
  symbol: string;       // Yahoo Finance ticker
  label: string;        // Display name
  region: "india" | "global";
  flag: string;
}

// Key Indian & global indices via Yahoo Finance
const MARKETS: MarketItem[] = [
  // Indian
  { symbol: "^BSESN",  label: "BSE Sensex",    region: "india",  flag: "🇮🇳" },
  { symbol: "^NSEI",   label: "NSE Nifty 50",  region: "india",  flag: "🇮🇳" },
  { symbol: "^NSEBANK",label: "Nifty Bank",     region: "india",  flag: "🇮🇳" },
  { symbol: "RELIANCE.NS", label: "Reliance",   region: "india",  flag: "🇮🇳" },
  { symbol: "TCS.NS",  label: "TCS",            region: "india",  flag: "🇮🇳" },
  { symbol: "INFY.NS", label: "Infosys",        region: "india",  flag: "🇮🇳" },
  // Global
  { symbol: "^GSPC",   label: "S&P 500",        region: "global", flag: "🇺🇸" },
  { symbol: "^DJI",    label: "Dow Jones",      region: "global", flag: "🇺🇸" },
  { symbol: "^IXIC",   label: "NASDAQ",         region: "global", flag: "🇺🇸" },
  { symbol: "^FTSE",   label: "FTSE 100",       region: "global", flag: "🇬🇧" },
  { symbol: "^N225",   label: "Nikkei 225",     region: "global", flag: "🇯🇵" },
  { symbol: "^HSI",    label: "Hang Seng",      region: "global", flag: "🇭🇰" },
];

interface QuoteData {
  symbol: string;
  price: number;
  change_pct: number;
  currency: string;
}

function Sparkline({ up }: { up: boolean }) {
  // Mini decorative sparkline — SVG path varies by direction
  const path = up
    ? "M0,20 L8,16 L16,18 L24,10 L32,12 L40,6 L48,8 L56,2"
    : "M0,4  L8,8  L16,6  L24,14 L32,12 L40,18 L48,16 L56,20";
  return (
    <svg width="56" height="24" viewBox="0 0 56 24" fill="none" className="opacity-80">
      <path
        d={path}
        stroke={up ? "var(--positive)" : "var(--negative)"}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function MarketOverview() {
  const { formatQuote } = usePortfolio();
  const [quotes, setQuotes] = useState<Record<string, QuoteData>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "india" | "global">("all");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    const results = await Promise.all(
      MARKETS.map(async ({ symbol }) => {
        try {
          const res = await fetch(`/api/quote?ticker=${encodeURIComponent(symbol)}`);
          if (res.ok) {
            const data = await res.json();
            if (!data.error) return [symbol, data] as [string, QuoteData];
          }
        } catch { /* skip */ }
        return null;
      })
    );

    const map: Record<string, QuoteData> = {};
    results.forEach(r => { if (r) map[r[0]] = r[1]; });
    setQuotes(map);
    setLastUpdated(new Date());
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const displayed = MARKETS.filter(m =>
    filter === "all" ? true : m.region === filter
  );

  return (
    <div className="mb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">Market Overview</h2>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            Indian &amp; global indices · prices in your selected currency
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Region filter */}
          <div className="flex bg-[var(--card)] rounded-lg p-1 border border-[var(--border)]">
            {(["all", "india", "global"] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-xs font-bold rounded-md capitalize transition-colors ${
                  filter === f
                    ? "bg-[var(--surface)] text-white border border-[var(--border)]"
                    : "text-[var(--text-secondary)] hover:text-white"
                }`}
              >
                {f === "india" ? "🇮🇳 India" : f === "global" ? "🌐 Global" : "All"}
              </button>
            ))}
          </div>
          {/* Refresh */}
          <button
            onClick={() => fetchAll(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-white transition-colors bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-1.5"
          >
            <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Last updated */}
      {lastUpdated && (
        <p className="text-xs text-[var(--text-muted)] mb-4">
          Updated {lastUpdated.toLocaleTimeString()}
        </p>
      )}

      {/* Cards grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {Array(12).fill(0).map((_, i) => (
            <div key={i} className="bg-[var(--card)] border border-[var(--border)] rounded-2xl h-32 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {displayed.map(({ symbol, label, flag }) => {
            const q = quotes[symbol];
            const isUp = q ? q.change_pct >= 0 : true;

            return (
              <div
                key={symbol}
                className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 flex flex-col gap-3 hover:border-[var(--accent)] transition-colors group"
              >
                {/* Top row */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs text-[var(--text-muted)] mb-0.5">{flag}</div>
                    <div className="text-sm font-bold text-white leading-tight">{label}</div>
                  </div>
                  <Sparkline up={isUp} />
                </div>

                {/* Price */}
                {q ? (
                  <>
                    <div className="text-lg font-mono font-bold text-white leading-none">
                      {formatQuote(q.price, q.currency)}
                    </div>
                    {/* Change badge — Apple Stocks style */}
                    <div className={`inline-flex items-center gap-1 self-start px-2 py-0.5 rounded-md text-xs font-bold ${
                      isUp
                        ? "bg-[rgba(0,229,160,0.15)] text-[var(--positive)]"
                        : "bg-[rgba(255,90,90,0.15)] text-[var(--negative)]"
                    }`}>
                      {isUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                      {isUp ? "+" : ""}{q.change_pct.toFixed(2)}%
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-[var(--text-muted)]">Unavailable</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
