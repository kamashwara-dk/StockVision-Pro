/**
 * MetricsPanel — displays directional accuracy, MAPE, RMSE alongside
 * naive baselines, with plain-English explanations and a verdict.
 *
 * Every number comes from a forecast_runs row (via the API response).
 * No hardcoded figures anywhere.
 */

import type { ForecastResult } from "@/lib/types";

interface Props {
  result: ForecastResult;
}

/** Format a number in the correct locale for the currency. */
function fmtCurrency(value: number, currency: string): string {
  const locale = currency === "INR" ? "en-IN" : "en-US";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function fmtPct(value: number): string {
  return value.toFixed(1) + "%";
}

function MetricRow({
  label,
  model,
  baseline,
  explain,
  unit,
}: {
  label: string;
  model: string;
  baseline: string;
  explain: string;
  unit?: string;
}) {
  return (
    <div
      style={{
        borderBottom: "1px solid var(--border)",
        paddingBottom: "var(--sp-4)",
        marginBottom: "var(--sp-4)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "var(--sp-2)",
          marginBottom: "var(--sp-1)",
        }}
      >
        <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>{label}</span>
        <span style={{ display: "flex", gap: "var(--sp-4)", fontSize: "0.95rem" }}>
          <span>
            <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
              Model{" "}
            </span>
            <strong>{model}</strong>
            {unit && (
              <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
                {" "}
                {unit}
              </span>
            )}
          </span>
          <span>
            <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
              Naive{" "}
            </span>
            <span style={{ color: "var(--text-muted)" }}>{baseline}</span>
          </span>
        </span>
      </div>
      <p
        style={{
          margin: 0,
          fontSize: "0.82rem",
          color: "var(--text-muted)",
          lineHeight: 1.5,
        }}
      >
        {explain}
      </p>
    </div>
  );
}

export function MetricsPanel({ result }: Props) {
  const { metrics, baselines, test_range, n_test_days, currency } = result;

  // Verdict.
  const beatsBaseline =
    metrics.rmse < baselines.rmse && metrics.mape < baselines.mape;

  const rmseImprovement =
    beatsBaseline && baselines.rmse > 0
      ? ((baselines.rmse - metrics.rmse) / baselines.rmse) * 100
      : null;

  const mapeImprovement =
    beatsBaseline && baselines.mape > 0
      ? ((baselines.mape - metrics.mape) / baselines.mape) * 100
      : null;

  return (
    <section aria-labelledby="metrics-heading">
      <h2
        id="metrics-heading"
        style={{
          fontSize: "1.1rem",
          fontWeight: 700,
          marginBottom: "var(--sp-2)",
        }}
      >
        Accuracy metrics
      </h2>

      {/* Evaluation period */}
      <p
        style={{
          fontSize: "0.85rem",
          color: "var(--text-muted)",
          marginBottom: "var(--sp-6)",
        }}
      >
        Evaluated on the most recent 20% of data ({test_range.start} to{" "}
        {test_range.end}), {n_test_days} trading days.
      </p>

      {/* Metrics */}
      <MetricRow
        label="Directional accuracy"
        model={fmtPct(metrics.directional_accuracy)}
        baseline={fmtPct(baselines.directional)}
        explain={
          "Percentage of trading days where the model correctly predicted " +
          "whether the price would rise or fall from the previous close. " +
          "Days with no price change are excluded from the denominator."
        }
      />

      <MetricRow
        label="MAPE"
        model={fmtPct(metrics.mape)}
        baseline={fmtPct(baselines.mape)}
        explain={
          "Mean absolute percentage error: average of |actual − predicted| / actual × 100. " +
          "Lower is better."
        }
      />

      <MetricRow
        label="RMSE"
        model={fmtCurrency(metrics.rmse, currency)}
        baseline={fmtCurrency(baselines.rmse, currency)}
        unit=""
        explain={
          "Root mean squared error in " +
          currency +
          ": square root of the average squared price error. " +
          "Lower is better. The naive baseline predicts tomorrow = today."
        }
      />

      {/* Verdict */}
      <div
        style={{
          padding: "var(--sp-4) var(--sp-6)",
          borderRadius: 6,
          backgroundColor: beatsBaseline ? "#f0fdf4" : "#fef9f0",
          border: `1px solid ${beatsBaseline ? "#bbf7d0" : "#fed7aa"}`,
          fontSize: "0.9rem",
          lineHeight: 1.6,
        }}
      >
        {beatsBaseline ? (
          <span>
            On this test period the model beats the naive baseline
            {rmseImprovement !== null && (
              <>
                {" "}
                by {rmseImprovement.toFixed(1)}% on RMSE
                {mapeImprovement !== null && (
                  <> and {mapeImprovement.toFixed(1)}% on MAPE</>
                )}
              </>
            )}
            . No claims of statistical significance are made.
          </span>
        ) : (
          <span>
            On this test period the model does not beat the naive baseline
            (tomorrow = today).
          </span>
        )}
      </div>
    </section>
  );
}
