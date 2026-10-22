/**
 * lib/logger.ts — Structured JSON logging for the Next.js API layer.
 *
 * Every request gets a request ID; every log call emits a JSON line to stdout.
 * Stack traces are never included in responses; they go to logs only.
 *
 * Usage:
 *   import { makeLogger } from "@/lib/logger";
 *   const log = makeLogger(requestId);
 *   log.info("search", { q: "RELIANCE", results: 5 });
 *   log.error("forecast", error, { ticker: "RELIANCE.NS" });
 */

import { randomUUID } from "crypto";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface Logger {
  info(event: string, fields?: Record<string, unknown>): void;
  warn(event: string, fields?: Record<string, unknown>): void;
  error(event: string, err: unknown, fields?: Record<string, unknown>): void;
  requestId: string;
}

export function makeLogger(requestId?: string): Logger {
  const rid = requestId ?? randomUUID();
  const logLevel: LogLevel =
    (process.env.LOG_LEVEL?.toLowerCase() as LogLevel | undefined) ?? "info";

  const levels: LogLevel[] = ["debug", "info", "warn", "error"];
  const minLevel = levels.indexOf(logLevel);

  function emit(level: LogLevel, event: string, extra: Record<string, unknown>) {
    if (levels.indexOf(level) < minLevel) return;
    const line: Record<string, unknown> = {
      time: new Date().toISOString(),
      level,
      requestId: rid,
      event,
      ...extra,
    };
    // Always goes to stdout; Vercel captures this automatically.
    process.stdout.write(JSON.stringify(line) + "\n");
  }

  return {
    requestId: rid,
    info(event, fields = {}) {
      emit("info", event, fields);
    },
    warn(event, fields = {}) {
      emit("warn", event, fields);
    },
    error(event, err, fields = {}) {
      emit("error", event, {
        ...fields,
        error:
          err instanceof Error
            ? { message: err.message, name: err.name }
            : String(err),
      });
    },
  };
}

/** Generate a new request ID to attach to each incoming request. */
export function newRequestId(): string {
  return randomUUID();
}
