"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { StockHolding } from "@/lib/types";

const initialHoldings: StockHolding[] = [
  { symbol: "RELIANCE.NS", name: "Reliance Industries", shares: 10,  avgCost: 2800.0, currentPrice: 2800.0, sector: "Energy",      currency: "INR" },
  { symbol: "TCS.NS",      name: "TCS",                 shares: 5,   avgCost: 3500.0, currentPrice: 3500.0, sector: "Technology",  currency: "INR" },
  { symbol: "INFY.NS",     name: "Infosys",             shares: 20,  avgCost: 1400.0, currentPrice: 1400.0, sector: "Technology",  currency: "INR" },
  { symbol: "CUPID.NS",    name: "Cupid Ltd",           shares: 5,   avgCost: 282.0,  currentPrice: 282.0,  sector: "Healthcare",  currency: "INR" },
];

export const AVAILABLE_CURRENCIES = [
  "USD", "EUR", "GBP", "INR",
  "AED", "SAR", "QAR", "KWD", "BHD", "OMR", "ILS",
];

type PortfolioContextType = {
  holdings: StockHolding[];
  addHolding: (holding: StockHolding) => void;
  removeHolding: (symbol: string) => void;
  currency: string;
  setCurrency: (currency: string) => void;
  /** Convert a USD value → selected display currency and format */
  formatCurrency: (usdValue: number) => string;
  /** Convert any source currency → selected display currency and format.
   *  Use this for market data where Yahoo already gives non-USD prices. */
  formatQuote: (price: number, sourceCurrency: string) => string;
  ratesLoading: boolean;
};

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

export function PortfolioProvider({ children }: { children: React.ReactNode }) {
  const [holdings, setHoldings]       = useState<StockHolding[]>(initialHoldings);
  const [currency, setCurrency]       = useState("USD");
  const [exchangeRates, setRates]     = useState<Record<string, number>>({ USD: 1 });
  const [ratesLoading, setLoading]    = useState(true);

  // 1. Fetch live exchange rates (USD-based)
  useEffect(() => {
    const go = async () => {
      try {
        const res = await fetch("https://api.exchangerate-api.com/v4/latest/USD");
        if (res.ok) setRates((await res.json()).rates);
      } catch { /* use defaults */ } finally { setLoading(false); }
    };
    go();
  }, []);

  // 2. Refresh portfolio prices once rates are ready
  useEffect(() => {
    if (ratesLoading) return;
    let cancelled = false;
    (async () => {
      const updated = await Promise.all(
        initialHoldings.map(async (h) => {
          try {
            const res = await fetch(`/api/quote?ticker=${h.symbol}`);
            if (res.ok) {
              const d = await res.json();
              if (d.price) return { ...h, currentPrice: d.price, currency: d.currency ?? h.currency ?? "USD" };
            }
          } catch { /* keep fallback */ }
          return h;
        })
      );
      if (!cancelled) setHoldings(updated);
    })();
    return () => { cancelled = true; };
  }, [ratesLoading]);

  /** Convert from a known sourceCurrency to the user's selected display currency */
  const convert = (amount: number, sourceCurrency: string): number => {
    const src = sourceCurrency.toUpperCase();
    const dst = currency.toUpperCase();
    if (src === dst) return amount;
    // Rates are all relative to USD
    const srcRate = exchangeRates[src] ?? 1;  // how many src per 1 USD
    const dstRate = exchangeRates[dst] ?? 1;  // how many dst per 1 USD
    return amount / srcRate * dstRate;
  };

  const fmt = (amount: number, curr: string) =>
    new Intl.NumberFormat("en-IN", {   // en-IN gives ₹ grouping style
      style: "currency",
      currency: curr,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);

  /** Portfolio values — stored in USD, convert to display currency */
  const formatCurrency = (usdValue: number) =>
    fmt(convert(usdValue, "USD"), currency);

  /** Market quote — price already in sourceCurrency from Yahoo, convert to display */
  const formatQuote = (price: number, sourceCurrency: string) =>
    fmt(convert(price, sourceCurrency), currency);

  const addHolding = (holding: StockHolding) => {
    setHoldings((prev) => {
      const existing = prev.find((h) => h.symbol === holding.symbol);
      if (existing) {
        const totalShares = existing.shares + holding.shares;
        const totalCost = existing.shares * existing.avgCost + holding.shares * holding.avgCost;
        return prev.map((h) =>
          h.symbol === holding.symbol
            ? { ...h, shares: totalShares, avgCost: totalCost / totalShares }
            : h
        );
      }
      return [...prev, holding];
    });
  };

  const removeHolding = (symbol: string) =>
    setHoldings((prev) => prev.filter((h) => h.symbol !== symbol));

  return (
    <PortfolioContext.Provider value={{
      holdings, addHolding, removeHolding,
      currency, setCurrency,
      formatCurrency, formatQuote,
      ratesLoading,
    }}>
      {children}
    </PortfolioContext.Provider>
  );
}

export function usePortfolio() {
  const ctx = useContext(PortfolioContext);
  if (!ctx) throw new Error("usePortfolio must be used within PortfolioProvider");
  return ctx;
}
