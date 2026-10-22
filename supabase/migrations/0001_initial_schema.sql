-- Migration 0001: Initial schema for StockVision Pro
-- Creates price_history_cache and forecast_runs tables.
-- RLS is enabled on both tables with no public policies:
-- only the service role (used server-side) can read/write.

-- ─── Enable pgcrypto for gen_random_uuid() ───────────────────────────────────
create extension if not exists "pgcrypto";

-- ─── price_history_cache ─────────────────────────────────────────────────────
-- Stores serialised daily OHLCV payloads from the data provider.
-- Valid for one trading day; the model service checks fetched_on before reusing.

create table if not exists price_history_cache (
  id            bigserial primary key,
  ticker        text        not null,
  exchange      text        not null,
  -- The calendar date on which this data was fetched (UTC date).
  fetched_on    date        not null,
  -- Actual data range present in the payload.
  range_start   date        not null,
  range_end     date        not null,
  -- Number of trading-day rows in the payload.
  row_count     integer     not null check (row_count > 0),
  -- SHA-256 hex digest of the JSON payload, for change detection.
  data_hash     text        not null,
  -- Full OHLCV payload as JSON array; stored as jsonb for efficient access.
  payload       jsonb       not null,
  created_at    timestamptz not null default now(),

  constraint price_history_cache_ticker_date_unique unique (ticker, fetched_on)
);

comment on table price_history_cache is
  'Daily OHLCV cache from Yahoo Finance. One row per ticker per trading day. '
  'Invalidated when fetched_on < today.';

-- ─── forecast_runs ────────────────────────────────────────────────────────────
-- One row per forecast job. Metrics are written once at evaluation completion
-- and never updated thereafter.

create type forecast_status as enum (
  'queued',
  'fetching',
  'training',
  'evaluating',
  'done',
  'failed'
);

create table if not exists forecast_runs (
  id                    uuid        primary key default gen_random_uuid(),
  ticker                text        not null,
  exchange              text        not null,
  -- Native currency from Yahoo Finance (e.g. 'INR', 'USD').
  currency              text        not null,
  status                forecast_status not null default 'queued',
  -- Human-readable stage label shown in loading UI.
  stage                 text,
  -- SHA-256 of the price_history_cache payload used for this run.
  data_hash             text,
  -- git commit hash + hyphen + hyperparameter hash; set at training start.
  model_version         text,

  -- Data range used for training + test combined.
  train_start           date,
  train_end             date,
  test_start            date,
  test_end              date,
  n_test_days           integer     check (n_test_days is null or n_test_days > 0),

  -- Prices in listing currency.
  last_close            numeric(18, 6),
  predicted_close       numeric(18, 6),

  -- 80% prediction interval from walk-forward residuals.
  interval_low          numeric(18, 6),
  interval_high         numeric(18, 6),
  -- Empirical coverage of that interval on the test window (0–1).
  interval_coverage     numeric(6, 4),

  -- Model accuracy on the test window.
  directional_accuracy  numeric(6, 2),  -- percent, 0–100
  mape                  numeric(10, 6), -- percent
  rmse                  numeric(18, 6), -- in listing currency

  -- Naive-baseline accuracy on the same test window.
  baseline_directional  numeric(6, 2),
  baseline_mape         numeric(10, 6),
  baseline_rmse         numeric(18, 6),

  -- Plain-English error shown to the user; null when status != 'failed'.
  error_message         text,

  created_at            timestamptz not null default now(),
  completed_at          timestamptz
);

comment on table forecast_runs is
  'One row per forecast job. Metrics written once at evaluation completion. '
  'Never updated after status = done or failed.';

comment on column forecast_runs.model_version is
  'Concatenation of git commit hash and a hash of the hyperparameter grid used. '
  'Format: <git_sha>-<param_hash>.';

comment on column forecast_runs.interval_coverage is
  'Fraction of test-window actual prices that fell inside [interval_low, interval_high]. '
  'Stored as a decimal (e.g. 0.82 = 82%).';

-- ─── Indexes ──────────────────────────────────────────────────────────────────

-- Fast lookup of in-progress or done runs for a given ticker + trading day.
create index if not exists forecast_runs_ticker_created
  on forecast_runs (ticker, created_at desc);

-- Fast status polling by run id is already covered by the primary key.

-- ─── Row Level Security ───────────────────────────────────────────────────────
-- Enable RLS on both tables.
-- No public policies are created: only the Postgres service role (which bypasses
-- RLS) can read or write. The browser never connects directly to Supabase.

alter table price_history_cache enable row level security;
alter table forecast_runs        enable row level security;

-- Explicitly document that no public access is intended.
-- (No CREATE POLICY statements here means no rows are accessible to
--  any authenticated or anonymous Supabase client role.)
