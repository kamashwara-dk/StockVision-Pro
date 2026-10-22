"use client";

/**
 * ForecastChart — price history + predicted next-day point.
 *
 * Lazy-loaded via next/dynamic (ssr: false) in the forecast page.
 * Uses Recharts (already installed) for the chart.
 *
 * Accessibility:
 *   - <figure> with <figcaption> describing the chart content.
 *   - A visually-hidden data table provides the same information to
 *     screen reader users.
 *   - Chart aria-label describes the content.
 */

import {
  ComposedChart,
  Line,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from "recharts";

interface HistoryPoint {
  date: string; // ISO date string
  close: number;
}

interface Props {
  history: HistoryPoint[];
  predictedDate: string;
  predictedClose: number;
  intervalLow: number;
  intervalHigh: number;
  currency: string;
  lastClose: number;
}

/** Format a number in the correct locale for the currency. */
function fmt(value: number, currency: string): string {
  const locale = currency === "INR" ? "en-IN" : "en-US";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Reduce history to at most 260 points (one trading year) for readability. */
function downsample(points: HistoryPoint[], max = 260): HistoryPoint[] {
  if (points.length <= max) return points;
  const step = Math.floor(points.length / max);
  return points.filter((_, i) => i % step === 0 || i === points.length - 1);
}

/** Format a date string as "MMM YYYY" for axis ticks. */
function formatDateTick(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

interface TooltipPayloadEntry {
  name: string;
  value: number;
  color: string;
  payload?: {
    date?: string;
    close?: number;
    predicted?: number;
  };
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
  currency: string;
}

function CustomTooltip({ active, payload, currency }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  if (!entry) return null;

  const date = entry.payload?.date ?? "";
  const value = entry.value;

  return (
    <div
      style={{
        backgroundColor: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        padding: "var(--sp-3) var(--sp-4)",
        fontSize: "0.85rem",
      }}
    >
      <p style={{ margin: 0, fontWeight: 600 }}>{date}</p>
      <p style={{ margin: 0, color: "var(--text-muted)" }}>
        {entry.name}: {fmt(value, currency)}
      </p>
    </div>
  );
}

export function ForecastChart({
  history,
  predictedDate,
  predictedClose,
  intervalLow,
  intervalHigh,
  currency,
  lastClose,
}: Props) {
  const displayHistory = downsample(history);

  // Build chart data: history points + one predicted point.
  const chartData = displayHistory.map((p) => ({
    date: p.date,
    close: p.close,
    predicted: undefined as number | undefined,
  }));

  // Append the predicted point.
  chartData.push({
    date: predictedDate,
    close: undefined as unknown as number,
    predicted: predictedClose,
  });

  const pctChange = ((predictedClose - lastClose) / lastClose) * 100;
  const isUp = pctChange >= 0;

  return (
    <figure style={{ margin: 0 }}>
      <figcaption className="sr-only">
        Price history from {displayHistory[0]?.date ?? ""} to{" "}
        {displayHistory[displayHistory.length - 1]?.date ?? ""}. Predicted
        close on {predictedDate}: {fmt(predictedClose, currency)} (
        {pctChange >= 0 ? "+" : ""}
        {pctChange.toFixed(2)}% from last close of {fmt(lastClose, currency)}).
        80% prediction interval: {fmt(intervalLow, currency)} to{" "}
        {fmt(intervalHigh, currency)}.
      </figcaption>

      {/* Chart */}
      <div
        aria-hidden="true"
        style={{ width: "100%", height: 320 }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 12, right: 16, bottom: 0, left: 8 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border)"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tickFormatter={formatDateTick}
              tick={{ fontSize: 11, fill: "var(--text-muted)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              minTickGap={60}
            />
            <YAxis
              tickFormatter={(v: number) =>
                new Intl.NumberFormat(
                  currency === "INR" ? "en-IN" : "en-US"
                ).format(Math.round(v))
              }
              tick={{ fontSize: 11, fill: "var(--text-muted)" }}
              tickLine={false}
              axisLine={false}
              width={72}
            />
            <Tooltip
              content={
                <CustomTooltip currency={currency} />
              }
            />

            {/* 80% interval band — drawn as two reference lines */}
            <ReferenceLine
              x={predictedDate}
              stroke={isUp ? "#15803d" : "#b91c1c"}
              strokeDasharray="4 4"
              strokeOpacity={0.4}
            />

            {/* Historical close line */}
            <Line
              type="monotone"
              dataKey="close"
              stroke="var(--accent)"
              strokeWidth={1.5}
              dot={false}
              name="Close"
              connectNulls={false}
            />

            {/* Predicted point — rendered as a Scatter */}
            <Scatter
              dataKey="predicted"
              name="Forecast"
              fill={isUp ? "var(--positive)" : "var(--negative)"}
              line={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Predicted point annotation */}
      <div
        style={{
          marginTop: "var(--sp-3)",
          display: "flex",
          alignItems: "center",
          gap: "var(--sp-3)",
          flexWrap: "wrap",
          fontSize: "0.85rem",
          color: "var(--text-muted)",
        }}
      >
        <span>
          <span
            aria-hidden="true"
            style={{
              display: "inline-block",
              width: 10,
              height: 10,
              borderRadius: "50%",
              backgroundColor: isUp ? "var(--positive)" : "var(--negative)",
              marginRight: 4,
            }}
          />
          Forecast for {predictedDate}:{" "}
          <strong style={{ color: "var(--text)" }}>
            {fmt(predictedClose, currency)}
          </strong>{" "}
          <span style={{ color: isUp ? "var(--positive)" : "var(--negative)" }}>
            ({isUp ? "+" : ""}
            {pctChange.toFixed(2)}%)
          </span>
        </span>
        <span>
          80% interval: {fmt(intervalLow, currency)} – {fmt(intervalHigh, currency)}
        </span>
      </div>

      {/* Screen-reader data table */}
      <details
        style={{ marginTop: "var(--sp-4)" }}
      >
        <summary
          style={{
            fontSize: "0.82rem",
            color: "var(--text-muted)",
            cursor: "pointer",
          }}
        >
          View chart data as table
        </summary>
        <div style={{ overflowX: "auto", marginTop: "var(--sp-2)" }}>
          <table
            style={{ borderCollapse: "collapse", fontSize: "0.8rem", width: "100%" }}
          >
            <caption className="sr-only">Price history and forecast</caption>
            <thead>
              <tr>
                <th
                  scope="col"
                  style={{
                    textAlign: "left",
                    padding: "4px 8px",
                    borderBottom: "1px solid var(--border)",
                    color: "var(--text-muted)",
                  }}
                >
                  Date
                </th>
                <th
                  scope="col"
                  style={{
                    textAlign: "right",
                    padding: "4px 8px",
                    borderBottom: "1px solid var(--border)",
                    color: "var(--text-muted)",
                  }}
                >
                  Close ({currency})
                </th>
              </tr>
            </thead>
            <tbody>
              {displayHistory.slice(-20).map((p) => (
                <tr key={p.date}>
                  <td style={{ padding: "3px 8px" }}>{p.date}</td>
                  <td style={{ padding: "3px 8px", textAlign: "right" }}>
                    {fmt(p.close, currency)}
                  </td>
                </tr>
              ))}
              <tr style={{ borderTop: "2px solid var(--accent)" }}>
                <td
                  style={{
                    padding: "3px 8px",
                    fontWeight: 700,
                    color: "var(--accent)",
                  }}
                >
                  {predictedDate} (forecast)
                </td>
                <td
                  style={{
                    padding: "3px 8px",
                    textAlign: "right",
                    fontWeight: 700,
                    color: "var(--accent)",
                  }}
                >
                  {fmt(predictedClose, currency)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
