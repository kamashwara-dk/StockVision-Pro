import type { Metadata } from "next";
import { SiteNav } from "@/components/layout/SiteNav";
import { SiteFooter } from "@/components/layout/SiteFooter";

export const metadata: Metadata = {
  title: "Legal",
  description: "Disclaimer, Terms of Use, and Privacy Policy for StockVision Pro.",
  alternates: { canonical: "/legal" },
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
  paddingTop: "var(--sp-6)",
  borderTop: "1px solid var(--border)",
};

const mutedP: React.CSSProperties = {
  color: "var(--text-muted)",
  marginBottom: "1rem",
};

export default function LegalPage() {
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
            Legal
          </h1>
          <p style={mutedP}>
            Last updated: October 2026. Legal entity: [LEGAL ENTITY]. Contact:{" "}
            [CONTACT EMAIL]. Governing law: [GOVERNING LAW].
          </p>

          {/* ── Disclaimer ── */}
          <h2 style={h2Style}>Disclaimer</h2>
          <p style={mutedP}>
            Forecasts produced by StockVision Pro are statistical estimates
            based on historical price and volume data. They are <strong>not</strong>{" "}
            investment advice, financial recommendations, or solicitations to
            buy or sell any security.
          </p>
          <p style={mutedP}>
            All data is end-of-day and sourced from Yahoo Finance, an unofficial
            endpoint. Data may be delayed, inaccurate, or unavailable. [LEGAL
            ENTITY] makes no representations about the accuracy, completeness,
            or timeliness of any data or forecast.
          </p>
          <p style={mutedP}>
            Past performance of a model on held-out historical data does not
            guarantee future performance. Next-day equity price prediction is a
            difficult problem; model accuracy may be at or below a naive
            baseline. You should not make any investment decision based solely
            on output from this service.
          </p>
          <p style={mutedP}>
            [LEGAL ENTITY] is not a registered investment adviser, broker-dealer,
            or financial institution. Nothing on this site constitutes
            professional financial advice.
          </p>

          {/* ── Terms of Use ── */}
          <h2 style={h2Style}>Terms of Use</h2>
          <p style={mutedP}>
            By using StockVision Pro you agree to the following terms.
          </p>
          <p style={mutedP}>
            <strong>Permitted use.</strong> You may use this service for
            personal, non-commercial research and evaluation of statistical
            forecasting methods.
          </p>
          <p style={mutedP}>
            <strong>Prohibited use.</strong> You may not use this service to
            make automated trading decisions, redistribute forecasts commercially,
            scrape or systematically extract data, or circumvent rate limits.
          </p>
          <p style={mutedP}>
            <strong>No accounts.</strong> This service does not create or manage
            user accounts. No registration is required or offered.
          </p>
          <p style={mutedP}>
            <strong>Availability.</strong> This service is provided on an "as
            is" basis without any warranty of uptime or availability. [LEGAL
            ENTITY] may modify or discontinue the service at any time without
            notice.
          </p>
          <p style={mutedP}>
            <strong>Data provider terms.</strong> Historical price data is
            sourced via Yahoo Finance's unofficial API. Your use of this service
            is also subject to Yahoo Finance's terms of service. [LEGAL ENTITY]
            is not affiliated with Yahoo or Verizon Media.
          </p>
          <p style={mutedP}>
            <strong>Limitation of liability.</strong> To the maximum extent
            permitted by [GOVERNING LAW], [LEGAL ENTITY] shall not be liable for
            any direct, indirect, incidental, or consequential damages arising
            from use of this service or reliance on any forecast.
          </p>
          <p style={mutedP}>
            <strong>Governing law.</strong> These terms are governed by and
            construed in accordance with the laws of [GOVERNING LAW].
          </p>

          {/* ── Privacy ── */}
          <h2 style={h2Style}>Privacy Policy</h2>
          <p style={mutedP}>
            <strong>What we collect.</strong>
          </p>
          <ul style={{ paddingLeft: "1.5rem", ...mutedP }}>
            <li style={{ marginBottom: "0.5rem" }}>
              <strong>Search queries.</strong> The text you type into the search
              field is sent to our servers to retrieve results. Queries may be
              retained in server logs for up to 30 days for debugging and abuse
              prevention.
            </li>
            <li style={{ marginBottom: "0.5rem" }}>
              <strong>Hashed IP address.</strong> Your IP address is hashed
              (SHA-256, one-way) and used solely for rate limiting. The plain IP
              address is not stored beyond the request.
            </li>
            <li style={{ marginBottom: "0.5rem" }}>
              <strong>Server logs.</strong> Standard web server logs (timestamp,
              URL path, HTTP status code, response time) are retained for up to
              30 days.
            </li>
          </ul>
          <p style={mutedP}>
            <strong>What we do not collect.</strong> We do not collect names,
            email addresses, financial data, or any personally identifiable
            information. We do not use cookies for tracking. We do not use
            third-party analytics scripts.
          </p>
          <p style={mutedP}>
            <strong>Data sharing.</strong> We do not sell or share data with
            third parties except as required by law or to operate the service
            (for example, our hosting provider processes request logs in the
            normal course of serving the site).
          </p>
          <p style={mutedP}>
            <strong>Contact.</strong> For privacy-related enquiries, contact
            [CONTACT EMAIL].
          </p>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
