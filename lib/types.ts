export interface StockHolding {
  symbol: string;
  name: string;
  shares: number;
  avgCost: number;
  currentPrice: number;
  sector: string;
  currency?: string; // native currency from Yahoo (USD, INR, etc.) — defaults to USD
}

export interface AIPrediction {
  symbol: string;
  currency: string;   // native currency from Yahoo (USD, INR, GBP …)
  currentPrice: number;
  targetPrice: number;
  confidence: number; // 0-100
  bullCase: number;
  bearCase: number;
  keyFactors: string[];
}

export interface GlobalScenario {
  name: string;
  icon: string;
  description: string;
  portfolioImpact: number;
}

export interface NewsItem {
  headline: string;
  source: string;
  summary: string;
  sentiment: 'Bullish' | 'Bearish' | 'Neutral';
  timeAgo: string;
}

export interface PortfolioHistory {
  date: string;
  value: number;
}

// ─── Forecast domain types (new API layer) ────────────────────────────────────

export interface SearchSuggestion {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
}

export type ForecastStatus =
  | "queued"
  | "fetching"
  | "training"
  | "evaluating"
  | "done"
  | "failed";

export interface ForecastCreateResponse {
  runId: string;
  status: ForecastStatus;
}

export interface ForecastMetrics {
  directional_accuracy: number;
  mape: number;
  rmse: number;
}

export interface ForecastBaselines {
  directional: number;
  mape: number;
  rmse: number;
}

export interface ForecastResult {
  last_close: number;
  predicted_close: number;
  interval_low: number;
  interval_high: number;
  interval_coverage: number;
  metrics: ForecastMetrics;
  baselines: ForecastBaselines;
  data_range: {
    train_start: string;
    train_end: string;
  };
  test_range: {
    start: string;
    end: string;
  };
  n_test_days: number;
  currency: string;
  model_version: string;
}

export interface ForecastStatusResponse {
  runId: string;
  status: ForecastStatus;
  stage: string | null;
  error: string | null;
  result: ForecastResult | null;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}
