"use client";

import { useState } from "react";
import Link from "next/link";
import { usePortfolio } from "@/components/providers/PortfolioProvider";
import { Badge } from "@/components/ui/Badge";
import { Plus, Trash2, Loader2, ExternalLink } from "lucide-react";

export function HoldingsTable() {
  const { holdings, addHolding, removeHolding, formatCurrency } =
    usePortfolio();
  const [isAdding, setIsAdding] = useState(false);
  const [loadingSymbol, setLoadingSymbol] = useState("");

  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [shares, setShares] = useState("");
  const [avgCost, setAvgCost] = useState("");
  const [sector, setSector] = useState("Technology");
  const [formError, setFormError] = useState("");

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!symbol || !shares || !avgCost) return;

    const sym = symbol.toUpperCase().trim();
    setLoadingSymbol(sym);

    try {
      let currentPrice = Number(avgCost);
      try {
        const res = await fetch(`/api/quote?ticker=${encodeURIComponent(sym)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.price) currentPrice = data.price;
        }
      } catch {
        // fall back to avgCost
      }

      addHolding({
        symbol: sym,
        name: name.trim() || sym,
        shares: Number(shares),
        avgCost: Number(avgCost),
        currentPrice,
        sector: sector || "Other",
      });

      setSymbol("");
      setName("");
      setShares("");
      setAvgCost("");
      setSector("Technology");
      setIsAdding(false);
    } catch {
      setFormError("Failed to add holding. Please try again.");
    } finally {
      setLoadingSymbol("");
    }
  };

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl overflow-hidden mb-8">
      <div className="p-6 border-b border-[var(--border)] flex items-center justify-between">
        <h3 className="text-lg font-bold text-white">Current Holdings</h3>
        <button
          onClick={() => {
            setIsAdding(!isAdding);
            setFormError("");
          }}
          className="flex items-center text-sm font-medium text-[#0A0F1E] bg-[var(--accent)] px-3 py-1.5 rounded-lg hover:bg-[#00c98d] transition-colors"
        >
          <Plus size={16} className="mr-1" /> {isAdding ? "Cancel" : "Add Stock"}
        </button>
      </div>

      {isAdding && (
        <form
          onSubmit={handleAddSubmit}
          className="p-6 bg-[var(--surface)] border-b border-[var(--border)]"
        >
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[110px]">
              <label className="block text-xs uppercase text-[var(--text-secondary)] mb-1">
                Ticker *
              </label>
              <input
                required
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                placeholder="AAPL"
                className="w-full bg-[var(--card)] border border-[var(--border)] rounded px-3 py-2 text-white uppercase focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs uppercase text-[var(--text-secondary)] mb-1">
                Company Name
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Apple Inc."
                className="w-full bg-[var(--card)] border border-[var(--border)] rounded px-3 py-2 text-white focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
            <div className="flex-1 min-w-[110px]">
              <label className="block text-xs uppercase text-[var(--text-secondary)] mb-1">
                Shares *
              </label>
              <input
                required
                type="number"
                step="any"
                min="0"
                value={shares}
                onChange={(e) => setShares(e.target.value)}
                placeholder="10"
                className="w-full bg-[var(--card)] border border-[var(--border)] rounded px-3 py-2 text-white focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className="block text-xs uppercase text-[var(--text-secondary)] mb-1">
                Avg Buy (USD) *
              </label>
              <input
                required
                type="number"
                step="any"
                min="0"
                value={avgCost}
                onChange={(e) => setAvgCost(e.target.value)}
                placeholder="150.00"
                className="w-full bg-[var(--card)] border border-[var(--border)] rounded px-3 py-2 text-white focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
            <div className="flex-1 min-w-[130px]">
              <label className="block text-xs uppercase text-[var(--text-secondary)] mb-1">
                Sector
              </label>
              <select
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                className="w-full bg-[var(--card)] border border-[var(--border)] rounded px-3 py-2 text-white focus:outline-none focus:border-[var(--accent)]"
              >
                {[
                  "Technology",
                  "Automotive",
                  "Semiconductors",
                  "Consumer Cyclical",
                  "Communication",
                  "Energy",
                  "Healthcare",
                  "Finance",
                  "Other",
                ].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={!!loadingSymbol}
              className="bg-[var(--accent)] text-black px-6 py-2 rounded font-bold disabled:opacity-50 flex items-center gap-2 hover:bg-[#00c98d] transition-colors"
            >
              {loadingSymbol ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Save"
              )}
            </button>
          </div>
          {formError && (
            <p className="mt-3 text-sm text-[var(--negative)]">{formError}</p>
          )}
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-[var(--text-secondary)]">
          <thead className="bg-[#0D1425] text-xs uppercase text-[var(--text-muted)]">
            <tr>
              <th className="px-6 py-4 font-medium">Asset</th>
              <th className="px-6 py-4 font-medium">Sector</th>
              <th className="px-6 py-4 font-medium text-right">Shares</th>
              <th className="px-6 py-4 font-medium text-right">Avg Buy</th>
              <th className="px-6 py-4 font-medium text-right">Price</th>
              <th className="px-6 py-4 font-medium text-right">Value</th>
              <th className="px-6 py-4 font-medium text-right">Return</th>
              <th className="px-6 py-4 font-medium text-center">AI Signal</th>
              <th className="px-6 py-4 font-medium text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {holdings.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-6 py-8 text-center text-[var(--text-muted)]"
                >
                  No holdings found. Add a stock to get started.
                </td>
              </tr>
            ) : (
              holdings.map((stock) => {
                const value = stock.shares * stock.currentPrice;
                const invested = stock.shares * stock.avgCost;
                const returnPct = ((value - invested) / invested) * 100;
                const isPositive = returnPct >= 0;

                let signal: "BUY" | "HOLD" | "WATCH" = "HOLD";
                let signalVariant: "positive" | "warning" | "negative" =
                  "warning";
                if (returnPct > 5) {
                  signal = "BUY";
                  signalVariant = "positive";
                } else if (returnPct < -2) {
                  signal = "WATCH";
                  signalVariant = "negative";
                }

                return (
                  <tr
                    key={stock.symbol}
                    className="border-b border-[var(--border)] hover:bg-[var(--surface)] transition-colors group"
                  >
                    <td className="px-6 py-4">
                      <Link
                        href={`/stock/${stock.symbol}`}
                        className="font-bold text-white group-hover:text-[var(--accent)] transition-colors"
                      >
                        {stock.symbol}
                      </Link>
                      <div className="text-xs">{stock.name}</div>
                    </td>
                    <td className="px-6 py-4 text-xs text-[var(--text-muted)]">
                      {stock.sector ?? "—"}
                    </td>
                    <td className="px-6 py-4 text-right font-mono">
                      {stock.shares}
                    </td>
                    <td className="px-6 py-4 text-right font-mono">
                      {formatCurrency(stock.avgCost)}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-white">
                      {formatCurrency(stock.currentPrice)}
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-medium text-white">
                      {formatCurrency(value)}
                    </td>
                    <td
                      className={`px-6 py-4 text-right font-mono font-medium ${
                        isPositive
                          ? "text-[var(--positive)]"
                          : "text-[var(--negative)]"
                      }`}
                    >
                      {isPositive ? "+" : ""}
                      {returnPct.toFixed(2)}%
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Badge variant={signalVariant} shape="square">
                        {signal}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Link
                          href={`/stock/${stock.symbol}`}
                          className="text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors p-1"
                          title="View Forecast"
                        >
                          <ExternalLink size={15} />
                        </Link>
                        <button
                          onClick={() => removeHolding(stock.symbol)}
                          className="text-[var(--text-muted)] hover:text-[var(--negative)] transition-colors p-1"
                          title="Remove Holding"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
