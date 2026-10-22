/**
 * POST /api/forecasts
 *
 * Body: { ticker: string }
 *
 * Creates a new forecast job or returns an existing one for the current
 * trading day (single-flight rule).
 *
 * Returns:
 *   202 { runId, status } for new / in-progress jobs.
 *   200 { runId, status } if a completed run already exists for today
 *       (model service handles this; we pass the response through).
 *
 * Rate limit: 5 forecast creation requests per IP per minute.
 */

import { type NextRequest, NextResponse } from "next/server";
import { createJob, ModelServiceError } from "@/lib/modelClient";
import { createLimiter, hashIp, getClientIp } from "@/lib/rateLimit";
import { makeLogger } from "@/lib/logger";

// Ticker validation — matches spec R8.
const TICKER_RE = /^[A-Z0-9.\-^]{1,15}$/;

// Rate limiter: 5 forecast requests per IP per minute.
const forecastLimiter = createLimiter({ windowMs: 60_000, max: 5 });

export async function POST(request: NextRequest): Promise<NextResponse> {
  const log = makeLogger();
  const start = Date.now();

  // ── Rate limiting ────────────────────────────────────────────────────────────
  const ip = getClientIp(request);
  const ipHash = hashIp(ip);
  const limit = forecastLimiter.check(ipHash);

  if (!limit.ok) {
    log.warn("forecasts.rate_limited", { ipHash });
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "Too many forecast requests. Please wait a moment." } },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((limit.resetAt - Date.now()) / 1000)),
        },
      }
    );
  }

  // ── Parse and validate body ──────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "Request body must be valid JSON." } },
      { status: 400 }
    );
  }

  if (typeof body !== "object" || body === null || !("ticker" in body)) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "Request body must include a 'ticker' field." } },
      { status: 400 }
    );
  }

  const rawTicker = (body as Record<string, unknown>).ticker;
  if (typeof rawTicker !== "string") {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "'ticker' must be a string." } },
      { status: 400 }
    );
  }

  const ticker = rawTicker.trim().toUpperCase();
  if (!TICKER_RE.test(ticker)) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_TICKER",
          message:
            "Ticker must be 1–15 characters: letters, digits, dot, hyphen, or caret only.",
        },
      },
      { status: 422 }
    );
  }

  log.info("forecasts.create", { ticker });

  // ── Call model service ───────────────────────────────────────────────────────
  try {
    const job = await createJob(ticker);

    log.info("forecasts.created", {
      ticker,
      runId: job.run_id,
      status: job.status,
      ms: Date.now() - start,
    });

    const statusCode = job.status === "done" ? 200 : 202;
    return NextResponse.json(
      { runId: job.run_id, status: job.status },
      { status: statusCode }
    );
  } catch (err) {
    if (err instanceof ModelServiceError) {
      log.error("forecasts.upstream_error", err, { ticker });
      // Pass through 422/400 from the model service as user errors.
      if (err.statusCode === 422 || err.statusCode === 400) {
        return NextResponse.json(
          { error: { code: "INVALID_TICKER", message: err.message } },
          { status: 422 }
        );
      }
      return NextResponse.json(
        {
          error: {
            code: "SERVICE_UNAVAILABLE",
            message: "Forecast service is temporarily unavailable. Please try again.",
          },
        },
        { status: 503 }
      );
    }

    log.error("forecasts.unexpected_error", err, { ticker });
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } },
      { status: 500 }
    );
  }
}
