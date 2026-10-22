/**
 * Integration test: search → create forecast → poll to done → assert metrics.
 *
 * Run:
 *   node --test tests/integration.test.mjs
 *
 * Prerequisites:
 *   1. Next.js dev server running at NEXT_APP_URL (default: http://localhost:3000).
 *   2. Model service running and connected to Supabase.
 *   3. Environment variables set: NEXT_APP_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 *
 * The test uses RELIANCE.NS (10+ years of NSE history).
 * It makes real network calls and takes 30–90 seconds.
 */

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const BASE_URL  = process.env.NEXT_APP_URL ?? "http://localhost:3000";
const SB_URL    = process.env.SUPABASE_URL;
const SB_KEY    = process.env.SUPABASE_SERVICE_ROLE_KEY;

const TEST_TICKER   = "RELIANCE.NS";
const POLL_TIMEOUT  = 120_000;  // 2 minutes
const POLL_INTERVAL = 4_000;

// ─── helpers ──────────────────────────────────────────────────────────────────

async function apiGet(path) {
  const r = await fetch(`${BASE_URL}${path}`);
  return { status: r.status, body: await r.json() };
}

async function apiPost(path, body) {
  const r = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: r.status, body: await r.json() };
}

async function pollForecastDone(runId) {
  const deadline = Date.now() + POLL_TIMEOUT;
  while (Date.now() < deadline) {
    const { status, body } = await apiGet(`/api/forecasts/${runId}`);
    assert.equal(status, 200, `Poll status ${status}: ${JSON.stringify(body)}`);
    if (body.status === "failed") throw new Error(`Forecast failed: ${body.error}`);
    if (body.status === "done") return body;
    await new Promise(r => setTimeout(r, POLL_INTERVAL));
  }
  throw new Error(`Forecast ${runId} did not complete within ${POLL_TIMEOUT}ms`);
}

// ─── test state ───────────────────────────────────────────────────────────────

let runId;
let finalJob;

// ─── tests ────────────────────────────────────────────────────────────────────

describe("Integration: search → forecast → DB assertion", () => {

  // 1. Quote endpoint returns price data
  it("GET /api/quote returns price for RELIANCE.NS", async () => {
    const { status, body } = await apiGet(`/api/quote?ticker=${TEST_TICKER}`);
    assert.equal(status, 200, `Quote returned ${status}: ${JSON.stringify(body)}`);
    assert.ok(typeof body.price === "number" && body.price > 0, "price must be a positive number");
    assert.ok(typeof body.currency === "string", "currency must be a string");
    assert.ok(typeof body.delay_minutes === "number", "delay_minutes must be present");
    assert.equal(body.delay_minutes, 15, "delay must be 15 minutes (Yahoo delayed data)");
  });

  // 2. Search returns results
  it("GET /api/search?q=RELIANCE returns at least one result", async () => {
    const { status, body } = await apiGet("/api/search?q=RELIANCE");
    assert.equal(status, 200, `Search status ${status}: ${JSON.stringify(body)}`);
    assert.ok(Array.isArray(body) && body.length > 0, "Expected search results");
    const syms = body.map(r => r.symbol);
    assert.ok(syms.includes(TEST_TICKER), `Expected ${TEST_TICKER} in [${syms.join(", ")}]`);
    for (const item of body) {
      assert.ok(typeof item.symbol   === "string");
      assert.ok(typeof item.name     === "string");
      assert.ok(typeof item.exchange === "string");
      assert.ok(typeof item.type     === "string");
    }
  });

  // 3. Create forecast job
  it("POST /api/forecasts creates a job for RELIANCE.NS", async () => {
    const { status, body } = await apiPost("/api/forecasts", { ticker: TEST_TICKER });
    assert.ok(status === 200 || status === 202, `Expected 200/202, got ${status}`);
    assert.ok(typeof body.runId === "string" && body.runId.length > 0, "runId must be present");
    assert.ok(typeof body.status === "string", "status must be present");
    runId = body.runId;
    console.log(`  Created run ${runId} (status=${body.status})`);
  });

  // 4. Poll to completion
  it("Forecast completes within timeout", async () => {
    assert.ok(runId, "runId must be set");
    finalJob = await pollForecastDone(runId);
    assert.equal(finalJob.status, "done");
    assert.ok(finalJob.result !== null, "result must be non-null when done");
    console.log(`  Run ${runId} done. predicted_close=${finalJob.result.predicted_close}`);
  });

  // 5. Result structure
  it("Result contains all required fields with valid types", () => {
    const r = finalJob.result;
    assert.ok(typeof r.last_close      === "number");
    assert.ok(typeof r.predicted_close === "number");
    assert.ok(typeof r.interval_low    === "number");
    assert.ok(typeof r.interval_high   === "number");
    assert.ok(typeof r.interval_coverage === "number");
    assert.ok(r.interval_coverage >= 0 && r.interval_coverage <= 1,
      `interval_coverage out of range: ${r.interval_coverage}`);
    assert.ok(typeof r.metrics.directional_accuracy === "number");
    assert.ok(typeof r.metrics.mape    === "number");
    assert.ok(typeof r.metrics.rmse    === "number");
    assert.ok(typeof r.baselines.directional === "number");
    assert.ok(typeof r.baselines.mape  === "number");
    assert.ok(typeof r.baselines.rmse  === "number");
    assert.ok(typeof r.n_test_days     === "number" && r.n_test_days > 0);
    assert.ok(typeof r.currency        === "string"  && r.currency.length === 3);
    assert.ok(typeof r.model_version   === "string"  && r.model_version.length > 0);
    // Chronological split: test window starts after training window ends
    assert.ok(r.test_range.start > r.data_range.train_end,
      `test_start (${r.test_range.start}) must be after train_end (${r.data_range.train_end})`);
  });

  // 6. DB row matches API response (every figure on screen = stored row)
  it("API response metrics exactly match the forecast_runs DB row", async () => {
    if (!SB_URL || !SB_KEY) {
      console.warn("  Skipping DB assertion: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set");
      return;
    }
    const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await sb.from("forecast_runs").select("*").eq("id", runId).single();
    assert.ok(!error, `Supabase error: ${error?.message}`);
    assert.ok(data, `No row found for run_id=${runId}`);

    const r = finalJob.result;
    const close_enough = (a, b, label) => {
      const diff = Math.abs(Number(a) - Number(b));
      assert.ok(diff < 0.000_001, `${label}: API=${a}, DB=${b}, diff=${diff}`);
    };

    close_enough(r.last_close,             data.last_close,             "last_close");
    close_enough(r.predicted_close,        data.predicted_close,        "predicted_close");
    close_enough(r.interval_low,           data.interval_low,           "interval_low");
    close_enough(r.interval_high,          data.interval_high,          "interval_high");
    close_enough(r.interval_coverage,      data.interval_coverage,      "interval_coverage");
    close_enough(r.metrics.directional_accuracy, data.directional_accuracy, "directional_accuracy");
    close_enough(r.metrics.mape,           data.mape,                   "mape");
    close_enough(r.metrics.rmse,           data.rmse,                   "rmse");
    close_enough(r.baselines.directional,  data.baseline_directional,   "baseline_directional");
    close_enough(r.baselines.mape,         data.baseline_mape,          "baseline_mape");
    close_enough(r.baselines.rmse,         data.baseline_rmse,          "baseline_rmse");
    assert.equal(r.n_test_days,   data.n_test_days,   "n_test_days");
    assert.equal(r.currency,      data.currency,      "currency");
    assert.equal(r.model_version, data.model_version, "model_version");

    console.log("  All metrics match the stored forecast_runs row. ✓");
  });

  // 7. /api/predict returns backward-compatible shape
  it("POST /api/predict returns legacy shape with real metrics", async () => {
    const { status, body } = await apiPost("/api/predict", { ticker: TEST_TICKER });
    // 200 or 202 (if job was already done, 200; new run in progress, 202)
    assert.ok(status === 200 || status === 202, `Expected 200/202, got ${status}`);
    if (status === 200) {
      assert.ok(typeof body.current_price    === "number");
      assert.ok(typeof body.target_price     === "number");
      assert.ok(typeof body.confidence       === "number");
      assert.ok(typeof body.currency         === "string");
      assert.ok(Array.isArray(body.key_factors));
      assert.ok(body.key_factors.length >= 1);
      // Metrics must be real numbers, not hardcoded
      assert.ok(typeof body.metrics?.directional_accuracy === "number");
      assert.ok(typeof body.metrics?.rmse === "number");
      assert.ok(typeof body.metrics?.mape === "number");
      // confidence must equal rounded directional_accuracy
      assert.equal(body.confidence, Math.round(body.metrics.directional_accuracy),
        "confidence field must equal rounded directional_accuracy");
    }
  });

  // 8. Second POST /api/forecasts returns same runId (single-flight)
  it("Second POST for same ticker returns the same runId", async () => {
    assert.ok(runId, "runId must be set");
    const { status, body } = await apiPost("/api/forecasts", { ticker: TEST_TICKER });
    assert.ok(status === 200 || status === 202);
    assert.equal(body.runId, runId, "Second POST must return the same runId");
  });

  // 9. Invalid ticker rejected
  it("POST /api/forecasts with invalid ticker returns 422", async () => {
    const { status, body } = await apiPost("/api/forecasts", { ticker: "INVALID SPACES" });
    assert.equal(status, 422);
    assert.ok(body.error?.code === "INVALID_TICKER" || typeof body.error === "string");
  });

  // 10. Unknown runId returns 404
  it("GET /api/forecasts/:runId with unknown id returns 404", async () => {
    const { status } = await apiGet("/api/forecasts/00000000-0000-0000-0000-000000000000");
    assert.equal(status, 404);
  });

  // 11. Search returns empty array for empty query
  it("GET /api/search?q= returns empty array", async () => {
    const { status, body } = await apiGet("/api/search?q=");
    assert.equal(status, 200);
    assert.ok(Array.isArray(body) && body.length === 0);
  });

  // 12. Quote for non-existent ticker returns 404
  it("GET /api/quote?ticker=FAKEFAKEFAKE returns 404", async () => {
    const { status } = await apiGet("/api/quote?ticker=FAKEFAKEFAKE");
    // May be 404 or 502 depending on whether Yahoo recognises it at all.
    assert.ok(status === 404 || status === 502, `Expected 404 or 502, got ${status}`);
  });
});
