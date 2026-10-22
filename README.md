# StockVision Pro

Next-day closing price forecasts for NSE, BSE, NYSE and NASDAQ equities and ETFs, with accuracy measured on held-out data.

---

## Architecture overview

Three deployment units:

```
Browser → Next.js API layer (Vercel)
              ↓
         Model Service (Render / Fly / Railway)
              ↓
         Supabase (Postgres)
```

- **Next.js** serves all pages and the `/api/*` routes. No Supabase client runs in the browser. No Supabase key is ever sent to the client.
- **Model service** (`model-service/`) is a FastAPI app. It fetches price data, runs the ML pipeline, and writes results to Supabase using the service role key.
- **Supabase** stores `price_history_cache` and `forecast_runs`. RLS is enabled on both tables with no public policies.

Full architecture notes: [`docs/architecture.md`](docs/architecture.md).

---

## Environment variables

### Next.js (`/.env.local` or Vercel environment settings)

| Variable | Required | Description |
|---|---|---|
| `SUPABASE_URL` | Yes | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key — **never expose to the browser** |
| `MODEL_SERVICE_URL` | Yes | URL of the running model service, e.g. `https://your-app.onrender.com` |
| `MODEL_SERVICE_API_KEY` | Yes (prod) | Shared secret sent as `Bearer` token to the model service |
| `NEXT_PUBLIC_APP_URL` | Yes | Canonical URL used in OG tags and CORS, e.g. `https://stockvision-pro.vercel.app` |
| `LOG_LEVEL` | No | `debug` / `info` / `warn` / `error`. Default: `info` |

Copy `.env.example` to `.env.local` and fill in real values. Never commit `.env.local`.

### Model service (`model-service/.env` or host environment settings)

| Variable | Required | Description |
|---|---|---|
| `SUPABASE_URL` | Yes | Same Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key |
| `MODEL_SERVICE_API_KEY` | Yes (prod) | Must match the value set in the Next.js environment |
| `LOG_LEVEL` | No | Default: `INFO` |
| `ALLOWED_ORIGINS` | No | Comma-separated CORS origins. Default: `*` (restrict in production) |

See `model-service/.env.example` for a documented template.

---

## Running database migrations

Migrations live in `supabase/migrations/`. Apply them with the [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
# Install the CLI (once)
npm install -g supabase

# Link to your project (once per machine)
supabase login
supabase link --project-ref <your-project-ref>

# Apply all pending migrations
supabase db push
```

Or apply manually in the Supabase SQL editor by pasting the contents of each `.sql` file in numerical order.

---

## Local development

### Prerequisites

- Node.js 20+
- Python 3.11+ with pip
- A Supabase project (free tier is sufficient)

### 1. Next.js frontend

```bash
# Install dependencies
npm install

# Copy environment template and fill in values
cp .env.example .env.local

# Start dev server (port 3000)
npm run dev
```

### 2. Model service

```bash
cd model-service

# Create a virtual environment
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS / Linux

# Install dependencies (pinned versions)
pip install -r requirements.txt

# Copy environment template and fill in values
cp .env.example .env

# Start the FastAPI server (port 8000)
uvicorn main:app --reload --port 8000
```

Set `MODEL_SERVICE_URL=http://localhost:8000` in your Next.js `.env.local` to connect locally.

---

## Running tests

### Python unit tests (model service)

```bash
cd model-service
pytest tests/ -v
```

All tests are pure-unit — no network calls, no Supabase connection required.

### Integration test (requires both services running)

```bash
# With npm run dev and uvicorn both running:
node --test tests/integration.test.mjs
```

Set `NEXT_APP_URL`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` in your environment before running. The test creates a real forecast job for `RELIANCE.NS` and asserts the API response matches the stored database row.

---

## Deployment

### Vercel (Next.js)

1. Push to GitHub and import the repo in the Vercel dashboard.
2. Set all Next.js environment variables in **Settings → Environment Variables**.
   - Mark `SUPABASE_SERVICE_ROLE_KEY` and `MODEL_SERVICE_API_KEY` as **Sensitive**.
   - `NEXT_PUBLIC_APP_URL` must be set to the final Vercel URL.
3. Deploy. The `vercel.json` at the repo root configures the region and function timeouts.

### Model service (Render, Fly.io, or Railway)

The model service is a standard FastAPI/uvicorn app. It does not run on Vercel because ML training exceeds the 60-second serverless function limit.

**Render (recommended for simplicity)**

1. Create a new **Web Service** in Render.
2. Set the root directory to `model-service/`.
3. Build command: `pip install -r requirements.txt`
4. Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Set all model service environment variables in Render's dashboard.
6. Copy the service URL into the Next.js `MODEL_SERVICE_URL` variable.

**Fly.io**

```bash
cd model-service
fly launch --name stockvision-model --no-deploy
fly secrets set SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... MODEL_SERVICE_API_KEY=...
fly deploy
```

**Railway**

Use the Railway UI or CLI. Point the root directory at `model-service/`. Set environment variables in the Railway dashboard.

---

## Data provider — compliance warning

> **The yfinance library wraps unofficial Yahoo Finance endpoints. Yahoo's Terms of Service restrict commercial use of their data. Before deploying this service commercially, obtain a licensed data feed and implement a new provider.**

To swap the data provider without touching any other code:

1. Create a new file in `model-service/provider/`, e.g. `polygon.py`.
2. Subclass `MarketDataProvider` from `provider/base.py` and implement `search()` and `get_history()`.
3. In `model-service/main.py`, replace the line `_provider = YahooProvider()` with `_provider = YourNewProvider()`.
4. Remove `yfinance` from `requirements.txt` and add your new library.

No other files need to change.

---

## Project structure

```
stockvision-pro/
├── app/                        # Next.js App Router pages and API routes
│   ├── api/
│   │   ├── search/route.ts     # GET /api/search
│   │   ├── forecasts/route.ts  # POST /api/forecasts
│   │   └── forecasts/[runId]/  # GET /api/forecasts/:runId
│   ├── forecast/[ticker]/      # Forecast page
│   ├── methodology/            # Methodology page
│   ├── legal/                  # Legal page
│   ├── layout.tsx              # Root layout
│   ├── page.tsx                # Home page
│   ├── sitemap.ts
│   └── robots.ts
├── components/
│   ├── layout/                 # SiteNav, SiteFooter, SkipLink
│   ├── search/                 # SearchCombobox (ARIA combobox)
│   └── forecast/               # ForecastResult, ForecastChart, MetricsPanel, LoadingStatus
├── lib/                        # Shared utilities
│   ├── modelClient.ts          # HTTP client for model service
│   ├── ranking.ts              # Search result ranking (Damerau-Levenshtein)
│   ├── searchCache.ts          # 60-second in-memory search cache
│   ├── rateLimit.ts            # Per-IP sliding window rate limiter
│   ├── logger.ts               # Structured JSON logging
│   ├── supabaseAdmin.ts        # Server-only Supabase admin client
│   └── types.ts                # Shared TypeScript types
├── model-service/              # FastAPI ML service (deploy separately)
│   ├── provider/               # Data provider interface + Yahoo implementation
│   ├── pipeline/               # Validation, features, training, metrics
│   ├── main.py                 # FastAPI app
│   ├── db.py                   # Supabase writes
│   ├── requirements.txt
│   └── tests/                  # Python unit tests
├── supabase/
│   └── migrations/
│       └── 0001_initial_schema.sql
├── tests/
│   └── integration.test.mjs    # Node.js integration test
├── docs/
│   ├── architecture.md
│   └── methodology.md
├── proxy.ts                    # Next.js 16 proxy (request ID header only)
├── .env.example
└── vercel.json
```
