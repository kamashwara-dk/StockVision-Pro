"use client";

import { usePortfolio } from "@/components/providers/PortfolioProvider";

export function MarketPulse() {
  const { holdings } = usePortfolio();

  const gainers = holdings.filter((h) => h.currentPrice > h.avgCost);
  const losers = holdings.filter((h) => h.currentPrice <= h.avgCost);

  const bullishPct =
    holdings.length > 0
      ? Math.round((gainers.length / holdings.length) * 100)
      : 0;

  const isBullish = bullishPct >= 50;

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 h-full min-h-[400px] flex flex-col">
      <h3 className="text-lg font-bold text-white mb-6">Market Pulse</h3>

      {holdings.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-[var(--text-muted)] text-sm">
          Add holdings to see pulse
        </div>
      ) : (
        <div className="flex flex-col gap-4 flex-1">
          {/* Overall sentiment */}
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div
              className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
                isBullish
                  ? "bg-[rgba(0,229,160,0.1)]"
                  : "bg-[rgba(255,90,90,0.1)]"
              }`}
            >
              <span className="text-2xl">{isBullish ? "🟢" : "🔴"}</span>
            </div>
            <h4 className="text-xl font-bold text-white mb-1">
              {isBullish ? "Bullish Momentum" : "Bearish Pressure"}
            </h4>
            <p className="text-[var(--text-secondary)] text-sm">
              {bullishPct}% of your holdings are currently in profit
            </p>
          </div>

          {/* Gainers list */}
          {gainers.length > 0 && (
            <div>
              <h5 className="text-xs font-bold text-[var(--positive)] uppercase tracking-wider mb-2">
                Gainers
              </h5>
              <div className="space-y-2">
                {gainers.map((h) => {
                  const ret =
                    ((h.currentPrice - h.avgCost) / h.avgCost) * 100;
                  return (
                    <div
                      key={h.symbol}
                      className="flex justify-between text-sm"
                    >
                      <span className="text-white font-medium">{h.symbol}</span>
                      <span className="text-[var(--positive)] font-mono">
                        +{ret.toFixed(2)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Losers list */}
          {losers.length > 0 && (
            <div>
              <h5 className="text-xs font-bold text-[var(--negative)] uppercase tracking-wider mb-2">
                Underperforming
              </h5>
              <div className="space-y-2">
                {losers.map((h) => {
                  const ret =
                    ((h.currentPrice - h.avgCost) / h.avgCost) * 100;
                  return (
                    <div
                      key={h.symbol}
                      className="flex justify-between text-sm"
                    >
                      <span className="text-white font-medium">{h.symbol}</span>
                      <span className="text-[var(--negative)] font-mono">
                        {ret.toFixed(2)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
