import Link from "next/link";

/**
 * SiteFooter — minimal footer on every page.
 * No links pointing to "#". No social icons. No unverifiable claims.
 */
export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer
      style={{
        borderTop: "1px solid var(--border)",
        backgroundColor: "var(--surface)",
        marginTop: "auto",
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "var(--sp-6)",
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--sp-4)",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: "0.85rem",
          color: "var(--text-muted)",
        }}
      >
        <span>© {year} StockVision Pro</span>

        <nav aria-label="Footer navigation">
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              gap: "var(--sp-6)",
            }}
          >
            <li>
              <Link href="/methodology" style={{ color: "var(--text-muted)" }}>
                Methodology
              </Link>
            </li>
            <li>
              <Link href="/legal" style={{ color: "var(--text-muted)" }}>
                Legal &amp; Disclaimer
              </Link>
            </li>
          </ul>
        </nav>

        <span>
          Data:{" "}
          <a
            href="https://finance.yahoo.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--text-muted)" }}
          >
            Yahoo Finance
          </a>{" "}
          (unofficial, end-of-day)
        </span>
      </div>
    </footer>
  );
}
