/**
 * proxy.ts — Next.js 16 Proxy (equivalent to Middleware in earlier versions).
 *
 * No auth logic. This service has no user accounts.
 *
 * Currently only sets a request ID header so it flows through to structured
 * logs in each route handler.
 */

import { type NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

export function proxy(request: NextRequest): NextResponse {
  const response = NextResponse.next();
  // Attach a request ID so all log lines for a single request share an ID.
  response.headers.set("x-request-id", randomUUID());
  return response;
}

export const config = {
  matcher: [
    // Skip static assets, images, and Next.js internals.
    "/((?!_next/static|_next/image|favicon|icon|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
