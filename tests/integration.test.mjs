/**
 * Integration test: search → create forecast → poll to done → assert metrics.
 *
 * Run with:
 *   node --test tests/integration.test.mjs
 *
 * Prerequisites:
 *   1. The Next.js dev server is running on NEXT_APP_URL (default: http://localhost:3000).
 *   2. The model service is running and connected to Supabase.
 *   3. Environment variables are set (NEXT_APP_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).
 *
 * The test uses a well-known liquid NSE ticker (RELIANCE.NS) which has 10+ years
 * of history. It creates a real forecast job and waits up to POLL_TIMEOUT_MS for
 * it to complete before asserting the stored metrics match the API response.
 *
 * This test makes real network calls and takes 30–60 seconds. It is not
 * suitable for CI without those services running.
 */

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const BASE_URL = process.env.NEXT_APP_URL ?? "http://localhost:3000";
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Ticker to use for integration testing. Must have 10+ years of NSE history.
const TEST_TICKER = "RELIANCE.NS";

// Maximum time to wait for the forecast to complete (ms).
const POLL_TIMEOUT_MS = 120_000; // 2 minutes
const POLL_INTERVAL_MS = 3_000;  // poll every 3 seconds

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function apiGet(path) {
  const resp = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
  });
  return { status: resp.status, body: await resp.json() };
}

async function apiPost(path, body) {
  const resp = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: resp.status, body: await resp.json() };
}

async function pollUntilDone(runId, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { status, body } = await apiGet(`/api/forecasts/${runId}`);
    assert.equal(status, 200, `Poll returned non-200: ${JSON.stringify(body)}`);

    if (body.status === "failed") {
      throw new Error(`Forecast failed: ${body.error}`);
    }
    if (body.status === "done") {
      return body;
    }
    // Still in progress — wait and retry.
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error(`Forecast for ${runId} did not complete within ${timeoutMs}ms`);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("StockVision Pro integration", () => {
  let runId;
  let finalJobResponse;
  let supabaseRow;

  // ── Step 1: Search ──────────────────────────────────────────────────────────
  it("search returns at least one result for 'RELIANCE'", async () => {
    const { status, body } = await apiGet("/api/search?q=RELIANCE");
    assert.equal(status, 200, `Expected 200, got ${status}: ${JSON.stringify(body)}`);
    assert.ok(Array.isArray(body), "Response should be an array");
    assert.ok(body.length > 0, "Expected at least one search result");

    // Every result should have required fields.
    for (const item of body) {
      assert.ok(typeof item.symbol === "string", "symbol must be a string");
      assert.ok(typeof item.name === "string", "name must be a string");
      assert.ok(typeof item.exchange === "string", "exchange must be a string");
      assert.ok(typeof item.type === "string", "type must be a string");
    }

    // The test ticker should appear in results (may not be first if query is ambiguous).
    const symbols = body.map((r) => r.symbol);
    assert.ok(
      symbols.includes(TEST_TICKER),
      `Expected ${TEST_TICKER} in results; got: ${symbols.join(", ")}`
    );
  });

  // ── Step 2: Create forecast ─────────────────────────────────────────────────
  it(`creates a forecast job for ${TEST_TICKER}`, async () => {
    const { status, body } = await apiPost("/api/forecasts", { ticker: TEST_TICKER });
    assert.ok(
      status === 200 || status === 202,
      `Expected 200 or 202, got ${status}: ${JSON.stringify(body)}`
    );
    assert.ok(typeof body.runId === "string", "runId must be a string");
    assert.ok(typeof body.status === "string", "status must be a string");

    runId = body.runId;
    console.log(`  Created run ${runId} with status=${body.status}`);
  });

  // ── Step 3: Poll to completion ──────────────────────────────────────────────
  it("forecast completes within the timeout", async () => {
    assert.ok(runId, "runId must be set from previous test");
    finalJobResponse = await pollUntilDone(runId, POLL_TIMEOUT_MS);
    assert.equal(finalJobResponse.status, "done");
    assert.ok(finalJobResponse.result !== null, "result should be non-null when done");

    console.log(`  Run ${runId} completed. Predicted close: ${finalJobResponse.result.predicted_close}`);
  });

  // ── Step 4: Assert result structure ────────────────────────────────────────
  it("result contains all required fields", () => {
    assert.ok(finalJobResponse, "must have a completed job response");
    const r = finalJobResponse.result;

    assert.ok(typeof r.last_close === "number", "last_close must be a number");
    assert.ok(typeof r.predicted_close === "number", "predicted_close must be a number");
    assert.ok(typeof r.interval_low === "number", "interval_low must be a number");
    assert.ok(typeof r.interval_high === "number", "interval_high must be a number");
    assert.ok(typeof r.interval_coverage === "number", "interval_coverage must be a number");
    assert.ok(r.interval_coverage >= 0 && r.interval_coverage <= 1,
      `interval_coverage should be 0–1, got ${r.interval_coverage}`);

    assert.ok(typeof r.metrics.directional_accuracy === "number");
    assert.ok(typeof r.metrics.mape === "number");
    assert.ok(typeof r.metrics.rmse === "number");

    assert.ok(typeof r.baselines.directional === "number");
    assert.ok(typeof r.baselines.mape === "number");
    assert.ok(typeof r.baselines.rmse === "number");

    assert.ok(typeof r.n_test_days === "number" && r.n_test_days > 0,
      `n_test_days must be a positive number, got ${r.n_test_days}`);

    assert.ok(typeof r.data_range.train_start === "string");
    assert.ok(typeof r.data_range.train_end === "string");
    assert.ok(typeof r.test_range.start === "string");
    assert.ok(typeof r.test_range.end === "string");

    // Test dates must all be after train dates (chronological split invariant).
    assert.ok(
      r.test_range.start > r.data_range.train_end,
      `test start (${r.test_range.start}) must be after train end (${r.data_range.train_end})`
    );

    assert.ok(typeof r.currency === "string" && r.currency.length === 3,
      `currency must be a 3-letter code, got ${r.currency}`);
    assert.ok(typeof r.model_version === "string" && r.model_version.length > 0);
  });

  // ── Step 5: Assert API response equals stored DB row ───────────────────────
  it("API response metrics exactly match the stored forecast_runs row", async () => {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      console.warn("  Skipping DB assertion: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set.");
      return;
    }

    assert.ok(runId, "runId must be set");
    assert.ok(finalJobResponse, "must have a completed job response");

    const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await sb
      .from("forecast_runs")
      .select("*")
      .eq("id", runId)
      .single();

    assert.ok(!error, `Supabase query failed: ${error?.message}`);
    assert.ok(data, `No row found for run_id=${runId}`);

    supabaseRow = data;
    const r = finalJobResponse.result;

    // Every metric displayed on screen must equal the stored row.
    // We compare as floats with a small tolerance for serialisation rounding.
    function approxEq(a, b, label) {
      assert.ok(
        Math.abs(Number(a) - Number(b)) < 0.000_001,
        `${label}: API returned ${a}, DB stored ${b}`
      );
    }

    approxEq(r.last_close, data.last_close, "last_close");
    approxEq(r.predicted_close, data.predicted_close, "predicted_close");
    approxEq(r.interval_low, data.interval_low, "interval_low");
    approxEq(r.interval_high, data.interval_high, "interval_high");
    approxEq(r.interval_coverage, data.interval_coverage, "interval_coverage");

    approxEq(r.metrics.directional_accuracy, data.directional_accuracy, "directional_accuracy");
    approxEq(r.metrics.mape, data.mape, "mape");
    approxEq(r.metrics.rmse, data.rmse, "rmse");

    approxEq(r.baselines.directional, data.baseline_directional, "baseline_directional");
    approxEq(r.baselines.mape, data.baseline_mape, "baseline_mape");
    approxEq(r.baselines.rmse, data.baseline_rmse, "baseline_rmse");

    assert.equal(r.n_test_days, data.n_test_days, "n_test_days mismatch");
    assert.equal(r.currency, data.currency, "currency mismatch");
    assert.equal(r.model_version, data.model_version, "model_version mismatch");

    console.log("  All metrics match the stored forecast_runs row. ✓");
  });

  // ── Step 6: Second POST returns existing run (single-flight) ───────────────
  it("a second POST for the same ticker returns the same runId", async () => {
    assert.ok(runId, "runId must be set");
    const { status, body } = await apiPost("/api/forecasts", { ticker: TEST_TICKER });
    assert.ok(status === 200 || status === 202, `Unexpected status: ${status}`);
    assert.equal(body.runId, runId, "Second POST should return the same runId");
  });

  // ── Step 7: Invalid ticker is rejected ─────────────────────────────────────
  it("POST with invalid ticker returns 422", async () => {
    const { status, body } = await apiPost("/api/forecasts", {
      ticker: "INVALID TICKER WITH SPACES",
    });
    assert.equal(status, 422, `Expected 422, got ${status}: ${JSON.stringify(body)}`);
    assert.ok(body.error?.code === "INVALID_TICKER");
  });

  // ── Step 8: Polling a non-existent runId returns 404 ───────────────────────
  it("GET /api/forecasts/:runId with unknown id returns 404", async () => {
    const { status } = await apiGet(
      "/api/forecasts/00000000-0000-0000-0000-000000000000"
    );
    assert.equal(status, 404);
  });

  // ── Step 9: Search with empty query returns empty array ────────────────────
  it("search with empty query returns empty array", async () => {
    const { status, body } = await apiGet("/api/search?q=");
    assert.equal(status, 200);
    assert.ok(Array.isArray(body) && body.length === 0);
  });

  // ── Step 10: Search with over-long query returns 422 ───────────────────────
  it("search with query > 50 chars returns 422", async () => {
    const longQuery = "A".repeat(51);
    const { status } = await apiGet(`/api/search?q=${longQuery}`);
    assert.equal(status, 422);
  });
});
