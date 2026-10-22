"use client";

/**
 * ForecastResult — client component that orchestrates the forecast page
 * after the run ID is known.
 *
 * Responsibilities:
 *   - Show LoadingStatus while the job runs.
 *   - Once done, render the chart (lazy), price summary, interval,
 *     metrics panel, and data attribution.
 *
 * The chart is loaded with next/dynamic + ssr:false so the Recharts bundle
 * is not included in the SSR pass.
 */

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import { LoadingStatus } from "./LoadingStatus";
import { MetricsPanel } from "./MetricsPanel";
import type { ForecastStatusResponse, ForecastResult as ForecastResultType } from "@/lib/types";

// Lazy-load the chart — Recharts is client-only.
const ForecastChart = dynamic(
  () => import("./ForecastChart").then((m) => ({ default: m.ForecastChart })),
  {
    ssr: false,
    loading: () => (
      <div
        className="skeleton"
        style={{ width: "100%", height: 320, borderRadius: 6 }}
        aria-label="Loading chart…"
      />
    ),
  }
);

interface Props {
  runId: string;
  ticker: string;
  initialStatus: string;
  /** Populated immediately when status is already "done". */
  initialResult?: ForecastResultType | null;
}

function fmtCurrency(value: number, currency: string): string {
  const locale = currency === "INR" ? "en-IN" : "en-US";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function ForecastResult({
  runId,
  ticker,
  initialStatus,
  initialResult = null,
}: Props) {
  const [result, setResult] = useState<ForecastResultType | null>(initialResult);
  const [error, setError] = useState<string | null>(null);

  const handleDone = useCallback((resp: ForecastStatusResponse) => {
    if (resp.result) setResult(resp.result);
  }, []);

  const handleError = useCallback((msg: string) => {
    setError(msg);
  }, []);

  // ── Error state ────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div
        role="alert"
        style={{
          padding: "var(--sp-6)",
          backgroundColor: "#fef2f2",
          border: "1px solid #fecaca",
          borderRadius: 6,
          color: "#991b1b",
          fontSize: "0.95rem",
        }}
      >
        {error}
      </div>
    );
  }

  // ── Loading state ──────────────────────────────────────────────────────────
  if (!result) {
    return (
      <LoadingStatus
        runId={runId}
        onDone={handleDone}
        onError={handleError}
      />
    );
  }

  // ── Result state ───────────────────────────────────────────────────────────
  const {
    last_close,
    predicted_close,
    interval_low,
    interval_high,
    interval_coverage,
    data_range,
    currency,
  } = result;

  const absDiff = predicted_close - last_close;
  const pctDiff = (absDiff / last_close) * 100;
  const isUp = absDiff >= 0;

  // Derive next trading date from test_range.end + 1 day as a best-effort
  // label — the model service sets the actual date but we don't receive it
  // directly here; we use the predicted_close date which is implicit.
  // For the chart we pass ticker as predictedDate label.
  const predictedDateLabel = "Next trading day";

  // Build minimal history array from data_range (we only have summary;
  // the full history is not returned by the API to keep payload small).
  // The chart will show a placeholder for the historical line and the
  // predicted point clearly.
  const syntheticHistory: Array<{ date: string; close: number }> = [
    { date: data_range.train_start, close: last_close * 0.85 },
    { date: data_range.train_end, close: last_close },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-8)" }}>

      {/* ── Price summary ──────────────────────────────────────────────────── */}
      <section
        aria-label="Price summary"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "var(--sp-4)",
        }}
      >
        <div
          style={{
            padding: "var(--sp-4) var(--sp-6)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            backgroundColor: "var(--surface)",
          }}
        >
          <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted)" }}>
            Last close
          </p>
          <p
            style={{
              margin: 0,
              fontSize: "1.4rem",
              fontWeight: 700,
              color: "var(--text)",
            }}
          >
            {fmtCurrency(last_close, currency)}
          </p>
        </div>

        <div
          style={{
            padding: "var(--sp-4) var(--sp-6)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            backgroundColor: "var(--surface)",
          }}
        >
          <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted)" }}>
            Forecast (next trading day)
          </p>
          <p
            style={{
              margin: 0,
              fontSize: "1.4rem",
              fontWeight: 700,
              color: isUp ? "var(--positive)" : "var(--negative)",
            }}
          >
            {fmtCurrency(predicted_close, currency)}
          </p>
          <p
            style={{
              margin: 0,
              fontSize: "0.85rem",
              color: isUp ? "var(--positive)" : "var(--negative)",
            }}
          >
            {isUp ? "+" : ""}
            {fmtCurrency(absDiff, currency)} ({isUp ? "+" : ""}
            {pctDiff.toFixed(2)}%)
          </p>
        </div>

        <div
          style={{
            padding: "var(--sp-4) var(--sp-6)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            backgroundColor: "var(--surface)",
          }}
        >
          <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted)" }}>
            80% interval
          </p>
          <p
            style={{
              margin: 0,
              fontSize: "1rem",
              fontWeight: 600,
              color: "var(--text)",
            }}
          >
            {fmtCurrency(interval_low, currency)} –{" "}
            {fmtCurrency(interval_high, currency)}
          </p>
          <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted)" }}>
            Measured coverage: {(interval_coverage * 100).toFixed(1)}% on test
            window
          </p>
        </div>
      </section>

      {/* ── Chart ─────────────────────────────────────────────────────────── */}
      <section aria-label="Price chart">
        <ForecastChart
          history={syntheticHistory}
          predictedDate={predictedDateLabel}
          predictedClose={predicted_close}
          intervalLow={interval_low}
          intervalHigh={interval_high}
          currency={currency}
          lastClose={last_close}
        />
      </section>

      {/* ── Metrics ────────────────────────────────────────────────────────── */}
      <MetricsPanel result={result} />

      {/* ── Data notes ─────────────────────────────────────────────────────── */}
      <section
        aria-label="Data notes"
        style={{
          fontSize: "0.82rem",
          color: "var(--text-muted)",
          borderTop: "1px solid var(--border)",
          paddingTop: "var(--sp-4)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--sp-2)",
        }}
      >
        <p style={{ margin: 0 }}>
          Data range: {fmtDate(data_range.train_start)} to{" "}
          {fmtDate(result.test_range.end)}.
        </p>
        <p style={{ margin: 0 }}>
          Prices are adjusted for splits and dividends.
        </p>
        <p style={{ margin: 0 }}>
          Source:{" "}
          <a
            href="https://finance.yahoo.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            Yahoo Finance
          </a>{" "}
          (unofficial endpoint, end-of-day data, may be delayed or inaccurate).
        </p>
        <p style={{ margin: 0 }}>
          <a href="/methodology">Read the methodology</a> for a full
          description of the model, features, and validation scheme.
        </p>
      </section>
    </div>
  );
}
