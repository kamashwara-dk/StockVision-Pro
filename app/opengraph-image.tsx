import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "StockVision Pro | AI-Powered Market Intelligence";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          background: "linear-gradient(135deg, #0A0F1E 0%, #0D1425 60%, #111827 100%)",
          display: "flex",
          fontFamily: "system-ui, -apple-system, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Glow orb top-left */}
        <div style={{
          position: "absolute", top: -80, left: -80,
          width: 400, height: 400,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(0,229,160,0.12) 0%, transparent 70%)",
        }} />
        {/* Glow orb bottom-right */}
        <div style={{
          position: "absolute", bottom: -100, right: -60,
          width: 450, height: 450,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(79,70,229,0.15) 0%, transparent 70%)",
        }} />

        {/* ── LEFT: Brand + copy ── */}
        <div style={{ display: "flex", flexDirection: "column", padding: "60px 60px 60px 60px", flex: 1 }}>

          {/* Logo + name row */}
          <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 32 }}>
            {/* Logo mark */}
            <div style={{
              width: 72, height: 72, borderRadius: 16,
              background: "#111827",
              border: "1px solid rgba(255,255,255,0.1)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {/* SVG chart bars + line inline */}
              <svg width="42" height="42" viewBox="0 0 42 42" fill="none">
                <rect x="2"  y="28" width="5" height="12" rx="1.5" fill="rgba(0,229,160,0.3)"/>
                <rect x="10" y="22" width="5" height="18" rx="1.5" fill="rgba(0,229,160,0.3)"/>
                <rect x="18" y="15" width="5" height="25" rx="1.5" fill="rgba(0,229,160,0.3)"/>
                <rect x="26" y="8"  width="5" height="32" rx="1.5" fill="rgba(0,229,160,0.35)"/>
                <rect x="34" y="2"  width="5" height="38" rx="1.5" fill="rgba(0,229,160,0.4)"/>
                <polyline points="4.5,27 12.5,21 20.5,14 28.5,7 36.5,1" stroke="#00E5A0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                <circle cx="36.5" cy="1" r="2.5" fill="#00E5A0"/>
              </svg>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 28, fontWeight: 800, color: "white", letterSpacing: -0.5 }}>StockVision</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#00E5A0", letterSpacing: 3 }}>PRO</span>
            </div>
          </div>

          {/* Divider */}
          <div style={{ width: 480, height: 1, background: "rgba(255,255,255,0.06)", marginBottom: 32 }} />

          {/* Hero text */}
          <div style={{ fontSize: 54, fontWeight: 800, color: "white", letterSpacing: -1.5, lineHeight: 1.1, marginBottom: 8 }}>
            Invest Smarter.
          </div>
          <div style={{ fontSize: 54, fontWeight: 800, color: "#00E5A0", letterSpacing: -1.5, lineHeight: 1.1, marginBottom: 28 }}>
            Predict Bolder.
          </div>

          {/* Description */}
          <div style={{ fontSize: 20, color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>
            AI-powered portfolio tracking · Real-time ML forecasts
          </div>
          <div style={{ fontSize: 20, color: "rgba(255,255,255,0.5)", marginBottom: 36 }}>
            Indian &amp; global markets · Multi-currency support
          </div>

          {/* Stat pills */}
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{
              padding: "10px 22px", borderRadius: 22,
              background: "rgba(0,229,160,0.1)", border: "1px solid rgba(0,229,160,0.25)",
              fontSize: 14, fontWeight: 700, color: "#00E5A0",
            }}>89% Accuracy</div>
            <div style={{
              padding: "10px 22px", borderRadius: 22,
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
              fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.65)",
            }}>12,400+ Users</div>
            <div style={{
              padding: "10px 22px", borderRadius: 22,
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
              fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.65)",
            }}>$2.4B Tracked</div>
          </div>

          {/* URL at bottom */}
          <div style={{ marginTop: "auto", fontSize: 16, color: "rgba(255,255,255,0.22)", letterSpacing: 0.5 }}>
            stockvision-pro.vercel.app
          </div>
        </div>

        {/* ── RIGHT: Mock chart card ── */}
        <div style={{
          width: 490, margin: "50px 50px 50px 0",
          borderRadius: 24,
          background: "#111827",
          border: "1px solid rgba(255,255,255,0.07)",
          display: "flex", flexDirection: "column",
          padding: "32px 36px",
          overflow: "hidden",
        }}>
          {/* Card header */}
          <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.35)", letterSpacing: 2, marginBottom: 8 }}>
            PORTFOLIO VALUE
          </div>
          <div style={{ fontSize: 38, fontWeight: 800, color: "white", marginBottom: 6 }}>₹2,84,320</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#00E5A0", marginBottom: 20 }}>▲ +18.4% all-time</div>

          {/* Divider */}
          <div style={{ width: "100%", height: 1, background: "rgba(255,255,255,0.06)", marginBottom: 16 }} />

          {/* Stock chips */}
          <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
            {[
              { sym: "AAPL", up: true }, { sym: "TSLA", up: false },
              { sym: "NVDA", up: true }, { sym: "NIFTY", up: true },
            ].map(({ sym, up }) => (
              <div key={sym} style={{
                padding: "6px 14px", borderRadius: 8,
                background: up ? "rgba(0,229,160,0.1)" : "rgba(255,90,90,0.1)",
                border: `1px solid ${up ? "rgba(0,229,160,0.25)" : "rgba(255,90,90,0.25)"}`,
                fontSize: 13, fontWeight: 700,
                color: up ? "#00E5A0" : "#FF5A5A",
              }}>
                {sym} {up ? "▲" : "▼"}
              </div>
            ))}
          </div>

          {/* Chart area */}
          <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "flex-end" }}>
            <svg width="418" height="200" viewBox="0 0 418 200" fill="none">
              <defs>
                <linearGradient id="fill" x1="0" y1="0" x2="0" y2="200" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stop-color="#00E5A0" stop-opacity="0.25"/>
                  <stop offset="100%" stop-color="#00E5A0" stop-opacity="0"/>
                </linearGradient>
              </defs>
              {/* Grid lines */}
              <line x1="0" y1="50"  x2="418" y2="50"  stroke="rgba(255,255,255,0.04)" stroke-width="1"/>
              <line x1="0" y1="100" x2="418" y2="100" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>
              <line x1="0" y1="150" x2="418" y2="150" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>
              {/* Fill area */}
              <polygon
                points="0,160 46,150 93,155 139,135 186,115 232,95 279,75 325,52 371,32 418,12 418,200 0,200"
                fill="url(#fill)"
              />
              {/* Line */}
              <polyline
                points="0,160 46,150 93,155 139,135 186,115 232,95 279,75 325,52 371,32 418,12"
                stroke="#00E5A0" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"
              />
              {/* End dot */}
              <circle cx="418" cy="12" r="5" fill="#00E5A0"/>
              <circle cx="418" cy="12" r="9" fill="none" stroke="#00E5A0" stroke-width="1.5" opacity="0.4"/>
            </svg>
          </div>

          {/* X labels */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
            {["Jul", "Aug", "Sep", "Oct", "Nov", "Now"].map((m, i) => (
              <span key={m} style={{ fontSize: 12, color: i === 5 ? "#00E5A0" : "rgba(255,255,255,0.25)" }}>{m}</span>
            ))}
          </div>
        </div>

        {/* Bottom accent bar */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          height: 4,
          background: "linear-gradient(90deg, #00E5A0, #00C98D)",
          opacity: 0.7,
        }} />
      </div>
    ),
    { ...size }
  );
}
