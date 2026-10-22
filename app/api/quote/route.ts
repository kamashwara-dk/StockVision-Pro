/**
 * GET /api/quote?ticker=RELIANCE.NS
 *
 * Returns a delayed quote for a single ticker.
 * Proxies through the model service so Yahoo Finance credentials
 * and logic stay server-side only.
 *
 * Response shape (matches what MarketOverview, HoldingsTable,
 * PortfolioProvider and the stock detail page all expect):
 *   {
 *     ticker: string,
 *     name: string,
 *     price: number,
 *     change_pct: number | null,
 *     currency: string,
 *     exchange: string,
 *     delay_minutes: number,   // always 15 (Yahoo delayed)
 *     prev_close: number | null,
 *   }
 *
 * On failure the route returns { error: string } with the appropriate
 * HTTP status so callers can hide the failing item rather than show stale data.
 *
 * Rate limit: shared with /api/search (30/min per IP).
 * Cache: 60 seconds in-process (Next.js fetch revalidation).
 */

import { type NextRequest, NextResponse } from "next/server";
import { getQuote, ModelServiceError } from "@/lib/modelClient";
import { makeLogger } from "@/lib/logger";
import { createLimiter, hashIp, getClientIp } from "@/lib/rateLimit";

// Ticker regex — keep in sync with model-service
const TICKER_RE = /^[A-Z0-9.\-^]{1,20}$/;

// 30 quote requests per IP per minute (shared across the API layer)
const quoteLimiter = createLimiter({ windowMs: 60_000, max: 30 });

export async function GET(request: NextRequest): Promise<NextResponse> {
  const log = makeLogger();

  // Rate limit
  const limit = quoteLimiter.check(hashIp(getClientIp(request)));
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((limit.resetAt - Date.now()) / 1000)) },
      }
    );
  }

  const ticker = (request.nextUrl.searchParams.get("ticker") ?? "").trim().toUpperCase();

  if (!ticker) {
    return NextResponse.json({ error: "ticker parameter is required" }, { status: 400 });
  }
  if (!TICKER_RE.test(ticker)) {
    return NextResponse.json({ error: "Invalid ticker format." }, { status: 422 });
  }

  try {
    const data = await getQuote(ticker);
    return NextResponse.json(data, {
      headers: {
        // Tell the browser this is delayed data, not live.
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30",
        "X-Data-Delay": "up to 15 minutes",
      },
    });
  } catch (err) {
    if (err instanceof ModelServiceError) {
      if (err.statusCode === 404) {
        return NextResponse.json({ error: `Ticker '${ticker}' not found.` }, { status: 404 });
      }
      log.error("quote.upstream_error", err, { ticker });
      return NextResponse.json({ error: "Quote service temporarily unavailable." }, { status: 502 });
    }
    log.error("quote.unexpected_error", err, { ticker });
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
