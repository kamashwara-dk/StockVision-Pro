/**
 * POST /api/predict
 *
 * Body: { ticker: string, forecast_days?: number }
 *
 * Backward-compatible with lib/api.ts predictStock() and getForecastRecords().
 * The existing dashboard (AIPredictions.tsx) and stock detail page call this
 * endpoint and expect the legacy response shape from the old OLS model.
 *
 * This implementation:
 *   1. Creates a real forecast job via the model service (POST /jobs).
 *   2. Polls until done (max 90 seconds with 3-second intervals).
 *   3. Maps the job result back to the legacy response shape so all
 *      existing dashboard components keep working without UI changes.
 *
 * Legacy shape expected by lib/api.ts:
 *   {
 *     ticker, currency,
 *     current_price,           ← last_close from forecast_runs
 *     target_price,            ← predicted_close
 *     confidence,              ← directional_accuracy (0-100)
 *     bull_case, bear_case,    ← interval_high / interval_low
 *     trend,                   ← "bullish" | "bearish"
 *     key_factors: string[],   ← generated from real metric text
 *     records: [],             ← forecast table; empty (new model is 1-day)
 *     metrics: { r2, rmse },   ← mapped from new metrics
 *   }
 *
 * The accuracy panel on the stock detail page reads from this endpoint,
 * so all metric values are real and come from a forecast_runs row.
 *
 * IMPORTANT: The old "confidence" field was an R²-based score clamped 30–95.
 * We now map directional_accuracy (0–100) to this field so the existing
 * ConfidenceBar renders a truthful number. The UI label will be updated
 * in Phase 3 to say "Directional accuracy" instead of "confidence".
 *
 * Rate limit: 5 per IP per minute (same as /api/forecasts).
 */

import { type NextRequest, NextResponse } from "next/server";
import { createJob, getJob, ModelServiceError } from "@/lib/modelClient";
import { makeLogger } from "@/lib/logger";
import { createLimiter, hashIp, getClientIp } from "@/lib/rateLimit";

const TICKER_RE = /^[A-Z0-9.\-^]{1,15}$/;

// 5 forecast creations per IP per minute (CPU-intensive operation)
const predictLimiter = createLimiter({ windowMs: 60_000, max: 5 });

// How long to wait for a job to complete before returning a 202 partial.
const POLL_TIMEOUT_MS  = 90_000;
const POLL_INTERVAL_MS = 3_000;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const log = makeLogger();

  // Rate limit
  const limit = predictLimiter.check(hashIp(getClientIp(request)));
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((limit.resetAt - Date.now()) / 1000)) } }
    );
  }

  // Parse body
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const rawTicker = String(body.ticker ?? "").trim().toUpperCase();
  if (!rawTicker || !TICKER_RE.test(rawTicker)) {
    return NextResponse.json({ error: "Invalid ticker." }, { status: 422 });
  }

  log.info("predict.start", { ticker: rawTicker });

  try {
    // Create or retrieve existing job
    const jobCreate = await createJob(rawTicker);
    const runId = jobCreate.run_id;

    // Poll until done or timeout
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    let job = await getJob(runId);

    while (
      job.status !== "done" &&
      job.status !== "failed" &&
      Date.now() < deadline
    ) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      job = await getJob(runId);
    }

    // Timed out — return partial so the caller can retry
    if (job.status !== "done" && job.status !== "failed") {
      return NextResponse.json(
        { error: "Forecast is still running. Try again in a moment.", status: job.status },
        { status: 202 }
      );
    }

    if (job.status === "failed") {
      return NextResponse.json(
        { error: job.error ?? "Forecast failed. Please try again." },
        { status: 500 }
      );
    }

    const r = job.result!;

    // Map to legacy response shape expected by lib/api.ts and stock detail page.
    const isUp = r.predicted_close >= r.last_close;
    const da   = r.metrics.directional_accuracy ?? 50;

    // Key factors: plain-English sentences derived from real metrics.
    // These replace the old OLS-derived strings. Each sentence is factual.
    const beats = r.metrics.rmse < r.baselines.rmse && r.metrics.mape < r.baselines.mape;
    const keyFactors: string[] = [
      `Directional accuracy ${da.toFixed(1)}% on ${r.n_test_days} held-out trading days`,
      `RMSE ${fmtRmse(r.metrics.rmse, r.currency)} vs naive baseline ${fmtRmse(r.baselines.rmse, r.currency)}`,
      beats
        ? `Model beats the naive baseline on this test period`
        : `Model does not beat the naive baseline (tomorrow = today) on this test period`,
      `80% interval: ${fmtPrice(r.interval_low, r.currency)} – ${fmtPrice(r.interval_high, r.currency)} (measured coverage ${((r.interval_coverage ?? 0) * 100).toFixed(1)}%)`,
    ];

    return NextResponse.json({
      ticker:        rawTicker,
      currency:      r.currency,
      current_price: r.last_close,
      target_price:  r.predicted_close,
      // Map directional accuracy → confidence field so ConfidenceBar stays truthful.
      confidence:    Math.round(da),
      bull_case:     r.interval_high,
      bear_case:     r.interval_low,
      trend:         isUp ? "bullish" : "bearish",
      key_factors:   keyFactors,
      // Records are not produced by the 1-day model.
      records:       [],
      // Real metrics for the accuracy panel (Phase 3).
      metrics: {
        directional_accuracy: r.metrics.directional_accuracy,
        mape:                 r.metrics.mape,
        rmse:                 r.metrics.rmse,
        baseline_directional: r.baselines.directional,
        baseline_mape:        r.baselines.mape,
        baseline_rmse:        r.baselines.rmse,
        n_test_days:          r.n_test_days,
        test_start:           r.test_range.start,
        test_end:             r.test_range.end,
        interval_coverage:    r.interval_coverage,
        beats_baseline:       beats,
      },
      run_id: runId,
    });
  } catch (err) {
    if (err instanceof ModelServiceError) {
      if (err.statusCode === 422) {
        return NextResponse.json({ error: err.message }, { status: 422 });
      }
      log.error("predict.upstream_error", err, { ticker: rawTicker });
      return NextResponse.json(
        { error: "Forecast service temporarily unavailable. Please try again." },
        { status: 503 }
      );
    }
    log.error("predict.unexpected_error", err, { ticker: rawTicker });
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtPrice(value: number, currency: string): string {
  const locale = currency === "INR" ? "en-IN" : "en-US";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency", currency,
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

function fmtRmse(value: number, currency: string): string {
  // RMSE is in currency units; use compact format.
  const locale = currency === "INR" ? "en-IN" : "en-US";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency", currency,
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return value.toFixed(2);
  }
}
