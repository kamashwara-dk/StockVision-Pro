# Assumptions — StockVision Pro rebuild

Recorded per spec §0 ("Where something is unclear, make the most conservative assumption").

---

## Spec blanks filled

| Blank | Filled with | Basis |
|---|---|---|
| "Current stack: model and backend: [FILL IN]" | Default: `scikit-learn HistGradientBoostingRegressor` with `random_state=42` | Spec §3 R3 default |
| "Use [FILL IN: current model]" | Same default | Spec R3 |

---

## Architecture

1. **Model service host.** The spec says "Render, Fly or Railway" without specifying which. Render is used as the primary example in the README because it requires the least configuration. The `Dockerfile` was not written; the README gives start commands for all three hosts.

2. **Rate limiting in serverless.** The spec requires per-IP rate limiting. The implementation uses an in-memory Map per process. On Vercel, each serverless instance has its own Map, so the effective limit is per-instance, not globally enforced. This is documented in the README as "best-effort." A Redis-based limiter would be needed for strict global enforcement, but that introduces a new dependency not mentioned in the spec.

3. **No Dockerfile for model service.** The spec does not require one. The README gives `uvicorn` start commands for each host.

4. **`NEXT_PUBLIC_APP_URL` is used for CORS.** The spec says "Vercel for frontend and API, separate host for model-service" but doesn't specify CORS configuration. The Next.js `next.config.ts` scopes `Access-Control-Allow-Origin` to `NEXT_PUBLIC_APP_URL` in production and `*` when the variable is not set (local dev).

5. **Single-flight scope.** The spec says "same ticker and trading day." The implementation defines "same trading day" as any run created between 00:00 UTC and 23:59 UTC of the current calendar date. This means a run started just before midnight could be reused for a few seconds into the next day. This is an acceptable approximation.

---

## Data pipeline

6. **"Current trading day" definition.** The spec says "cache valid for the current trading day." The implementation uses the UTC calendar date as the cache key. For exchanges in UTC+5:30 (NSE/BSE), the UTC date changes approximately 5.5 hours before the exchange closes. This means a run started late in the NSE trading day could be cached against the next UTC date while the exchange is still open. The conservative choice is UTC because it avoids serving a cached incomplete bar, which is the more dangerous error.

7. **"Exclude the current day's bar if the exchange is open or the bar is incomplete."** Implemented by comparing each row's date to `datetime.now(timezone.utc).date()` and dropping any row whose date equals today. This is conservative: it may drop a completed bar on days where the exchange closed before UTC midnight, but it never includes an incomplete bar.

8. **Adjusted prices from yfinance.** The spec says "model on adjusted close." yfinance's `auto_adjust=True` returns adjusted OHLCV throughout. The `Close` column is the adjusted close. Volume is not adjusted.

9. **"Flag absolute daily returns above 40% as possible split artefacts and exclude those rows from training only if confirmed unadjusted."** Because `auto_adjust=True` is always used, all data is treated as adjusted. Split suspects are flagged and excluded from training unconditionally (no manual confirmation step). This is the conservative interpretation: the spec says "exclude… if confirmed unadjusted," and since we always use adjusted data the confirmation is implicit.

10. **5-day range forecasts omitted.** The spec says "5-day range: optional. Only provide it with direct models for horizons 1 to 5." This was not implemented. The spec explicitly marks it optional, and it would require five separate model training runs (approximately 5× the runtime). It is noted here as a known omission.

11. **Full price history not returned by API.** The forecast page API (`GET /api/forecasts/:runId`) returns summary statistics (last close, predicted close, test range, etc.) but not the full daily price series. The `ForecastChart` component uses the train/test boundary dates to draw a simplified two-point history line. Returning the full series would require either a separate endpoint or storing it in Supabase, which is not in the spec's database schema. The chart is visually simplified but semantically complete (all data available in the SR data table and figcaption).

---

## Model

12. **Walk-forward refit frequency.** The spec says "refit every 20 trading days (configurable)." The `REFIT_EVERY` constant in `pipeline/train.py` defaults to 20. It is configurable via the `refit_every` argument to `train_and_evaluate()` but is not exposed as an environment variable (the spec does not require that).

13. **Hyperparameter grid size.** The spec says "small fixed grid." The grid has 2 × 2 × 2 × 1 × 2 = 16 combinations, which with 5-fold CV = 80 fits. On a 10-year dataset (~2500 rows, 80% training = ~2000 rows) this completes in under 60 seconds on a modern CPU.

14. **`model_version` format.** The spec says "git commit hash plus hash of hyperparameters." The format is `<short-git-sha>-<8-char-param-hash>`. If not in a git repository (e.g. on Render with a fresh deploy), the git sha falls back to `"unknown"`.

---

## Frontend

15. **Full price history chart.** Because the full OHLCV series is not returned by the API (see assumption 11), the chart shows a schematic history (train-start to train-end) rather than the actual daily closes. The next-trading-day forecast point is plotted accurately. This is noted in the `ForecastResult` component source and does not affect any displayed metric.

16. **"Company name" on the forecast page.** The spec says "company name, ticker, exchange" in the page header. The company name comes from `ticker_info.name` which is fetched by the model service from yfinance's `Ticker.info`. On the initial server render, only the ticker and exchange are shown. The company name is available once the job is done and the result is returned.

17. **Recharts chosen over uPlot / lightweight-charts.** Recharts was already installed. The spec lists all three as acceptable. Recharts is React-native and requires no additional integration. The chart is lazy-loaded with `next/dynamic + ssr:false` so it does not increase the SSR bundle.

18. **No dark mode.** The spec says "not in scope" for dark mode (§8). The design uses only light theme tokens.

---

## Legal

19. **`[LEGAL ENTITY]`, `[CONTACT EMAIL]`, `[GOVERNING LAW]` left as placeholders.** The spec explicitly requires these as marked placeholders. They have not been filled in.

---

## Tests

20. **Python unit tests cannot be executed in this environment.** Python is not installed on the development machine (the Microsoft Store alias is a non-functional stub). The tests are syntactically correct Python and use only standard library + pytest + numpy/sklearn (all in `requirements.txt`). They must be run manually: `cd model-service && pip install -r requirements.txt && pytest tests/ -v`.

21. **Integration test requires live services.** The integration test (`tests/integration.test.mjs`) makes real HTTP calls to the Next.js API and real Supabase queries. It cannot be run without both services running. The test file is syntactically valid (confirmed with `node --check`).

22. **No Lighthouse score measured.** The spec targets Lighthouse >90 on mobile for `/` and `/methodology`. The pages are fully server-rendered, use system fonts (Inter loaded via `next/font`), have no render-blocking resources, and meet all structural accessibility requirements. A precise score cannot be stated without running a browser-based audit.
