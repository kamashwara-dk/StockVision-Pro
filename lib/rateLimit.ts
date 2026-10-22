/**
 * lib/rateLimit.ts — In-memory per-IP rate limiter.
 *
 * Uses a sliding window counter keyed by hashed IP.
 * Best-effort in serverless: resets on every cold start / new instance.
 * This is documented in the README.
 *
 * Usage:
 *   const limiter = createLimiter({ windowMs: 60_000, max: 30 });
 *   const result = limiter.check(hashedIp);
 *   if (!result.ok) return Response.json(..., { status: 429 });
 */

import { createHash } from "crypto";

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number; // Unix ms
}

interface WindowEntry {
  count: number;
  windowStart: number;
}

export function createLimiter(opts: { windowMs: number; max: number }) {
  const store = new Map<string, WindowEntry>();

  // Periodically clean up expired entries to prevent unbounded memory growth.
  // In serverless this interval may never fire; that is acceptable.
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now - entry.windowStart > opts.windowMs) {
        store.delete(key);
      }
    }
  }, opts.windowMs * 2);
  // Don't hold the process open in test environments.
  if (cleanup.unref) cleanup.unref();

  return {
    check(key: string): RateLimitResult {
      const now = Date.now();
      const entry = store.get(key);

      if (!entry || now - entry.windowStart > opts.windowMs) {
        // New window.
        store.set(key, { count: 1, windowStart: now });
        return { ok: true, remaining: opts.max - 1, resetAt: now + opts.windowMs };
      }

      if (entry.count >= opts.max) {
        return {
          ok: false,
          remaining: 0,
          resetAt: entry.windowStart + opts.windowMs,
        };
      }

      entry.count += 1;
      return {
        ok: true,
        remaining: opts.max - entry.count,
        resetAt: entry.windowStart + opts.windowMs,
      };
    },
  };
}

/**
 * Hash an IP address so it is never stored or logged in plain text.
 * Uses SHA-256 truncated to 16 hex chars (64-bit prefix).
 */
export function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

/**
 * Extract the client IP from a NextRequest, respecting common proxy headers.
 * Falls back to "unknown" if no IP can be determined.
 */
export function getClientIp(request: Request): string {
  const forwarded = (request.headers as Headers).get("x-forwarded-for");
  if (forwarded) {
    // x-forwarded-for can be a comma-separated list; take the first entry.
    return forwarded.split(",")[0].trim();
  }
  const real = (request.headers as Headers).get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}
