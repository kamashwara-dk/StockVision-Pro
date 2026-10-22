"""
db.py — Supabase database access for the model service.

This is the ONLY place in the model service that touches Supabase.
Uses the service role key from the MODEL_SERVICE_SUPABASE_SERVICE_ROLE_KEY
environment variable. No browser client; no RLS bypass needed because
the service role bypasses RLS by default in Supabase.

All writes are append-only:
  - price_history_cache rows are inserted; existing rows for the same
    (ticker, fetched_on) pair are left alone (ON CONFLICT DO NOTHING).
  - forecast_runs rows are inserted once (status = queued), then updated
    in-place as the pipeline progresses. Metrics are written in a single
    final update at status = done.
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


# ─── price_history_cache ──────────────────────────────────────────────────────

def get_cached_history(ticker: str, trading_day: date) -> dict | None:
    """
    Return the cached payload for *ticker* on *trading_day*, or None.

    Args:
        ticker:       Yahoo Finance symbol.
        trading_day:  The calendar date of the current trading day (UTC).

    Returns:
        The cached row dict (including 'payload') or None if not found.
    """
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
        log.info("db.get_cached_history: cache HIT ticker=%s date=%s", ticker, trading_day)
        return rows[0]
    log.info("db.get_cached_history: cache MISS ticker=%s date=%s", ticker, trading_day)
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
    """
    Insert a new cache row. On conflict (same ticker + fetched_on), do nothing.

    Args:
        ticker:       Yahoo Finance symbol.
        exchange:     Mapped exchange name.
        trading_day:  The calendar date on which the data was fetched.
        range_start:  First date in the payload.
        range_end:    Last date in the payload.
        row_count:    Number of rows in the payload.
        data_hash:    SHA-256 hex digest of the JSON payload.
        payload:      List of OHLCV row dicts.
    """
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
    log.info(
        "db.upsert_history_cache: ticker=%s date=%s rows=%d",
        ticker,
        trading_day,
        row_count,
    )


# ─── forecast_runs ────────────────────────────────────────────────────────────

def create_run(
    ticker: str,
    exchange: str,
    currency: str,
) -> str:
    """
    Insert a new forecast_runs row with status='queued'.

    Returns:
        The new run id (UUID string).
    """
    client = _get_client()
    result = (
        client.table("forecast_runs")
        .insert(
            {
                "ticker": ticker,
                "exchange": exchange,
                "currency": currency,
                "status": "queued",
                "stage": "queued",
            }
        )
        .execute()
    )
    run_id: str = result.data[0]["id"]
    log.info("db.create_run: run_id=%s ticker=%s", run_id, ticker)
    return run_id


def update_run_status(run_id: str, status: str, stage: str) -> None:
    """Update just the status and stage fields (used during pipeline progress)."""
    _get_client().table("forecast_runs").update(
        {"status": status, "stage": stage}
    ).eq("id", run_id).execute()
    log.info("db.update_run_status: run_id=%s status=%s stage=%s", run_id, status, stage)


def fail_run(run_id: str, error_message: str) -> None:
    """Mark a run as failed with a user-facing error message."""
    _get_client().table("forecast_runs").update(
        {
            "status": "failed",
            "stage": "failed",
            "error_message": error_message,
            "completed_at": _now(),
        }
    ).eq("id", run_id).execute()
    log.warning("db.fail_run: run_id=%s error=%s", run_id, error_message)


def complete_run(run_id: str, payload: dict[str, Any]) -> None:
    """
    Write the final metrics to the forecast_runs row and set status='done'.

    The *payload* dict must contain all result fields defined in the
    forecast_runs table. Metrics are written once and never updated again.

    Args:
        run_id:   UUID of the run.
        payload:  Dict of all result fields (see spec §6 for the full list).
    """
    update = {
        "status": "done",
        "stage": "done",
        "completed_at": _now(),
        **payload,
    }
    _get_client().table("forecast_runs").update(update).eq("id", run_id).execute()
    log.info("db.complete_run: run_id=%s", run_id)


def get_run(run_id: str) -> dict | None:
    """Return the full forecast_runs row for *run_id*, or None."""
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
    """
    Return an existing run for *ticker* that is either in-progress
    (queued/fetching/training/evaluating) or completed (done) and
    whose created_at date matches *trading_day*.

    This implements the single-flight rule: if a run already exists
    for this ticker + trading day, return it instead of starting another.

    Args:
        ticker:       Yahoo Finance symbol.
        trading_day:  The calendar date of the current trading day.

    Returns:
        The forecast_runs row dict, or None if no matching run exists.
    """
    client = _get_client()

    # Look for any non-failed run created on trading_day.
    day_start = datetime(
        trading_day.year, trading_day.month, trading_day.day,
        0, 0, 0, tzinfo=timezone.utc
    ).isoformat()
    day_end = datetime(
        trading_day.year, trading_day.month, trading_day.day,
        23, 59, 59, tzinfo=timezone.utc
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
        log.info(
            "db.find_existing_run: found existing run_id=%s status=%s",
            rows[0].get("id"),
            rows[0].get("status"),
        )
        return rows[0]
    return None


# ─── helpers ──────────────────────────────────────────────────────────────────

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()
