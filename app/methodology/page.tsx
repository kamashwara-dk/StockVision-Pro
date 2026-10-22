import type { Metadata } from "next";
import { SiteNav } from "@/components/layout/SiteNav";
import { SiteFooter } from "@/components/layout/SiteFooter";

export const metadata: Metadata = {
  title: "Methodology",
  description:
    "How StockVision Pro fetches data, cleans it, engineers features, trains a walk-forward model, and measures accuracy on held-out data.",
  alternates: { canonical: "/methodology" },
};

const prose: React.CSSProperties = {
  maxWidth: 720,
  fontSize: "0.975rem",
  lineHeight: 1.75,
  color: "var(--text)",
};

const h2Style: React.CSSProperties = {
  fontSize: "1.2rem",
  fontWeight: 700,
  marginTop: "2.5rem",
  marginBottom: "0.75rem",
};

const h3Style: React.CSSProperties = {
  fontSize: "1rem",
  fontWeight: 600,
  marginTop: "1.5rem",
  marginBottom: "0.5rem",
};

const mutedP: React.CSSProperties = {
  color: "var(--text-muted)",
  marginBottom: "1rem",
};

export default function MethodologyPage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <SiteNav />

      <main
        id="main-content"
        style={{
          flex: 1,
          maxWidth: 900,
          width: "100%",
          margin: "0 auto",
          padding: "var(--sp-12) var(--sp-6)",
        }}
      >
        <div style={prose}>
          <h1
            style={{
              fontSize: "clamp(1.5rem, 4vw, 2rem)",
              fontWeight: 800,
              marginBottom: "var(--sp-4)",
            }}
          >
            Methodology
          </h1>
          <p style={mutedP}>
            This page describes how forecasts are produced, evaluated, and
            displayed. Every number shown on a forecast page is computed from
            the steps below and stored in a database row before being displayed.
          </p>

          {/* ── Data source ── */}
          <h2 style={h2Style}>Data source</h2>
          <p style={mutedP}>
            Historical price data is fetched from Yahoo Finance via the yfinance
            library. Up to ten years of daily bars are requested per ticker.
            All prices are adjusted for stock splits and dividends (Yahoo's{" "}
            <code>auto_adjust=True</code>).
          </p>
          <p style={{ ...mutedP, fontStyle: "italic" }}>
            Compliance note: Yahoo Finance's data endpoints are unofficial.
            Their terms of service restrict commercial use. This service uses
            the data for statistical demonstration purposes only. Results are
            not investment advice.
          </p>

          {/* ── Data cleaning ── */}
          <h2 style={h2Style}>Data cleaning</h2>
          <p style={mutedP}>
            The following rules are applied before any model training. Each is
            logged with a counter.
          </p>
          <ol style={{ paddingLeft: "1.5rem", ...mutedP }}>
            <li style={{ marginBottom: "0.5rem" }}>
              <strong>Sorted unique dates.</strong> Rows are sorted ascending by
              date. Duplicate dates are deduplicated; the last occurrence is
              kept.
            </li>
            <li style={{ marginBottom: "0.5rem" }}>
              <strong>Non-positive prices removed.</strong> Rows where the
              adjusted close is zero or negative are dropped.
            </li>
            <li style={{ marginBottom: "0.5rem" }}>
              <strong>No forward-filling.</strong> Missing sessions (holidays,
              suspensions) are simply absent. The model sees gaps as gaps.
            </li>
            <li style={{ marginBottom: "0.5rem" }}>
              <strong>Long gaps flagged.</strong> Consecutive sessions separated
              by more than seven calendar days are flagged in server logs. They
              are not removed.
            </li>
            <li style={{ marginBottom: "0.5rem" }}>
              <strong>Possible split artefacts flagged.</strong> Sessions where
              the absolute log-return exceeds 40% are flagged and excluded from
              model training only. Because adjusted prices are used throughout,
              these are most likely data errors.
            </li>
            <li style={{ marginBottom: "0.5rem" }}>
              <strong>Minimum history.</strong> At least 750 trading days of
              clean data are required. Below this threshold the request is
              refused. Between 750 days and ten years, all available data is
              used and the actual date range is shown.
            </li>
          </ol>

          {/* ── Features ── */}
          <h2 style={h2Style}>Features</h2>
          <p style={mutedP}>
            All features for predicting day <em>t</em> are constructed from
            data available through day <em>t</em>−1 only. There is no look-ahead.
          </p>
          <table
            style={{
              borderCollapse: "collapse",
              width: "100%",
              fontSize: "0.875rem",
              marginBottom: "1rem",
            }}
          >
            <thead>
              <tr style={{ borderBottom: "2px solid var(--border)" }}>
                <th
                  scope="col"
                  style={{ textAlign: "left", padding: "6px 12px 6px 0", fontWeight: 600 }}
                >
                  Feature
                </th>
                <th
                  scope="col"
                  style={{ textAlign: "left", padding: "6px 0", fontWeight: 600 }}
                >
                  Description
                </th>
              </tr>
            </thead>
            <tbody>
              {[
                ["log_ret_lag_{1,2,3,5,10,20}", "Log-return lags (6 features)"],
                ["rolling_vol_{5,10,20}", "Rolling std of log-returns over past window (3 features)"],
                ["rsi_14", "RSI(14) using Wilder's exponential smoothing"],
                ["sma_ratio_5_20", "SMA(5) / SMA(20) — short-term momentum"],
                ["sma_ratio_10_50", "SMA(10) / SMA(50) — medium-term momentum"],
                ["vol_zscore_20", "Volume z-score vs past 20 sessions"],
                ["day_of_week", "Integer 0 (Monday) to 4 (Friday)"],
              ].map(([name, desc]) => (
                <tr key={name} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td
                    style={{
                      padding: "8px 12px 8px 0",
                      fontFamily: "monospace",
                      fontSize: "0.82rem",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {name}
                  </td>
                  <td
                    style={{
                      padding: "8px 0",
                      color: "var(--text-muted)",
                    }}
                  >
                    {desc}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={mutedP}>
            <strong>Target:</strong> next-day log-return, i.e.{" "}
            <code>log(close_t / close_t-1)</code>. The model predicts this; the
            predicted price is <code>close_t-1 × exp(predicted log-return)</code>.
          </p>

          {/* ── Model ── */}
          <h2 style={h2Style}>Model</h2>
          <p style={mutedP}>
            The default model is scikit-learn's{" "}
            <code>HistGradientBoostingRegressor</code> with a fixed random state
            for reproducibility.
          </p>
          <p style={mutedP}>
            <strong>Hyperparameter selection.</strong> A small fixed grid is
            evaluated using <code>GridSearchCV</code> with{" "}
            <code>TimeSeriesSplit</code> (5 folds) applied to the training
            window only. The test window is never used for selection.
          </p>

          {/* ── Validation scheme ── */}
          <h2 style={h2Style}>Validation scheme</h2>
          <ol style={{ paddingLeft: "1.5rem", ...mutedP }}>
            <li style={{ marginBottom: "0.5rem" }}>
              <strong>Chronological split.</strong> The first 80% of feature
              rows are used for training; the remaining 20% form the test
              window. No shuffling anywhere.
            </li>
            <li style={{ marginBottom: "0.5rem" }}>
              <strong>Walk-forward evaluation.</strong> The test window is
              evaluated using an expanding window. The model is refit every 20
              trading days. Each test-day prediction uses only the model fitted
              on data strictly before that day.
            </li>
            <li style={{ marginBottom: "0.5rem" }}>
              <strong>No test contamination.</strong> Scalers and feature
              statistics are computed inside each training window only, never on
              test data.
            </li>
          </ol>

          {/* ── Metrics ── */}
          <h2 style={h2Style}>Metric definitions</h2>
          <p style={mutedP}>
            All metrics are computed on the test window using the walk-forward
            predictions. Every figure shown on screen comes from the stored
            database row for that run.
          </p>

          <h3 style={h3Style}>Directional accuracy</h3>
          <p style={mutedP}>
            <code>
              DA = 100 × (correct direction count) / (non-zero-change day count)
            </code>
            <br />A "correct direction" is when{" "}
            <code>sign(P_t − A_t-1) = sign(A_t − A_t-1)</code>. Days where the
            actual close equals the previous close are excluded from the
            denominator and this is noted alongside the metric.
          </p>

          <h3 style={h3Style}>MAPE</h3>
          <p style={mutedP}>
            <code>MAPE = 100 × mean(|A_t − P_t| / A_t)</code>
          </p>

          <h3 style={h3Style}>RMSE</h3>
          <p style={mutedP}>
            <code>RMSE = sqrt(mean((A_t − P_t)²))</code>
            <br />
            Reported in the listing currency (INR for NSE/BSE, USD for
            NYSE/NASDAQ).
          </p>

          {/* ── Baselines ── */}
          <h2 style={h2Style}>Baseline definitions</h2>
          <p style={mutedP}>
            The <strong>naive baseline</strong> assumes tomorrow's price equals
            today's (<code>P_t = A_t-1</code>). Naive MAPE and RMSE are
            computed on the same test days as the model metrics.
          </p>
          <p style={mutedP}>
            The <strong>directional baseline</strong> predicts the majority
            direction (up or down) observed in the <em>training window</em>{" "}
            only.
          </p>

          {/* ── Prediction interval ── */}
          <h2 style={h2Style}>Prediction interval</h2>
          <p style={mutedP}>
            An 80% interval is computed from the 10th and 90th percentiles of
            the walk-forward residuals (actual minus predicted, in price space).
            The <em>measured coverage</em> — the fraction of test days where the
            actual price fell inside the interval centred on each test-day
            prediction — is shown alongside the interval for the final forecast
            point.
          </p>

          {/* ── Known limitations ── */}
          <h2 style={h2Style}>Known limitations</h2>
          <ul style={{ paddingLeft: "1.5rem", ...mutedP }}>
            <li style={{ marginBottom: "0.5rem" }}>
              <strong>Next-day prediction is difficult.</strong> Daily equity
              prices are close to a random walk. Results at or below the naive
              baseline are common and expected.
            </li>
            <li style={{ marginBottom: "0.5rem" }}>
              <strong>End-of-day data only.</strong> All prices are end-of-day
              adjusted closes. Intraday moves are not captured.
            </li>
            <li style={{ marginBottom: "0.5rem" }}>
              <strong>Data quality.</strong> Yahoo Finance data may contain
              errors, gaps, or delayed adjustments.
            </li>
            <li style={{ marginBottom: "0.5rem" }}>
              <strong>No regime detection.</strong> The model treats the entire
              history as a single regime. Major structural breaks are not handled
              specially.
            </li>
            <li style={{ marginBottom: "0.5rem" }}>
              <strong>Price and volume only.</strong> No earnings, macro, or
              news data. The model sees only price and volume history.
            </li>
            <li style={{ marginBottom: "0.5rem" }}>
              <strong>Not investment advice.</strong> Forecasts are statistical
              estimates based on historical patterns. Past performance does not
              predict future results.
            </li>
          </ul>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
