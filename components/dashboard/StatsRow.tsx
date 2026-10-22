"use client";

import { StatCard } from "@/components/ui/StatCard";
import { usePortfolio } from "@/components/providers/PortfolioProvider";

export function StatsRow() {
  const { holdings, formatCurrency, ratesLoading } = usePortfolio();

  // Total portfolio value at current prices
  const totalValue = holdings.reduce(
    (sum, h) => sum + h.shares * h.currentPrice,
    0
  );

  // Total invested (at average cost basis)
  const totalInvested = holdings.reduce(
    (sum, h) => sum + h.shares * h.avgCost,
    0
  );

  // All-time return
  const allTimeReturn = totalValue - totalInvested;
  const allTimeReturnPct =
    totalInvested > 0 ? (allTimeReturn / totalInvested) * 100 : 0;
  const isPositiveAllTime = allTimeReturn >= 0;

  // Portfolio risk score: simple average of abs(returnPct) per holding — higher spread = higher risk
  const riskScore =
    holdings.length > 0
      ? Math.min(
          10,
          holdings.reduce((sum, h) => {
            const ret = Math.abs(
              ((h.currentPrice - h.avgCost) / h.avgCost) * 100
            );
            return sum + ret;
          }, 0) / holdings.length / 10
        ).toFixed(1)
      : "0.0";

  // Number of gainers vs losers for today's pulse (derived from current vs cost)
  const gainers = holdings.filter((h) => h.currentPrice >= h.avgCost).length;
  const loserCount = holdings.length - gainers;

  if (ratesLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-[var(--card)] border border-[var(--border)] rounded-2xl h-24 animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <StatCard
        label="Total Portfolio Value"
        value={formatCurrency(totalValue)}
      />
      <StatCard
        label="Holdings Pulse"
        value={`${gainers} ▲ / ${loserCount} ▼`}
        change={{
          value:
            gainers >= loserCount
              ? "More gainers than losers"
              : "More losers than gainers",
          isPositive: gainers >= loserCount,
        }}
      />
      <StatCard
        label="All-Time Return"
        value={`${isPositiveAllTime ? "+" : ""}${formatCurrency(allTimeReturn)}`}
        change={{
          value: `${isPositiveAllTime ? "+" : ""}${allTimeReturnPct.toFixed(2)}%`,
          isPositive: isPositiveAllTime,
        }}
      />
      <StatCard
        label="Portfolio Risk Score"
        value={riskScore.toString()}
        change={{
          value: `/ 10 — ${Number(riskScore) <= 3 ? "Low" : Number(riskScore) <= 6 ? "Moderate" : "High"}`,
          isPositive: Number(riskScore) <= 4,
        }}
      />
    </div>
  );
}
