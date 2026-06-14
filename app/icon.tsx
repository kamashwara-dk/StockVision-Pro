import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 7,
          background: "linear-gradient(135deg, #0A0F1E 0%, #111827 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Chart bars */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 1.5, position: "absolute", bottom: 6, left: 5 }}>
          <div style={{ width: 3, height: 5,  borderRadius: 1, background: "rgba(0,229,160,0.35)" }} />
          <div style={{ width: 3, height: 8,  borderRadius: 1, background: "rgba(0,229,160,0.35)" }} />
          <div style={{ width: 3, height: 11, borderRadius: 1, background: "rgba(0,229,160,0.4)" }} />
          <div style={{ width: 3, height: 14, borderRadius: 1, background: "rgba(0,229,160,0.45)" }} />
          <div style={{ width: 3, height: 18, borderRadius: 1, background: "rgba(0,229,160,0.5)" }} />
        </div>

        {/* Trend line — drawn as SVG overlay */}
        <svg
          width="32"
          height="32"
          viewBox="0 0 32 32"
          style={{ position: "absolute", top: 0, left: 0 }}
        >
          <polyline
            points="6,24 11,20 16,15 21,10 26,5"
            stroke="#00E5A0"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <circle cx="26" cy="5" r="2.5" fill="#00E5A0" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
