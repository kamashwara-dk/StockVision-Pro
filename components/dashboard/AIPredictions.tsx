"use client";

import { useEffect, useState } from "react";
import { predictStock, getForecastRecords } from "@/lib/api";
import { AIPrediction } from "@/lib/types";
import { usePortfolio } from "@/components/providers/PortfolioProvider";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ConfidenceBar } from "@/components/ui/ConfidenceBar";
import { Badge } from "@/components/ui/Badge";
import {
  ArrowUpRight,
  ArrowDownRight,
  Search,
  Loader2,
  ChevronDown,
  ChevronUp,
  BarChart2,
} from "lucide-react";

interface ForecastRecord {
  date: string;
  predicted_close: number;
  bb_upper: number;
  bb_lower: number;
  rsi: number;
}

interface PredictionWithRecords extends AIPrediction {
  records?: ForecastRecord[];
}

const HORIZON_OPTIONS = [
  { label: "7 Days", value: 7 },
  { label: "14 Days", value: 14 },
  { label: "30 Days", value: 30 },
  { label: "90 Days", value: 90 },
];

export function AIPredictions() {
  const { holdings, formatCurrency, formatQuote } = usePortfolio();
  const [predictions, setPredictions] = useState<PredictionWithRecords[]>([]);
  const [loading, setLoading] = useState(false);
  const [portfolioLoaded, setPortfolioLoaded] = useState(false);
  const [scenario, setScenario] = useState<"base" | "bull" | "bear">("base");
  const [expanded, setExpanded] = useState<string | null>(null);

  // Search any stock
  const [tickerInput, setTickerInput] = useState("");
  const [durationInput, setDurationInput] = useState(30);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");

  // Auto-load predictions for portfolio holdings on first render
  useEffect(() => {
    if (portfolioLoaded || holdings.length === 0) return;
    setPortfolioLoaded(true);
    setLoading(true);

    // Run predictions for up to 5 portfolio holdings in parallel
    const targets = holdings.slice(0, 5).map((h) => h.symbol);
    Promise.all(
      targets.map(async (symbol) => {
        const [pred, records] = await Promise.all([
          predictStock(symbol, 30),
          getForecastRecords(symbol, 30),
        ]);
        if (!pred) return null;
        return { ...pred, records } as PredictionWithRecords;
      })
    ).then((results) => {
      setPredictions(results.filter(Boolean) as PredictionWithRecords[]);
      setLoading(false);
    });
  }, [holdings, portfolioLoaded]);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    const sym = tickerInput.trim().toUpperCase();
    if (!sym) return;

    setIsAnalyzing(true);
    setAnalyzeError("");

    const [pred, records] = await Promise.all([
      predictStock(sym, durationInput),
      getForecastRecords(sym, durationInput),
    ]);

    if (pred) {
      setPredictions((prev) => [
        { ...pred, records },
        ...prev.filter((p) => p.symbol !== pred.symbol),
      ]);
      setExpanded(sym); // auto-expand the new result
      setTickerInput("");
    } else {
      setAnalyzeError(`Could not fetch data for "${sym}". Check the ticker and try again.`);
    }
    setIsAnalyzing(false);
  };

  const toggleExpand = (symbol: string) =>
    setExpanded((prev) => (prev === symbol ? null : symbol));

  return (
    <div className="pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
        <SectionHeader title="AI Price Predictions" showPulse className="mb-0" />
        <div className="flex mt-4 md:mt-0 bg-[var(--card)] rounded-lg p-1 border border-[var(--border)]">
          {(["base", "bull", "bear"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setScenario(mode)}
              className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-colors ${
                scenario === mode
                  ? "bg-[var(--surface)] text-white shadow-sm border border-[var(--border)]"
                  : "text-[var(--text-secondary)] hover:text-white"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Search panel */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 mb-8">
        <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">
          Analyze Any Stock
        </h3>
        <form
          onSubmit={handleAnalyze}
          className="flex flex-col md:flex-row items-end gap-4"
        >
          <div className="flex-1 w-full">
            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-2">
              Stock Ticker
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
              <input
                type="text"
                placeholder="e.g. MSFT, GOOG, TSLA, RELIANCE.NS"
                value={tickerInput}
                onChange={(e) => setTickerInput(e.target.value)}
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg pl-10 pr-4 py-2.5 text-white focus:outline-none focus:border-[var(--accent)] transition-colors uppercase placeholder:normal-case"
              />
            </div>
          </div>
          <div className="w-full md:w-48">
            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-2">
              Forecast Horizon
            </label>
            <select
              value={durationInput}
              onChange={(e) => setDurationInput(Number(e.target.value))}
              className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-[var(--accent)] transition-colors"
            >
              {HORIZON_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={isAnalyzing || !tickerInput.trim()}
            className="w-full md:w-auto bg-[var(--accent)] text-[#0A0F1E] font-bold px-8 py-2.5 rounded-lg hover:bg-[#00c98d] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 whitespace-nowrap"
          >
            {isAnalyzing ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <BarChart2 size={16} /> Analyze
              </>
            )}
          </button>
        </form>
        {analyzeError && (
          <p className="mt-3 text-sm text-[var(--negative)]">{analyzeError}</p>
        )}
      </div>

      {/* Portfolio predictions loading */}
      {loading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {Array(3)
            .fill(0)
            .map((_, i) => (
              <div
                key={i}
                className="bg-[var(--card)] border border-[var(--border)] rounded-2xl h-64 animate-pulse"
              />
            ))}
        </div>
      )}

      {/* Prediction cards */}
      {!loading && predictions.length === 0 && (
        <div className="text-center py-16 text-[var(--text-muted)]">
          <p className="text-lg mb-2">No predictions yet.</p>
          <p className="text-sm">
            Search for a stock above, or add holdings to your portfolio for
            automatic analysis.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {predictions.map((pred) => {
          let target = pred.targetPrice;
          if (scenario === "bull") target = pred.bullCase;
          if (scenario === "bear") target = pred.bearCase;

          const changePct =
            ((target - pred.currentPrice) / pred.currentPrice) * 100;
          const isUp = changePct >= 0;
          const isExpandedCard = expanded === pred.symbol;

          return (
            <div
              key={pred.symbol}
              className="bg-[var(--card)] border border-[var(--border)] rounded-2xl overflow-hidden transition-colors hover:border-[var(--accent)]"
            >
              {/* Card header row */}
              <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-6">
                {/* Symbol + signal */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl font-bold text-white">
                      {pred.symbol}
                    </span>
                    <Badge variant={isUp ? "positive" : "negative"}>
                      {isUp ? "BUY" : "SELL"}
                    </Badge>
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {pred.keyFactors[0] ?? ""}
                  </div>
                </div>

                {/* Current price */}
                <div>
                  <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">
                    Current Price
                  </div>
                  <div className="text-lg font-mono font-bold text-white">
                    {formatQuote(pred.currentPrice, pred.currency)}
                  </div>
                </div>

                {/* Target price */}
                <div>
                  <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">
                    {scenario === "base"
                      ? "Target Price"
                      : scenario === "bull"
                      ? "Bull Case"
                      : "Bear Case"}
                  </div>
                  <div
                    className={`text-lg font-mono font-bold ${
                      isUp ? "text-[var(--positive)]" : "text-[var(--negative)]"
                    }`}
                  >
                    {formatQuote(target, pred.currency)}
                    <span className="text-sm ml-2">
                      {isUp ? "+" : ""}
                      {changePct.toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Confidence + expand */}
                <div className="flex flex-col justify-between">
                  <ConfidenceBar score={pred.confidence} />
                  <button
                    onClick={() => toggleExpand(pred.symbol)}
                    className="flex items-center gap-1 text-xs font-medium text-[var(--accent)] mt-3 self-end"
                  >
                    {isExpandedCard ? (
                      <>
                        Hide forecast <ChevronUp size={14} />
                      </>
                    ) : (
                      <>
                        View date forecast <ChevronDown size={14} />
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Expanded forecast table */}
              {isExpandedCard && (
                <div className="border-t border-[var(--border)] px-6 pb-6 pt-4">
                  <h4 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">
                    Day-by-Day Forecast — {pred.symbol}
                  </h4>

                  {/* Key factors */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {pred.keyFactors.map((f, i) => (
                      <span
                        key={i}
                        className="text-xs bg-[var(--surface)] border border-[var(--border)] text-[var(--text-secondary)] px-3 py-1 rounded-full"
                      >
                        {f}
                      </span>
                    ))}
                  </div>

                  {!pred.records || pred.records.length === 0 ? (
                    <p className="text-sm text-[var(--text-muted)]">
                      No forecast data available.
                    </p>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-[#0D1425] text-xs text-[var(--text-muted)] uppercase">
                          <tr>
                            <th className="px-4 py-3 font-medium">#</th>
                            <th className="px-4 py-3 font-medium">Date</th>
                            <th className="px-4 py-3 font-medium text-right">
                              Predicted Close
                            </th>
                            <th className="px-4 py-3 font-medium text-right">
                              BB Upper
                            </th>
                            <th className="px-4 py-3 font-medium text-right">
                              BB Lower
                            </th>
                            <th className="px-4 py-3 font-medium text-right">
                              RSI
                            </th>
                            <th className="px-4 py-3 font-medium text-right">
                              Signal
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {pred.records.map((row, idx) => {
                            const prevClose =
                              idx === 0
                                ? pred.currentPrice
                                : pred.records![idx - 1].predicted_close;
                            const dayChange =
                              ((row.predicted_close - prevClose) / prevClose) *
                              100;
                            const dayUp = dayChange >= 0;
                            const rsiSignal =
                              row.rsi > 70
                                ? "Overbought"
                                : row.rsi < 30
                                ? "Oversold"
                                : "Neutral";
                            const rsiColor =
                              row.rsi > 70
                                ? "text-[var(--negative)]"
                                : row.rsi < 30
                                ? "text-[var(--warning)]"
                                : "text-[var(--text-secondary)]";

                            return (
                              <tr
                                key={row.date}
                                className="border-t border-[var(--border)] hover:bg-[var(--surface)] transition-colors"
                              >
                                <td className="px-4 py-3 text-[var(--text-muted)] font-mono text-xs">
                                  {idx + 1}
                                </td>
                                <td className="px-4 py-3 font-medium text-white">
                                  {row.date}
                                </td>
                                <td
                                  className={`px-4 py-3 text-right font-mono font-bold ${
                                    dayUp
                                      ? "text-[var(--positive)]"
                                      : "text-[var(--negative)]"
                                  }`}
                                >
                                  {formatQuote(row.predicted_close, pred.currency)}
                                  <span className="text-xs ml-1 opacity-70">
                                    {dayUp ? "▲" : "▼"}
                                    {Math.abs(dayChange).toFixed(2)}%
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right font-mono text-[var(--text-secondary)]">
                                  {formatQuote(row.bb_upper, pred.currency)}
                                </td>
                                <td className="px-4 py-3 text-right font-mono text-[var(--text-secondary)]">
                                  {formatQuote(row.bb_lower, pred.currency)}
                                </td>
                                <td className="px-4 py-3 text-right font-mono text-white">
                                  {row.rsi.toFixed(1)}
                                </td>
                                <td className={`px-4 py-3 text-right text-xs font-bold ${rsiColor}`}>
                                  {rsiSignal}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
