"use client";

/**
 * SkipLink — visible-on-focus skip navigation link for keyboard users.
 * Satisfies WCAG 2.4.1 (bypass blocks).
 */
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="skip-link"
      style={{
        position: "absolute",
        left: "-9999px",
        top: 8,
        zIndex: 9999,
        padding: "8px 16px",
        backgroundColor: "var(--accent)",
        color: "#ffffff",
        fontWeight: 600,
        borderRadius: 4,
        textDecoration: "none",
        fontSize: "0.9rem",
      }}
      onFocus={(e) => {
        e.currentTarget.style.left = "16px";
      }}
      onBlur={(e) => {
        e.currentTarget.style.left = "-9999px";
      }}
    >
      Skip to main content
    </a>
  );
}
