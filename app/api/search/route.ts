/**
 * GET /api/search?q=<query>
 *
 * Returns ranked search suggestions for NSE/BSE/NYSE/NASDAQ equities and ETFs.
 *
 * Behaviour:
 *   1. Validate query (1–50 chars).
 *   2. Check in-memory 60-second cache.
 *   3. If cache miss: call model service /search (which calls Yahoo).
 *      For queries ≤ 12 alphanumeric characters, also issue a second query
 *      with ".NS" appended and merge/deduplicate results.
 *   4. Rank with deterministic scoring (spec R1).
 *   5. Return [{symbol, name, exchange, type}] ranked.
 *
 * Rate limit: 30 requests per IP per minute.
 */

import { type NextRequest, NextResponse } from "next/server";
import { getCached, setCached, type SearchSuggestion } from "@/lib/searchCache";
import { rankResults } from "@/lib/ranking";
import { searchTickers, ModelServiceError } from "@/lib/modelClient";
import { createLimiter, hashIp, getClientIp } from "@/lib/rateLimit";
import { makeLogger } from "@/lib/logger";

// Single-instance rate limiter (shared across all /api/search calls in this process).
const searchLimiter = createLimiter({ windowMs: 60_000, max: 30 });

// Alphanumeric-only pattern for .NS suffix expansion.
const ALPHANUMERIC_RE = /^[A-Z0-9]+$/i;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const log = makeLogger();
  const start = Date.now();

  // ── Rate limiting ────────────────────────────────────────────────────────────
  const ip = getClientIp(request);
  const ipHash = hashIp(ip);
  const limit = searchLimiter.check(ipHash);

  if (!limit.ok) {
    log.warn("search.rate_limited", { ipHash });
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "Too many requests. Please slow down." } },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((limit.resetAt - Date.now()) / 1000)),
          "X-RateLimit-Limit": "30",
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(limit.resetAt / 1000)),
        },
      }
    );
  }

  // ── Query validation ─────────────────────────────────────────────────────────
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const trimmed = q.trim();

  if (trimmed.length === 0) {
    return NextResponse.json([], { status: 200 });
  }

  if (trimmed.length > 50) {
    return NextResponse.json(
      { error: { code: "INVALID_QUERY", message: "Query must be 1–50 characters." } },
      { status: 422 }
    );
  }

  log.info("search.start", { q: trimmed });

  // ── Cache check ──────────────────────────────────────────────────────────────
  const cached = getCached(trimmed);
  if (cached !== null) {
    log.info("search.cache_hit", { q: trimmed, ms: Date.now() - start });
    return NextResponse.json(cached, {
      headers: { "X-Cache": "HIT" },
    });
  }

  // ── Fetch from model service ─────────────────────────────────────────────────
  try {
    const primaryResults = await searchTickers(trimmed);

    // .NS suffix expansion: for short alphanumeric queries, also search
    // "<query>.NS" to surface common NSE tickers like "RELIANCE.NS" when
    // the user types "RELIANCE".
    let allResults: SearchSuggestion[] = primaryResults;

    if (
      trimmed.length <= 12 &&
      ALPHANUMERIC_RE.test(trimmed) &&
      !trimmed.includes(".")
    ) {
      try {
        const nsResults = await searchTickers(trimmed + ".NS");
        // Merge and deduplicate by symbol (primary result wins on conflict).
        const seen = new Set(primaryResults.map((r) => r.symbol));
        for (const r of nsResults) {
          if (!seen.has(r.symbol)) {
            allResults.push(r);
            seen.add(r.symbol);
          }
        }
      } catch {
        // .NS expansion failing is non-fatal; continue with primary results.
        log.warn("search.ns_expansion_failed", { q: trimmed });
      }
    }

    // ── Rank ──────────────────────────────────────────────────────────────────
    const ranked = rankResults(trimmed, allResults);

    // ── Cache and return ──────────────────────────────────────────────────────
    setCached(trimmed, ranked);

    log.info("search.done", {
      q: trimmed,
      results: ranked.length,
      ms: Date.now() - start,
    });

    return NextResponse.json(ranked, {
      headers: {
        "X-Cache": "MISS",
        "X-RateLimit-Remaining": String(limit.remaining),
      },
    });
  } catch (err) {
    if (err instanceof ModelServiceError) {
      log.error("search.upstream_error", err, { q: trimmed });
      return NextResponse.json(
        {
          error: {
            code: "UPSTREAM_ERROR",
            message: "Search is temporarily unavailable. Please try again.",
          },
        },
        { status: 502 }
      );
    }
    log.error("search.unexpected_error", err, { q: trimmed });
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred.",
        },
      },
      { status: 500 }
    );
  }
}
