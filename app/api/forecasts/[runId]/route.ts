/**
 * GET /api/forecasts/:runId
 *
 * Polls the status and results of a forecast job.
 *
 * Returns:
 *   { runId, status, stage, error, result }
 *   result is null while the job is in progress, populated when status='done'.
 *
 * Errors:
 *   404 if runId is not found.
 *   503 if the model service is unavailable.
 */

import { type NextRequest, NextResponse } from "next/server";
import { getJob, ModelServiceError } from "@/lib/modelClient";
import { makeLogger } from "@/lib/logger";

// params is a Promise in Next.js 16 (async route context).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
): Promise<NextResponse> {
  const log = makeLogger();
  const start = Date.now();

  const { runId } = await params;

  // Basic format check: UUIDs are 36 chars.
  if (!runId || runId.length > 64 || !/^[a-zA-Z0-9\-_]+$/.test(runId)) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "Invalid run ID format." } },
      { status: 400 }
    );
  }

  log.info("forecasts.poll", { runId });

  try {
    const job = await getJob(runId);

    log.info("forecasts.polled", {
      runId,
      status: job.status,
      ms: Date.now() - start,
    });

    return NextResponse.json({
      runId: job.run_id,
      status: job.status,
      stage: job.stage ?? null,
      error: job.error ?? null,
      result: job.result ?? null,
    });
  } catch (err) {
    if (err instanceof ModelServiceError) {
      if (err.statusCode === 404) {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: "Forecast run not found." } },
          { status: 404 }
        );
      }
      log.error("forecasts.upstream_error", err, { runId });
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

    log.error("forecasts.unexpected_error", err, { runId });
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } },
      { status: 500 }
    );
  }
}
