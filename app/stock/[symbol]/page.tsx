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
        body: JSON.stringify({ ticker: symbol, forecast_days: 1 }),
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

function fmtNative(price: number, currency: string): string {
  const locale = currency === "INR" ? "en-IN" : "en-US";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency", currency,
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(price);
  } catch {
    return `${currency} ${price.toFixed(2)}`;
  }
}

function fmtPct(v: number, decimals = 2): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(decimals)}%`;
}

export default async function StockDetailPage({ params }: Props) {
  const { symbol: rawSymbol } = await params;
  const symbol = rawSymbol.toUpperCase();

  const { quote, pred } = await getStockData(symbol);

  const nativeCurrency: string = pred?.currency ?? quote?.currency ?? "USD";
  const currentPrice: number   = quote?.price ?? pred?.current_price ?? 0;
  const changePct: number      = quote?.change_pct ?? 0;
  const isPositive             = changePct >= 0;

  // These come from real forecast_runs metrics now (not hardcoded).
  const targetPrice: number  = pred?.target_price ?? 0;
  // directional_accuracy (0–100) mapped to the confidence field in /api/predict.
  const directionalAccuracy: number = pred?.confidence ?? 0;
  const keyFactors: string[] = pred?.key_factors ?? ["Run a forecast to see analysis."];
  const intervalHigh: number = pred?.bull_case ?? 0;
  const intervalLow: number  = pred?.bear_case ?? 0;

  // Real metrics from the forecast_runs row (populated by /api/predict).
  const metrics = pred?.metrics ?? null;

  const targetChangePct = currentPrice > 0 && targetPrice > 0
    ? ((targetPrice - currentPrice) / currentPrice) * 100
    : 0;

  const fmt = (p: number) => fmtNative(p, nativeCurrency);

  // Whether the forecast is available and completed.
  const forecastAvailable = pred && !pred.error && targetPrice > 0;

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
                {forecastAvailable && (
                  <Badge variant={targetChangePct >= 0 ? "positive" : "negative"}>
                    {targetChangePct >= 0 ? "FORECAST ▲" : "FORECAST ▼"}
                  </Badge>
                )}
                <span className="text-xs px-2 py-1 rounded bg-white/5 border border-white/10 text-[var(--text-muted)] font-mono">
                  {nativeCurrency}
                </span>
              </div>
              <p className="text-[var(--text-secondary)] mt-1">
                {quote?.exchange ?? "Market"}{" "}
                · <span className="text-[var(--text-muted)] text-xs">Delayed up to 15 min</span>
              </p>
            </div>
          </div>

          {/* Top Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
              <div className="text-xs text-[var(--text-secondary)] mb-1">Last price (delayed)</div>
              <div className="text-2xl font-bold font-mono text-white">{fmt(currentPrice)}</div>
              <div className={`text-sm font-medium mt-1 ${isPositive ? "text-[var(--positive)]" : "text-[var(--negative)]"}`}>
                {fmtPct(changePct)} vs prev close
              </div>
            </div>

            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
              <div className="text-xs text-[var(--text-secondary)] mb-1">Forecast (next trading day)</div>
              <div className="text-2xl font-bold font-mono text-white">
                {forecastAvailable ? fmt(targetPrice) : "—"}
              </div>
              {forecastAvailable && (
                <div className={`text-sm font-medium mt-1 ${targetChangePct >= 0 ? "text-[var(--positive)]" : "text-[var(--negative)]"}`}>
                  {fmtPct(targetChangePct)} from last
                </div>
              )}
            </div>

            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
              <div className="text-xs text-[var(--text-secondary)] mb-1">Directional accuracy</div>
              <div className="text-2xl font-bold text-white">
                {forecastAvailable ? `${directionalAccuracy.toFixed(1)}%` : "—"}
              </div>
              <div className="text-xs text-[var(--text-muted)] mt-1">
                {forecastAvailable && metrics
                  ? `on ${metrics.n_test_days} held-out days`
                  : "on held-out test data"}
              </div>
            </div>

            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
              <div className="text-xs text-[var(--text-secondary)] mb-1">80% interval</div>
              <div className="text-base font-bold font-mono text-white leading-tight">
                {forecastAvailable && intervalLow > 0 ? (
                  <>
                    <span className="text-[var(--positive)]">{fmt(intervalHigh)}</span>
                    <span className="text-[var(--text-muted)] mx-1">/</span>
                    <span className="text-[var(--negative)]">{fmt(intervalLow)}</span>
                  </>
                ) : "—"}
              </div>
              <div className="text-xs text-[var(--text-muted)] mt-1">upper / lower</div>
            </div>
          </div>

          {/* Main Content */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

            {/* Left — forecast records table (still shown; records array is now empty
                for 1-day model, so the empty state shows instead) */}
            <div className="xl:col-span-2">
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl overflow-hidden">
                <div className="p-6 border-b border-[var(--border)]">
                  <div>
                    <h3 className="text-lg font-bold text-white">Forecast Details</h3>
                    <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                      Next-day closing price · accuracy measured on the most recent 20% of data
                    </p>
                  </div>
                </div>

                {/* ── Accuracy panel (new — built from existing components/tokens) ── */}
                {forecastAvailable && metrics ? (
                  <div className="p-6 border-b border-[var(--border)]">
                    <h4 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">
                      Model accuracy — held-out test window
                    </h4>
                    <p className="text-xs text-[var(--text-muted)] mb-4">
                      Evaluated on the most recent 20% of data ({metrics.test_start} to {metrics.test_end}),
                      {" "}{metrics.n_test_days} trading days. Naive baseline: tomorrow = today.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                      {/* Directional accuracy */}
                      <div className="bg-[var(--surface)] rounded-xl p-4 border border-[var(--border)]">
                        <div className="text-xs text-[var(--text-muted)] mb-1">Directional accuracy</div>
                        <div className="text-xl font-bold font-mono text-white">
                          {metrics.directional_accuracy.toFixed(1)}%
                        </div>
                        <div className="text-xs text-[var(--text-muted)] mt-1">
                          Baseline: {metrics.baseline_directional.toFixed(1)}%
                        </div>
                        <div className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
                          % of days where the model correctly predicted up or down.
                          Zero-change days are excluded.
                        </div>
                      </div>

                      {/* MAPE */}
                      <div className="bg-[var(--surface)] rounded-xl p-4 border border-[var(--border)]">
                        <div className="text-xs text-[var(--text-muted)] mb-1">MAPE</div>
                        <div className="text-xl font-bold font-mono text-white">
                          {metrics.mape.toFixed(2)}%
                        </div>
                        <div className="text-xs text-[var(--text-muted)] mt-1">
                          Baseline: {metrics.baseline_mape.toFixed(2)}%
                        </div>
                        <div className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
                          Mean absolute percentage error. Lower is better.
                        </div>
                      </div>

                      {/* RMSE */}
                      <div className="bg-[var(--surface)] rounded-xl p-4 border border-[var(--border)]">
                        <div className="text-xs text-[var(--text-muted)] mb-1">RMSE ({nativeCurrency})</div>
                        <div className="text-xl font-bold font-mono text-white">
                          {fmtNative(metrics.rmse, nativeCurrency)}
                        </div>
                        <div className="text-xs text-[var(--text-muted)] mt-1">
                          Baseline: {fmtNative(metrics.baseline_rmse, nativeCurrency)}
                        </div>
                        <div className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
                          Root mean squared error in price terms. Lower is better.
                        </div>
                      </div>
                    </div>

                    {/* Verdict */}
                    <div className={`p-4 rounded-xl border text-sm leading-relaxed ${
                      metrics.beats_baseline
                        ? "bg-[rgba(0,229,160,0.07)] border-[rgba(0,229,160,0.2)] text-[var(--text-secondary)]"
                        : "bg-[rgba(255,255,255,0.03)] border-[var(--border)] text-[var(--text-muted)]"
                    }`}>
                      {metrics.beats_baseline
                        ? `On this test period the model beats the naive baseline on both MAPE and RMSE.`
                        : `On this test period the model does not beat the naive baseline (tomorrow = today).`}
                      {" "}No claims of statistical significance are made.
                    </div>
                  </div>
                ) : forecastAvailable ? (
                  <div className="p-6 text-sm text-[var(--text-muted)] border-b border-[var(--border)]">
                    Accuracy metrics are not yet available. The forecast job may still be running.
                  </div>
                ) : (
                  <div className="p-6 text-sm text-[var(--text-muted)] border-b border-[var(--border)]">
                    Forecast data unavailable. Check the ticker symbol or try again.
                  </div>
                )}

                {/* Legacy records table — now always empty for the 1-day model */}
                <div className="p-8 text-center text-[var(--text-muted)] text-sm">
                  Day-by-day forecast tables are not available for the next-day model.
                  The forecast above covers the next trading session only.
                </div>
              </div>
            </div>

            {/* Right — Analysis panel */}
            <div className="xl:col-span-1 space-y-6">
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6">
                <SectionHeader title="Forecast Analysis" showPulse />
                {forecastAvailable && (
                  <ConfidenceBar score={directionalAccuracy} className="mb-6" />
                )}
                <h4 className="text-sm font-bold text-white mb-3">Model summary</h4>
                <ul className="space-y-2 mb-6">
                  {keyFactors.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                      {f.toLowerCase().includes("does not beat") || f.toLowerCase().includes("below")
                        ? <AlertTriangle size={16} className="text-[var(--warning)] mt-0.5 shrink-0" />
                        : <TrendingUp size={16} className="text-[var(--positive)] mt-0.5 shrink-0" />}
                      {f}
                    </li>
                  ))}
                </ul>
                {forecastAvailable && (
                  <div className={`p-4 rounded-xl border ${
                    targetChangePct >= 0
                      ? "bg-[rgba(0,229,160,0.1)] border-[var(--accent)]"
                      : "bg-[rgba(255,90,90,0.1)] border-[var(--negative)]"
                  }`}>
                    <h4 className={`font-bold text-sm mb-1 ${targetChangePct >= 0 ? "text-[var(--accent)]" : "text-[var(--negative)]"}`}>
                      Model direction: {targetChangePct >= 0 ? "Up" : "Down"}
                    </h4>
                    <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
                      Forecast projects a {targetChangePct >= 0 ? "gain" : "decline"} of{" "}
                      {Math.abs(targetChangePct).toFixed(2)}% from the last close.{" "}
                      Directional accuracy on the test window was {directionalAccuracy.toFixed(1)}%.
                    </p>
                    <p className="text-[var(--text-muted)] text-xs mt-2">
                      Forecasts are statistical estimates, not investment advice.
                    </p>
                  </div>
                )}
              </div>

              {/* 80% interval card */}
              {forecastAvailable && intervalLow > 0 && (
                <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6">
                  <SectionHeader title="80% Prediction Interval" />
                  <div className="space-y-3">
                    {[
                      { label: "Upper bound",   value: intervalHigh, color: "text-[var(--positive)]" },
                      { label: "Point forecast", value: targetPrice,  color: "text-white" },
                      { label: "Lower bound",   value: intervalLow,  color: "text-[var(--negative)]" },
                    ].map(({ label, value, color }) => (
                      <div
                        key={label}
                        className="flex items-center justify-between p-3 rounded-lg bg-[var(--surface)] border border-[var(--border)]"
                      >
                        <span className="text-sm text-white font-medium">{label}</span>
                        <span className={`text-sm font-mono font-bold ${color}`}>{fmt(value)}</span>
                      </div>
                    ))}
                  </div>
                  {metrics && (
                    <p className="text-xs text-[var(--text-muted)] mt-3">
                      Measured coverage on test window:{" "}
                      {((metrics.interval_coverage ?? 0) * 100).toFixed(1)}%
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
