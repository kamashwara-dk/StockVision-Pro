import {
  mockHoldings,
  mockPredictions,
  mockScenarios,
  mockNews,
  mockPortfolioHistory,
} from "./mockData";
import { AIPrediction } from "./types";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ── helpers ────────────────────────────────────────────────────────────────

function getApiBase() {
  if (typeof window !== "undefined") return ""; // browser: relative URLs work
  // Server-side: need absolute URL
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return base;
}

// ── Portfolio ───────────────────────────────────────────────────────────────

export async function getPortfolioHoldings() {
  await delay(400);
  return mockHoldings;
}

// ── Prediction (uses internal /api/predict route) ───────────────────────────

export async function predictStock(
  ticker: string,
  forecastDays: number
): Promise<AIPrediction | null> {
  try {
    const res = await fetch(`${getApiBase()}/api/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker, forecast_days: forecastDays }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.error) return null;

    return {
      symbol: data.ticker,
      currency: data.currency ?? "USD",
      currentPrice: data.current_price,
      targetPrice: data.target_price,
      confidence: data.confidence,
      bullCase: data.bull_case,
      bearCase: data.bear_case,
      keyFactors: data.key_factors ?? [],
    };
  } catch (e) {
    console.error(`predictStock failed for ${ticker}:`, e);
    return null;
  }
}

// Full forecast records for the date table
export async function getForecastRecords(
  ticker: string,
  forecastDays: number
): Promise<{ date: string; predicted_close: number; bb_upper: number; bb_lower: number; rsi: number }[]> {
  try {
    const res = await fetch(`${getApiBase()}/api/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker, forecast_days: forecastDays }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.records ?? [];
  } catch {
    return [];
  }
}

// Real-time quote
export async function getLiveQuote(
  ticker: string
): Promise<{ price: number; change_pct: number; currency: string } | null> {
  try {
    const res = await fetch(`${getApiBase()}/api/quote?ticker=${encodeURIComponent(ticker)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.error ? null : data;
  } catch {
    return null;
  }
}

// ── AI Predictions (initial load) ──────────────────────────────────────────

export async function getAIPredictions(): Promise<AIPrediction[]> {
  return mockPredictions;
}

// ── Scenarios / News / History ──────────────────────────────────────────────

export async function getGlobalScenarios() {
  await delay(200);
  return mockScenarios;
}

export async function getMarketNews() {
  await delay(400);
  return mockNews;
}

export async function getPortfolioHistory() {
  await delay(200);
  return mockPortfolioHistory;
}
