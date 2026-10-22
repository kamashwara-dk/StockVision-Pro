"""
db.py — Supabase database access for the model service.

Only this file touches Supabase. Uses the service role key from
environment variables. The browser never sees any Supabase key.
"""

from __future__ import annotations

import json
import logging
import os
from datetime import date, datetime, timezone
from typing import Any

from supabase import Client, create_client

log = logging.getLogger(__name__)

_client: Client | None = None


def _get_client() -> Client:
    global _client
    if _client is None:
        url = os.environ["SUPABASE_URL"]
        key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
        _client = create_client(url, key)
    return _client


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ─── price_history_cache ──────────────────────────────────────────────────────

def get_cached_history(ticker: str, trading_day: date) -> dict | None:
    client = _get_client()
    result = (
        client.table("price_history_cache")
        .select("*")
        .eq("ticker", ticker)
        .eq("fetched_on", trading_day.isoformat())
        .limit(1)
        .execute()
    )
    rows = result.data
    if rows:
        log.info("cache HIT ticker=%s date=%s", ticker, trading_day)
        return rows[0]
    log.info("cache MISS ticker=%s date=%s", ticker, trading_day)
    return None


def upsert_history_cache(
    ticker: str,
    exchange: str,
    trading_day: date,
    range_start: date,
    range_end: date,
    row_count: int,
    data_hash: str,
    payload: list[dict],
) -> None:
    client = _get_client()
    client.table("price_history_cache").upsert(
        {
            "ticker": ticker,
            "exchange": exchange,
            "fetched_on": trading_day.isoformat(),
            "range_start": range_start.isoformat(),
            "range_end": range_end.isoformat(),
            "row_count": row_count,
            "data_hash": data_hash,
            "payload": json.dumps(payload),
        },
        on_conflict="ticker,fetched_on",
        ignore_duplicates=True,
    ).execute()
    log.info("upsert_history_cache: ticker=%s rows=%d", ticker, row_count)


# ─── forecast_runs ────────────────────────────────────────────────────────────

def create_run(ticker: str, exchange: str, currency: str) -> str:
    client = _get_client()
    result = (
        client.table("forecast_runs")
        .insert({
            "ticker": ticker,
            "exchange": exchange,
            "currency": currency,
            "status": "queued",
            "stage": "queued",
        })
        .execute()
    )
    run_id: str = result.data[0]["id"]
    log.info("create_run: run_id=%s ticker=%s", run_id, ticker)
    return run_id


def update_run_status(run_id: str, status: str, stage: str) -> None:
    _get_client().table("forecast_runs").update(
        {"status": status, "stage": stage}
    ).eq("id", run_id).execute()


def fail_run(run_id: str, error_message: str) -> None:
    _get_client().table("forecast_runs").update({
        "status": "failed",
        "stage": "failed",
        "error_message": error_message,
        "completed_at": _now(),
    }).eq("id", run_id).execute()
    log.warning("fail_run: run_id=%s error=%s", run_id, error_message)


def complete_run(run_id: str, payload: dict[str, Any]) -> None:
    """
    Write all result fields and set status='done'.
    Metrics are written once and never updated.
    """
    update = {
        "status": "done",
        "stage": "done",
        "completed_at": _now(),
        **payload,
    }
    _get_client().table("forecast_runs").update(update).eq("id", run_id).execute()
    log.info("complete_run: run_id=%s", run_id)


def get_run(run_id: str) -> dict | None:
    result = (
        _get_client()
        .table("forecast_runs")
        .select("*")
        .eq("id", run_id)
        .limit(1)
        .execute()
    )
    rows = result.data
    return rows[0] if rows else None


def find_existing_run(ticker: str, trading_day: date) -> dict | None:
    client = _get_client()
    day_start = datetime(
        trading_day.year, trading_day.month, trading_day.day,
        0, 0, 0, tzinfo=timezone.utc,
    ).isoformat()
    day_end = datetime(
        trading_day.year, trading_day.month, trading_day.day,
        23, 59, 59, tzinfo=timezone.utc,
    ).isoformat()
    result = (
        client.table("forecast_runs")
        .select("*")
        .eq("ticker", ticker)
        .in_("status", ["queued", "fetching", "training", "evaluating", "done"])
        .gte("created_at", day_start)
        .lte("created_at", day_end)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    rows = result.data
    if rows:
        log.info("find_existing_run: run_id=%s status=%s", rows[0]["id"], rows[0]["status"])
        return rows[0]
    return None


def update_run_meta(run_id: str, fields: dict[str, Any]) -> None:
    """Update arbitrary columns (used mid-pipeline for exchange/currency/data_hash)."""
    _get_client().table("forecast_runs").update(fields).eq("id", run_id).execute()


# ─── model_benchmarks ────────────────────────────────────────────────────────

def insert_benchmark(
    model_version: str,
    ticker: str,
    exchange: str,
    currency: str,
    n_test_days: int,
    model_directional: float,
    model_mape: float,
    model_rmse: float,
    naive_mape: float,
    naive_rmse: float,
    baseline_directional: float,
    chosen_model: str,
) -> None:
    _get_client().table("model_benchmarks").insert({
        "model_version": model_version,
        "ticker": ticker,
        "exchange": exchange,
        "currency": currency,
        "n_test_days": n_test_days,
        "model_directional": model_directional,
        "model_mape": model_mape,
        "model_rmse": model_rmse,
        "naive_mape": naive_mape,
        "naive_rmse": naive_rmse,
        "baseline_directional": baseline_directional,
        "chosen_model": chosen_model,
    }).execute()
    log.info("insert_benchmark: ticker=%s model=%s", ticker, chosen_model)
