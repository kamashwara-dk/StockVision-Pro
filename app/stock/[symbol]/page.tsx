import { Sidebar } from "@/components/dashboard/Sidebar";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ConfidenceBar } from "@/components/ui/ConfidenceBar";
import { Badge } from "@/components/ui/Badge";
import { TrendingUp, AlertTriangle } from "lucide-react";

interface Props {
  params: Promise<{ symbol: string }>;
}

async function getStockData(symbol: string) {
  try {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const [quoteRes, predictRes] = await Promise.all([
      fetch(`${base}/api/quote?ticker=${symbol}`, { next: { revalidate: 60 } }),
      fetch(`${base}/api/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: symbol, forecast_days: 30 }),
        next: { revalidate: 300 },
      }),
    ]);
    const quote = quoteRes.ok ? await quoteRes.json() : null;
    const pred  = predictRes.ok ? await predictRes.json() : null;
    return { quote, pred };
  } catch {
    return { quote: null, pred: null };
  }
}

/** Format a price in its native currency using locale-aware formatting */
function fmtNative(price: number, currency: string): string {
  // Use en-IN locale for INR (gives ₹ and Indian grouping), en-US for everything else
  const locale = currency === "INR" ? "en-IN" : "en-US";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  } catch {
    return `${currency} ${price.toFixed(2)}`;
  }
}

export default async function StockDetailPage({ params }: Props) {
  const { symbol: rawSymbol } = await params;
  const symbol = rawSymbol.toUpperCase();

  const { quote, pred } = await getStockData(symbol);

  // Native currency of this stock from Yahoo Finance
  const nativeCurrency: string = pred?.currency ?? quote?.currency ?? "USD";

  const currentPrice: number = quote?.price ?? pred?.current_price ?? 0;
  const changePct: number    = quote?.change_pct ?? 0;
  const isPositive           = changePct >= 0;

  const targetPrice: number  = pred?.target_price ?? currentPrice * 1.05;
  const confidence: number   = pred?.confidence ?? 70;
  const keyFactors: string[] = pred?.key_factors ?? ["Insufficient data — run full analysis from the Predictions page"];
  const bullCase: number     = pred?.bull_case ?? targetPrice * 1.15;
  const bearCase: number     = pred?.bear_case ?? targetPrice * 0.85;

  const forecastRecords: {
    date: string;
    predicted_close: number;
    bb_upper: number;
    bb_lower: number;
    rsi: number;
  }[] = pred?.records ?? [];

  const targetChangePct = currentPrice > 0 ? ((targetPrice - currentPrice) / currentPrice) * 100 : 0;

  const fmt = (p: number) => fmtNative(p, nativeCurrency);

  return (
    <div className="flex h-screen bg-[#0A0F1E] overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <div className="pb-12">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <div>
              <div className="flex items-center gap-3 flex-wrap gap-y-2">
                <h1 className="text-3xl font-bold text-white">{symbol}</h1>
                <Badge variant={isPositive ? "positive" : "negative"}>
                  {isPositive ? "BUY" : "SELL"} SIGNAL
                </Badge>
                <span className="text-xs px-2 py-1 rounded bg-white/5 border border-white/10 text-[var(--text-muted)] font-mono">
                  {nativeCurrency}
                </span>
              </div>
              <p className="text-[var(--text-secondary)] mt-1">
                {quote?.exchange ?? "Market"} · Live Data
              </p>
            </div>
          </div>

          {/* Top Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
              <div className="text-xs text-[var(--text-secondary)] mb-1">Current Price</div>
              <div className="text-2xl font-bold font-mono text-white">{fmt(currentPrice)}</div>
              <div className={`text-sm font-medium mt-1 ${isPositive ? "text-[var(--positive)]" : "text-[var(--negative)]"}`}>
                {isPositive ? "+" : ""}{changePct.toFixed(2)}% today
              </div>
            </div>
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
              <div className="text-xs text-[var(--text-secondary)] mb-1">AI Target (30d)</div>
              <div className="text-2xl font-bold font-mono text-white">{fmt(targetPrice)}</div>
              <div className={`text-sm font-medium mt-1 ${targetChangePct >= 0 ? "text-[var(--positive)]" : "text-[var(--negative)]"}`}>
                {targetChangePct >= 0 ? "+" : ""}{targetChangePct.toFixed(1)}%
              </div>
            </div>
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
              <div className="text-xs text-[var(--text-secondary)] mb-1">Confidence</div>
              <div className="text-2xl font-bold text-white">{confidence}%</div>
              <div className="text-xs text-[var(--text-muted)] mt-1">Model accuracy</div>
            </div>
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
              <div className="text-xs text-[var(--text-secondary)] mb-1">Bull / Bear Case</div>
              <div className="text-base font-bold font-mono text-white leading-tight">
                <span className="text-[var(--positive)]">{fmt(bullCase)}</span>
                <span className="text-[var(--text-muted)] mx-1">/</span>
                <span className="text-[var(--negative)]">{fmt(bearCase)}</span>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            {/* Left — Forecast table */}
            <div className="xl:col-span-2">
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl overflow-hidden">
                <div className="p-6 border-b border-[var(--border)] flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white">30-Day Forecast Table</h3>
                    <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                      Day-by-day predicted close · Bollinger Bands · RSI · all in {nativeCurrency}
                    </p>
                  </div>
                </div>
                {forecastRecords.length === 0 ? (
                  <div className="p-8 text-center text-[var(--text-muted)]">
                    Forecast data unavailable. Check the ticker symbol.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-[#0D1425] text-xs text-[var(--text-muted)] uppercase">
                        <tr>
                          <th className="px-4 py-3">#</th>
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3 text-right">Pred. Close</th>
                          <th className="px-4 py-3 text-right">BB Upper</th>
                          <th className="px-4 py-3 text-right">BB Lower</th>
                          <th className="px-4 py-3 text-right">RSI</th>
                          <th className="px-4 py-3 text-right">Signal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {forecastRecords.map((row, i) => {
                          const prev     = i === 0 ? currentPrice : forecastRecords[i - 1].predicted_close;
                          const dayChange = ((row.predicted_close - prev) / prev) * 100;
                          const dayUp     = dayChange >= 0;
                          const rsiLabel  = row.rsi > 70 ? "Overbought" : row.rsi < 30 ? "Oversold" : "Neutral";
                          const rsiColor  = row.rsi > 70 ? "text-[var(--negative)]" : row.rsi < 30 ? "text-[var(--warning)]" : "text-[var(--text-secondary)]";
                          return (
                            <tr key={row.date} className="border-t border-[var(--border)] hover:bg-[var(--surface)] transition-colors">
                              <td className="px-4 py-3 text-[var(--text-muted)] font-mono text-xs">{i + 1}</td>
                              <td className="px-4 py-3 font-medium text-white">{row.date}</td>
                              <td className={`px-4 py-3 text-right font-mono font-bold ${dayUp ? "text-[var(--positive)]" : "text-[var(--negative)]"}`}>
                                {fmt(row.predicted_close)}
                                <span className="text-xs ml-1 opacity-70">
                                  {dayUp ? "▲" : "▼"}{Math.abs(dayChange).toFixed(2)}%
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right font-mono text-[var(--text-secondary)]">{fmt(row.bb_upper)}</td>
                              <td className="px-4 py-3 text-right font-mono text-[var(--text-secondary)]">{fmt(row.bb_lower)}</td>
                              <td className="px-4 py-3 text-right font-mono text-white">{row.rsi.toFixed(1)}</td>
                              <td className={`px-4 py-3 text-right text-xs font-bold ${rsiColor}`}>{rsiLabel}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Right — AI panel */}
            <div className="xl:col-span-1 space-y-6">
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6">
                <SectionHeader title="AI Analysis" showPulse />
                <ConfidenceBar score={confidence} className="mb-6" />
                <h4 className="text-sm font-bold text-white mb-3">Key Drivers</h4>
                <ul className="space-y-2 mb-6">
                  {keyFactors.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                      {f.toLowerCase().includes("bearish") || f.toLowerCase().includes("below") || f.toLowerCase().includes("overbought")
                        ? <AlertTriangle size={16} className="text-[var(--warning)] mt-0.5 shrink-0" />
                        : <TrendingUp size={16} className="text-[var(--positive)] mt-0.5 shrink-0" />}
                      {f}
                    </li>
                  ))}
                </ul>
                <div className={`p-4 rounded-xl border ${targetChangePct >= 0 ? "bg-[rgba(0,229,160,0.1)] border-[var(--accent)]" : "bg-[rgba(255,90,90,0.1)] border-[var(--negative)]"}`}>
                  <h4 className={`font-bold text-sm mb-1 ${targetChangePct >= 0 ? "text-[var(--accent)]" : "text-[var(--negative)]"}`}>
                    Recommendation: {targetChangePct >= 5 ? "Accumulate" : targetChangePct >= 0 ? "Hold" : "Caution"}
                  </h4>
                  <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
                    Model projects a {targetChangePct >= 0 ? "gain" : "decline"} of {Math.abs(targetChangePct).toFixed(1)}% over 30 days with {confidence}% confidence.
                  </p>
                </div>
              </div>

              {/* Price scenarios */}
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6">
                <SectionHeader title="Price Scenarios" />
                <div className="space-y-3">
                  {[
                    { label: "Bull Case", value: bullCase, color: "text-[var(--positive)]" },
                    { label: "Base Case", value: targetPrice, color: "text-white" },
                    { label: "Bear Case", value: bearCase, color: "text-[var(--negative)]" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="flex items-center justify-between p-3 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
                      <span className="text-sm text-white font-medium">{label}</span>
                      <span className={`text-sm font-mono font-bold ${color}`}>{fmt(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
