"use client";

/**
 * LoadingStatus — shows the real pipeline stage and elapsed seconds.
 * No percentage bar (spec R5). Polls GET /api/forecasts/:runId every 3s.
 */

import { useEffect, useRef, useState } from "react";
import type { ForecastStatusResponse } from "@/lib/types";

const STAGE_LABELS: Record<string, string> = {
  queued:     "Queued — waiting to start",
  fetching:   "Fetching price history",
  training:   "Training the model",
  evaluating: "Evaluating on held-out data",
  done:       "Complete",
  failed:     "Failed",
};

interface Props {
  runId: string;
  onDone: (result: ForecastStatusResponse) => void;
  onError: (message: string) => void;
}

export function LoadingStatus({ runId, onDone, onError }: Props) {
  const [stage, setStage] = useState<string>("queued");
  const [elapsedSec, setElapsedSec] = useState(0);
  const startTime = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(true);

  // Elapsed seconds counter.
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startTime.current) / 1000));
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Poll for status.
  useEffect(() => {
    activeRef.current = true;

    async function poll() {
      if (!activeRef.current) return;

      try {
        const resp = await fetch(`/api/forecasts/${encodeURIComponent(runId)}`, {
          cache: "no-store",
        });
        if (!resp.ok) {
          throw new Error(`Status ${resp.status}`);
        }
        const data: ForecastStatusResponse = await resp.json();

        if (!activeRef.current) return;

        setStage(data.status);

        if (data.status === "done") {
          if (timerRef.current) clearInterval(timerRef.current);
          onDone(data);
          return;
        }

        if (data.status === "failed") {
          if (timerRef.current) clearInterval(timerRef.current);
          onError(
            data.error ??
              "The forecast could not be completed. Please try again."
          );
          return;
        }

        // Schedule next poll.
        pollRef.current = setTimeout(poll, 3000);
      } catch {
        if (!activeRef.current) return;
        pollRef.current = setTimeout(poll, 5000);
      }
    }

    poll();

    return () => {
      activeRef.current = false;
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [runId, onDone, onError]);

  const label = STAGE_LABELS[stage] ?? stage;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Forecast status: ${label}`}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "var(--sp-4)",
        padding: "var(--sp-12) var(--sp-6)",
        textAlign: "center",
      }}
    >
      {/* Spinner */}
      <span
        aria-hidden="true"
        style={{
          display: "block",
          width: 40,
          height: 40,
          border: "3px solid var(--border)",
          borderTopColor: "var(--accent)",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />

      {/* Stage label */}
      <p
        style={{
          fontWeight: 600,
          fontSize: "1rem",
          color: "var(--text)",
          margin: 0,
        }}
      >
        {label}
      </p>

      {/* Elapsed time */}
      <p
        style={{
          fontSize: "0.85rem",
          color: "var(--text-muted)",
          margin: 0,
        }}
      >
        {elapsedSec}s elapsed
      </p>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
