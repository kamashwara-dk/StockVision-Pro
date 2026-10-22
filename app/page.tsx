import type { Metadata } from "next";
import { SiteNav } from "@/components/layout/SiteNav";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SearchCombobox } from "@/components/search/SearchCombobox";

export const metadata: Metadata = {
  title: "StockVision Pro | Stock Price Forecasts from 10 Years of Market Data",
  description:
    "Search any NSE, BSE or US-listed stock and see a next-day price forecast with directional accuracy, MAPE and RMSE measured on held-out data.",
  alternates: {
    canonical: "/",
  },
};

export default function HomePage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <SiteNav />

      <main
        id="main-content"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "var(--sp-16) var(--sp-6)",
        }}
      >
        <div style={{ width: "100%", maxWidth: 600 }}>
          {/* H1 */}
          <h1
            style={{
              fontSize: "clamp(1.75rem, 5vw, 2.5rem)",
              fontWeight: 800,
              color: "var(--text)",
              marginBottom: "var(--sp-4)",
              textAlign: "center",
            }}
          >
            Stock price forecasts based on historical data
          </h1>

          {/* One-sentence description */}
          <p
            style={{
              fontSize: "1.05rem",
              color: "var(--text-muted)",
              textAlign: "center",
              marginBottom: "var(--sp-8)",
              lineHeight: 1.6,
            }}
          >
            Search any NSE, BSE or US-listed equity or ETF. We fetch up to ten
            years of daily data, train a model, and show you the next-day
            forecast with accuracy measured on held-out data.
          </p>

          {/* Search field */}
          <SearchCombobox placeholder="e.g. RELIANCE.NS, AAPL, NIFTY50…" />

          {/* Hint */}
          <p
            style={{
              marginTop: "var(--sp-3)",
              fontSize: "0.82rem",
              color: "var(--text-muted)",
              textAlign: "center",
            }}
          >
            Supports NSE, BSE, NYSE and NASDAQ. Prices are end-of-day and
            adjusted for splits and dividends.
          </p>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
