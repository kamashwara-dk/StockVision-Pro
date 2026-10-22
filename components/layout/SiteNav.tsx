import Link from "next/link";

/**
 * SiteNav — top navigation bar, present on every page.
 * Semantic <header> with a <nav> inside. No auth links, no social icons.
 */
export function SiteNav() {
  return (
    <header
      style={{
        borderBottom: "1px solid var(--border)",
        backgroundColor: "var(--surface)",
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "0 var(--sp-6)",
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Logo / wordmark */}
        <Link
          href="/"
          style={{
            fontWeight: 700,
            fontSize: "1.05rem",
            color: "var(--text)",
            textDecoration: "none",
            letterSpacing: "-0.01em",
          }}
          aria-label="StockVision Pro home"
        >
          StockVision Pro
        </Link>

        {/* Navigation links */}
        <nav aria-label="Main navigation">
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              gap: "var(--sp-6)",
              alignItems: "center",
            }}
          >
            <li>
              <Link
                href="/methodology"
                style={{
                  fontSize: "0.9rem",
                  color: "var(--text-muted)",
                  textDecoration: "none",
                }}
              >
                Methodology
              </Link>
            </li>
            <li>
              <Link
                href="/legal"
                style={{
                  fontSize: "0.9rem",
                  color: "var(--text-muted)",
                  textDecoration: "none",
                }}
              >
                Legal
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
