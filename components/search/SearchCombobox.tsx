"use client";

/**
 * SearchCombobox — ARIA combobox + listbox pattern (spec R1).
 *
 * Accessibility:
 *   - role="combobox" on the input, aria-expanded, aria-autocomplete="list",
 *     aria-controls="search-listbox", aria-activedescendant
 *   - role="listbox" on the dropdown list
 *   - role="option" on each item with aria-selected
 *   - aria-live="polite" region announces result count
 *   - ArrowUp/ArrowDown move active descendant
 *   - Enter selects the active option (or first option if nothing is active)
 *   - Escape closes the listbox
 *   - Visible focus styles on input and options
 *
 * Network:
 *   - 250 ms debounce
 *   - Each new keystroke cancels the previous in-flight request via AbortController
 *   - Responses whose request ID is not the latest are discarded
 */

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { SearchSuggestion } from "@/lib/types";

interface Props {
  /** Placeholder text for the input. */
  placeholder?: string;
}

export function SearchCombobox({ placeholder = "Search for a stock or ETF…" }: Props) {
  const router = useRouter();
  const inputId = useId();
  const listboxId = useId();
  const liveRegionId = useId();

  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveText, setLiveText] = useState("");

  // Track the latest request so stale responses are discarded.
  const latestRequestId = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // ── Fetch suggestions ───────────────────────────────────────────────────────
  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.trim().length === 0) {
      setSuggestions([]);
      setIsOpen(false);
      setLiveText("");
      return;
    }

    // Cancel any in-flight request.
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const requestId = ++latestRequestId.current;

    setIsLoading(true);
    setError(null);

    try {
      const resp = await fetch(
        `/api/search?q=${encodeURIComponent(q.trim())}`,
        { signal: controller.signal }
      );

      // Discard stale responses.
      if (requestId !== latestRequestId.current) return;

      if (!resp.ok) {
        throw new Error("Search request failed");
      }

      const data: SearchSuggestion[] = await resp.json();

      // Discard stale responses (double-check after await).
      if (requestId !== latestRequestId.current) return;

      setSuggestions(data);
      setIsOpen(true);
      setActiveIndex(-1);

      if (data.length === 0) {
        setLiveText("No matching stocks found.");
      } else {
        setLiveText(
          `${data.length} result${data.length === 1 ? "" : "s"} available.`
        );
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      if (requestId !== latestRequestId.current) return;
      setError("Search unavailable. Please try again.");
      setSuggestions([]);
      setIsOpen(false);
    } finally {
      if (requestId === latestRequestId.current) {
        setIsLoading(false);
      }
    }
  }, []);

  // ── Debounced input handler ─────────────────────────────────────────────────
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => fetchSuggestions(val), 250);
  };

  // ── Navigation ──────────────────────────────────────────────────────────────
  const handleSelect = useCallback(
    (symbol: string) => {
      setIsOpen(false);
      setSuggestions([]);
      setQuery(symbol);
      router.push(`/forecast/${encodeURIComponent(symbol)}`);
    },
    [router]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) {
      if (e.key === "Enter" && query.trim()) {
        handleSelect(query.trim().toUpperCase());
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, -1));
        break;
      case "Enter":
        e.preventDefault();
        if (activeIndex >= 0) {
          handleSelect(suggestions[activeIndex].symbol);
        } else if (suggestions.length > 0) {
          handleSelect(suggestions[0].symbol);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        setActiveIndex(-1);
        break;
    }
  };

  // Scroll active option into view.
  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return;
    const option = listRef.current.children[activeIndex] as HTMLElement | undefined;
    option?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  // Close on outside click.
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const input = inputRef.current;
      const list = listRef.current;
      if (
        input &&
        !input.contains(e.target as Node) &&
        list &&
        !list.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  const activeOptionId =
    activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined;

  return (
    <div style={{ position: "relative", width: "100%" }}>
      {/* ── Input ─────────────────────────────────────────────────────────── */}
      <div style={{ position: "relative" }}>
        <input
          ref={inputRef}
          id={inputId}
          type="search"
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-activedescendant={activeOptionId}
          aria-label="Search for a stock or ETF"
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          placeholder={placeholder}
          style={{
            width: "100%",
            padding: "0.75rem 1rem",
            paddingRight: isLoading ? "2.5rem" : "1rem",
            fontSize: "1rem",
            border: "1.5px solid var(--border)",
            borderRadius: 6,
            backgroundColor: "var(--surface)",
            color: "var(--text)",
            outline: "none",
          }}
        />
        {/* Loading spinner — visible only when fetching */}
        {isLoading && (
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              right: "0.75rem",
              top: "50%",
              transform: "translateY(-50%)",
              width: 18,
              height: 18,
              border: "2px solid var(--border)",
              borderTopColor: "var(--accent)",
              borderRadius: "50%",
              animation: "spin 0.7s linear infinite",
            }}
          />
        )}
      </div>

      {/* ── Live region ───────────────────────────────────────────────────── */}
      <div
        id={liveRegionId}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {liveText}
      </div>

      {/* ── Error message ─────────────────────────────────────────────────── */}
      {error && (
        <p
          role="alert"
          style={{
            marginTop: "var(--sp-2)",
            fontSize: "0.85rem",
            color: "var(--negative)",
          }}
        >
          {error}
        </p>
      )}

      {/* ── Listbox ───────────────────────────────────────────────────────── */}
      {isOpen && (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-label="Stock search results"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 50,
            margin: 0,
            padding: "var(--sp-2) 0",
            listStyle: "none",
            backgroundColor: "var(--surface)",
            border: "1.5px solid var(--border)",
            borderRadius: 6,
            boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
            maxHeight: 320,
            overflowY: "auto",
          }}
        >
          {suggestions.length === 0 ? (
            <li
              style={{
                padding: "0.625rem 1rem",
                fontSize: "0.9rem",
                color: "var(--text-muted)",
              }}
            >
              No matching stocks found.
            </li>
          ) : (
            suggestions.map((s, i) => {
              const isActive = i === activeIndex;
              return (
                <li
                  key={s.symbol}
                  id={`${listboxId}-option-${i}`}
                  role="option"
                  aria-selected={isActive}
                  onMouseDown={(e) => {
                    // Prevent input blur before click registers.
                    e.preventDefault();
                    handleSelect(s.symbol);
                  }}
                  onMouseEnter={() => setActiveIndex(i)}
                  style={{
                    padding: "0.625rem 1rem",
                    cursor: "pointer",
                    backgroundColor: isActive ? "#eff6ff" : "transparent",
                    borderLeft: isActive
                      ? "3px solid var(--accent)"
                      : "3px solid transparent",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "var(--sp-4)",
                  }}
                >
                  {/* Left: symbol + name */}
                  <span style={{ minWidth: 0 }}>
                    <span
                      style={{
                        fontWeight: 600,
                        fontSize: "0.95rem",
                        color: isActive ? "var(--accent)" : "var(--text)",
                        display: "block",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {s.symbol}
                    </span>
                    <span
                      style={{
                        fontSize: "0.82rem",
                        color: "var(--text-muted)",
                        display: "block",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {s.name}
                    </span>
                  </span>

                  {/* Right: exchange + type badges */}
                  <span
                    style={{
                      flexShrink: 0,
                      display: "flex",
                      gap: "var(--sp-2)",
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        color: "var(--text-muted)",
                        backgroundColor: "#f3f4f6",
                        padding: "2px 7px",
                        borderRadius: 4,
                      }}
                    >
                      {s.exchange}
                    </span>
                    <span
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--text-muted)",
                      }}
                    >
                      {s.type}
                    </span>
                  </span>
                </li>
              );
            })
          )}
        </ul>
      )}

      {/* Spinner keyframe — embedded here to avoid a separate CSS file */}
      <style>{`
        @keyframes spin { to { transform: translateY(-50%) rotate(360deg); } }
      `}</style>
    </div>
  );
}
