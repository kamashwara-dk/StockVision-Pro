import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "StockVision Pro — stock price forecasts based on historical data";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          backgroundColor: "#f8f9fa",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px 96px",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Site name */}
        <div
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: "#1d4ed8",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            marginBottom: 24,
          }}
        >
          StockVision Pro
        </div>

        {/* Headline */}
        <div
          style={{
            fontSize: 60,
            fontWeight: 800,
            color: "#111827",
            lineHeight: 1.15,
            letterSpacing: "-0.02em",
            marginBottom: 28,
            maxWidth: 800,
          }}
        >
          Stock price forecasts based on historical data
        </div>

        {/* Description */}
        <div
          style={{
            fontSize: 26,
            color: "#6b7280",
            lineHeight: 1.5,
            maxWidth: 760,
            marginBottom: 56,
          }}
        >
          Search any NSE, BSE or US-listed stock. See a next-day forecast with
          directional accuracy, MAPE and RMSE measured on held-out data.
        </div>

        {/* Tag row */}
        <div style={{ display: "flex", gap: 12 }}>
          {["NSE · BSE", "NYSE · NASDAQ", "10 years of data", "Walk-forward evaluation"].map(
            (tag) => (
              <div
                key={tag}
                style={{
                  padding: "10px 20px",
                  borderRadius: 6,
                  border: "1.5px solid #e2e5ea",
                  backgroundColor: "#ffffff",
                  fontSize: 16,
                  fontWeight: 600,
                  color: "#374151",
                }}
              >
                {tag}
              </div>
            )
          )}
        </div>

        {/* Bottom rule */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 5,
            backgroundColor: "#1d4ed8",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
