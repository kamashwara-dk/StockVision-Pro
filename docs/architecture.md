# StockVision Pro — Architecture Notes

## Overview

Three distinct deployment units communicate via HTTP:

```
Browser
  │
  ├─ GET /api/search?q=...          ─→  Next.js API (Vercel)
  ├─ POST /api/forecasts             ─→  Next.js API (Vercel)
  └─ GET /api/forecasts/:runId       ─→  Next.js API (Vercel)
                                              │
                          ┌───────────────────┤
                          │                   │
                    Supabase DB         Model Service
                (postgres + RLS)        (FastAPI on Render/Fly/Railway)
                          │                   │
                          └──────────────────→┘
                           (model service reads cache,
                            writes results)
```

The browser never contacts Supabase or the model service directly.

---

## Components

### 1. Next.js Frontend + API Layer (Vercel)

- **Pages** (`/`, `/forecast/[ticker]`, `/methodology`, `/legal`): Server-rendered React. No Supabase client in the browser.
- **API routes**:
  - `GET /api/search` — validates query, checks in-memory cache, calls model service `/search`, ranks results, returns JSON.
  - `POST /api/forecasts` — validates ticker regex, calls model service `POST /jobs`, returns `{runId, status}`.
  - `GET /api/forecasts/:runId` — calls model service `GET /jobs/:runId`, passes through the response.
- **Rate limiting** — in-memory per IP: 30 search req/min, 5 forecast req/min. Best-effort (per-instance in serverless).
- **Structured logging** — every request logs `{requestId, method, path, status, durationMs}`.

### 2. Model Service (FastAPI, separate host)

- **`/jobs` (POST)** — creates a `forecast_runs` row, launches background pipeline.
- **`/jobs/:run_id` (GET)** — returns current status + result.
- **`/search` (GET)** — proxies Yahoo search, filters exchanges, returns raw results for the Next.js layer to rank.
- **Pipeline stages**: `queued → fetching → training → evaluating → done/failed`.
- All Supabase writes happen here (service role key, no public access).

### 3. Supabase (Postgres)

Two tables, RLS enabled, no public policies:

- `price_history_cache` — daily OHLCV payload, valid for one trading day.
- `forecast_runs` — one row per job; metrics written once at completion.

---

## Data Provider Interface

`provider/base.py` defines `MarketDataProvider` with two methods:
- `search(query)` → `list[SearchResult]`
- `get_history(ticker, years=10)` → `HistoryResult`

`provider/yahoo.py` is the only file that imports `yfinance` or calls Yahoo URLs.

**To swap providers**: subclass `MarketDataProvider` in a new file under `provider/`, implement both methods, update the instantiation in `main.py`. No other file changes required.

---

## Single-Flight Rule

If a `forecast_runs` row already exists for the same ticker on the current trading day (status ∈ {queued, fetching, training, evaluating, done}), the API returns that run's id instead of creating a new one.

---

## Security

- `SUPABASE_SERVICE_ROLE_KEY` is never exposed to the browser or in any response body.
- `MODEL_SERVICE_API_KEY` is a shared secret between the Next.js API and the model service; set as an environment variable on both sides.
- RLS is enabled on both Supabase tables with no public policies (service role bypasses RLS).
- Search queries and hashed IPs are logged for rate limiting; no PII is stored.

---

## Compliance Note

`yfinance` and the Yahoo Finance endpoints it uses are **unofficial**. Yahoo's Terms of Service restrict commercial use. Before deploying to production, evaluate your data usage rights and consider using a licensed provider (e.g., Polygon.io, Alpha Vantage, Bloomberg). The `MarketDataProvider` interface is the single swap point.
