import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteNav } from "@/components/layout/SiteNav";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { ForecastResult } from "@/components/forecast/ForecastResult";
import { createJob, getJob, ModelServiceError } from "@/lib/modelClient";
import type { ForecastResult as ForecastResultType } from "@/lib/types";

// Ticker validation — must be re-verified server-side (spec R8).
const TICKER_RE = /^[A-Z0-9.\-^]{1,15}$/;

// Exchange code to display name used in the model service response.
const EXCHANGE_LABELS: Record<string, string> = {
  NSE: "NSE",
  BSE: "BSE",
  NYSE: "NYSE",
  NASDAQ: "NASDAQ",
  "NYSE Arca": "NYSE Arca",
  "NYSE American": "NYSE American",
};

interface PageProps {
  params: Promise<{ ticker: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { ticker } = await params;
  const t = ticker.toUpperCase();
  return {
    title: `${t} Forecast`,
    description: `Next-day price forecast for ${t} with directional accuracy, MAPE and RMSE measured on held-out data.`,
    robots: { index: false, follow: false }, // /forecast/* pages are noindex per spec R8
    alternates: { canonical: `/forecast/${t}` },
  };
}

export default async function ForecastPage({ params }: PageProps) {
  const { ticker: rawTicker } = await params;
  const ticker = rawTicker.toUpperCase();

  // Server-side ticker validation.
  if (!TICKER_RE.test(ticker)) notFound();

  // Create or retrieve the job for this ticker.
  let runId: string;
  let initialStatus: string;
  let initialResult: ForecastResultType | null = null;
  let jobError: string | null = null;
  let exchange: string = "";
  let currency: string = "";

  try {
    const job = await createJob(ticker);
    runId = job.run_id;
    initialStatus = job.status;

    // If already done, fetch the full result right now to avoid a client-side
    // round-trip on first render.
    if (job.status === "done") {
      const full = await getJob(runId);
      if (full.result) {
        initialResult = full.result as ForecastResultType;
        exchange = full.result.currency === "INR" ? "NSE/BSE" : "NYSE/NASDAQ";
        currency = full.result.currency;
      }
    }
  } catch (err) {
    if (err instanceof ModelServiceError) {
      if (err.statusCode === 422 || err.statusCode === 404) notFound();
      // Service unavailable — render an error state the client can retry.
      jobError =
        "The forecast service is temporarily unavailable. Please try again in a moment.";
      runId = "";
      initialStatus = "failed";
    } else {
      jobError = "An unexpected error occurred. Please try again.";
      runId = "";
      initialStatus = "failed";
    }
  }

  // For display in the page header we use the ticker; the company name is
  // available in the result once the job completes (shown by ForecastResult).
  const exchangeLabel =
    exchange ||
    (ticker.endsWith(".NS")
      ? "NSE"
      : ticker.endsWith(".BO")
      ? "BSE"
      : "US market");

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
          padding: "var(--sp-8) var(--sp-6)",
        }}
      >
        {/* Page header */}
        <header style={{ marginBottom: "var(--sp-8)" }}>
          <p
            style={{
              margin: 0,
              fontSize: "0.85rem",
              color: "var(--text-muted)",
              marginBottom: "var(--sp-2)",
            }}
          >
            <a href="/" style={{ color: "var(--text-muted)" }}>
              Home
            </a>{" "}
            / Forecast
          </p>
          <h1
            style={{
              fontSize: "clamp(1.5rem, 4vw, 2rem)",
              fontWeight: 800,
              margin: 0,
              marginBottom: "var(--sp-2)",
            }}
          >
            {ticker}
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: "0.9rem",
              color: "var(--text-muted)",
            }}
          >
            {exchangeLabel}
            {currency ? ` · ${currency}` : ""}
            {" · "}Next-day closing price forecast
          </p>
        </header>

        {/* Hard error (service down) */}
        {jobError && !runId ? (
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
            {jobError}
          </div>
        ) : (
          <ForecastResult
            runId={runId!}
            ticker={ticker}
            initialStatus={initialStatus!}
            initialResult={initialResult}
          />
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
