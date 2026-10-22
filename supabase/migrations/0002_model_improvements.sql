-- Migration 0002: Model improvements
--
-- 1. Add val_start, val_end, chosen_model to forecast_runs.
-- 2. Create model_benchmarks table.
-- 3. No tables dropped; no data deleted.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── forecast_runs: add validation window columns ──────────────────────────────
alter table forecast_runs
  add column if not exists val_start      date,
  add column if not exists val_end        date,
  add column if not exists chosen_model   text;   -- e.g. 'hgb', 'ridge', 'ensemble', 'naive'

comment on column forecast_runs.val_start is
  'First date of the validation window (the middle 10% of rows, chronologically).';
comment on column forecast_runs.val_end is
  'Last date of the validation window.';
comment on column forecast_runs.chosen_model is
  'The candidate model selected by validation-window RMSE. '
  'One of: hgb, ridge, rf, ensemble, naive.';

-- ── model_benchmarks ─────────────────────────────────────────────────────────
-- Written by the benchmark harness (benchmark/run_benchmark.py).
-- One row per ticker per benchmark run.

create table if not exists model_benchmarks (
  id                    bigserial   primary key,
  run_at                timestamptz not null default now(),
  model_version         text        not null,
  ticker                text        not null,
  exchange              text        not null,
  n_test_days           integer     not null,
  -- New model metrics on the test window.
  model_directional     numeric(6, 2),
  model_mape            numeric(10, 6),
  model_rmse            numeric(18, 6),
  -- Naive baseline on the same test window.
  naive_mape            numeric(10, 6),
  naive_rmse            numeric(18, 6),
  -- Majority-direction baseline on the same test window.
  baseline_directional  numeric(6, 2),
  -- Which candidate was selected.
  chosen_model          text,
  -- Currency for RMSE interpretation.
  currency              text        not null default 'USD'
);

comment on table model_benchmarks is
  'Results from the benchmark harness over a fixed 20-ticker universe. '
  'Used to verify model improvements are real on out-of-sample data.';

-- Index: look up all rows for a given run.
create index if not exists model_benchmarks_run_at
  on model_benchmarks (run_at desc);

-- RLS: same as other tables — service role only.
alter table model_benchmarks enable row level security;
