/**
 * lib/types.ts — Domain types for the StockVision Pro frontend and API layer.
 *
 * These types mirror the API contract in spec §5 and the database schema in §6.
 * No mock data types; no portfolio/auth types.
 */

// ─── Search ───────────────────────────────────────────────────────────────────

export interface SearchSuggestion {
  symbol: string;
  name: string;
  exchange: string;
  type: string; // "Equity" | "ETF"
}

// ─── Forecast job ─────────────────────────────────────────────────────────────

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
  directional_accuracy: number; // percent 0–100
  mape: number;                  // percent
  rmse: number;                  // in listing currency
}

export interface ForecastBaselines {
  directional: number; // percent
  mape: number;        // percent
  rmse: number;        // in listing currency
}

export interface ForecastResult {
  last_close: number;
  predicted_close: number;
  interval_low: number;
  interval_high: number;
  interval_coverage: number; // 0–1 (fraction, e.g. 0.82)
  metrics: ForecastMetrics;
  baselines: ForecastBaselines;
  data_range: {
    train_start: string; // ISO date
    train_end: string;
  };
  test_range: {
    start: string; // ISO date
    end: string;
  };
  n_test_days: number;
  currency: string; // ISO 4217
  model_version: string;
}

export interface ForecastStatusResponse {
  runId: string;
  status: ForecastStatus;
  stage: string | null;
  error: string | null;
  result: ForecastResult | null;
}

// ─── API error shape ──────────────────────────────────────────────────────────

export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}
