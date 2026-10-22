"""
main.py — FastAPI entry point for the StockVision Pro model service.

Responsibilities:
  - Receive forecast job requests from the Next.js API layer.
  - Orchestrate the pipeline: fetch → validate → features → train → metrics → write.
  - Update forecast_runs status at each stage (visible in the loading UI).
  - Write results to Supabase (service role; no browser access).
  - Enforce input validation and structured JSON logging.

Endpoints:
  POST /jobs          Create a new forecast job (or return existing for today).
  GET  /jobs/{run_id} Get job status and results.
  GET  /search        Proxy Yahoo search (used by /api/search in Next.js).
  GET  /health        Liveness probe.

Environment variables (see .env.example):
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  MODEL_SERVICE_API_KEY      (Bearer token; Next.js API must send this)
  LOG_LEVEL                  (default: INFO)
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import re
import sys
from contextlib import asynccontextmanager
from datetime import date, datetime, timezone
from typing import Any

import exchange_calendars as xcals
from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

import db
from pipeline.features import build_features
from pipeline.metrics import compute_metrics
from pipeline.train import train_and_evaluate
from pipeline.validate import InsufficientHistoryError, validate
from provider import DataFetchError, TickerNotFoundError, YahooProvider

# ─── Logging ──────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO").upper(),
    format='{"time":"%(asctime)s","level":"%(levelname)s","logger":"%(name)s","msg":%(message)s}',
    stream=sys.stdout,
)
log = logging.getLogger("model-service")

# ─── Provider ─────────────────────────────────────────────────────────────────

_provider = YahooProvider()

# ─── Exchange calendars ───────────────────────────────────────────────────────

_CALENDARS: dict[str, Any] = {}

def _get_calendar(exchange: str) -> Any | None:
    """Return exchange_calendars calendar object, or None if unsupported."""
    cal_map = {
        "NSE": "XNSE",
        "BSE": "XBOM",
        "NYSE": "XNYS",
        "NASDAQ": "XNAS",
        "NYSE Arca": "XNYS",
        "NYSE American": "XNYS",
    }
    key = cal_map.get(exchange)
    if key is None:
        return None
    if key not in _CALENDARS:
        try:
            _CALENDARS[key] = xcals.get_calendar(key)
        except Exception as exc:
            log.warning("Could not load calendar %s: %s", key, exc)
            return None
    return _CALENDARS[key]


def _next_trading_date(exchange: str, after: date) -> date | None:
    """Return the next trading date for *exchange* after *after*."""
    cal = _get_calendar(exchange)
    if cal is None:
        return None
    try:
        # get_open_days returns a DatetimeIndex; find the first one > after.
        sessions = cal.sessions_in_range(
            str(after),
            str(date(after.year + 1, after.month, after.day)),
        )
        for s in sessions:
            d = s.date()
            if d > after:
                return d
    except Exception as exc:
        log.warning("_next_trading_date failed for %s: %s", exchange, exc)
    return None


def _current_trading_day() -> date:
    """Return today's UTC calendar date (used as the cache key)."""
    return datetime.now(timezone.utc).date()


# ─── Auth ─────────────────────────────────────────────────────────────────────

_API_KEY = os.environ.get("MODEL_SERVICE_API_KEY", "")


def _verify_api_key(authorization: str = Header(...)) -> None:
    if not _API_KEY:
        return  # dev mode: no auth required
    if authorization != f"Bearer {_API_KEY}":
        raise HTTPException(status_code=401, detail="Unauthorized")


# ─── Input validation ─────────────────────────────────────────────────────────

TICKER_RE = re.compile(r"^[A-Z0-9.\-^]{1,15}$")


def _validate_ticker(ticker: str) -> str:
    t = ticker.strip().upper()
    if not TICKER_RE.match(t):
        raise HTTPException(
            status_code=422,
            detail={
                "code": "INVALID_TICKER",
                "message": (
                    "Ticker must be 1–15 characters: letters, digits, "
                    "dot, hyphen, caret only."
                ),
            },
        )
    return t


# ─── App ──────────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info('"model-service started"')
    yield
    log.info('"model-service shutting down"')


app = FastAPI(
    title="StockVision Pro Model Service",
    version="1.0.0",
    lifespan=lifespan,
)

# Only the Next.js API layer (MODEL_SERVICE_URL origin) calls this service.
# In production, lock this down to the Vercel deployment URL.
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("ALLOWED_ORIGINS", "*").split(","),
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)


# ─── Request / Response models ────────────────────────────────────────────────

class CreateJobRequest(BaseModel):
    ticker: str = Field(..., min_length=1, max_length=15)

    @field_validator("ticker")
    @classmethod
    def upper(cls, v: str) -> str:
        return v.strip().upper()


class JobStatusResponse(BaseModel):
    run_id: str
    status: str
    stage: str | None
    error: str | None
    result: dict | None


# ─── Background pipeline ──────────────────────────────────────────────────────

async def _run_pipeline(run_id: str, ticker: str) -> None:
    """
    Full pipeline: fetch → validate → features → train → metrics → write.

    Runs as a FastAPI BackgroundTask. All errors are caught, logged, and
    written to forecast_runs.error_message. Stack traces go to logs only;
    the error stored in the DB is a plain sentence.
    """
    trading_day = _current_trading_day()

    try:
        # ── Stage 1: Fetching ────────────────────────────────────────────────
        db.update_run_status(run_id, "fetching", "fetching")
        log.info('"pipeline stage=fetching run_id=%s ticker=%s"', run_id, ticker)

        # Check cache first.
        cached = db.get_cached_history(ticker, trading_day)
        if cached:
            history_rows_dicts = json.loads(cached["payload"])
            exchange = cached["exchange"]
            data_hash = cached["data_hash"]
            # Reconstruct OHLCVRow objects.
            from provider.base import OHLCVRow
            raw_rows = [
                OHLCVRow(
                    date=date.fromisoformat(r["date"]),
                    open=r["open"],
                    high=r["high"],
                    low=r["low"],
                    close=r["close"],
                    volume=r["volume"],
                )
                for r in history_rows_dicts
            ]
            from provider.base import TickerInfo
            info = TickerInfo(
                symbol=ticker,
                name=cached.get("ticker", ticker),
                exchange=exchange,
                currency=cached.get("currency", "USD"),
                quote_type="Equity",
            )
        else:
            result = await asyncio.get_event_loop().run_in_executor(
                None, lambda: _provider.get_history(ticker, years=10)
            )
            raw_rows = result.rows
            info = result.info
            exchange = info.exchange

            # Serialise for cache.
            rows_dicts = [
                {
                    "date": r.date.isoformat(),
                    "open": r.open,
                    "high": r.high,
                    "low": r.low,
                    "close": r.close,
                    "volume": r.volume,
                }
                for r in raw_rows
            ]
            payload_str = json.dumps(rows_dicts, sort_keys=True)
            data_hash = hashlib.sha256(payload_str.encode()).hexdigest()

            if raw_rows:
                db.upsert_history_cache(
                    ticker=ticker,
                    exchange=exchange,
                    trading_day=trading_day,
                    range_start=raw_rows[0].date,
                    range_end=raw_rows[-1].date,
                    row_count=len(raw_rows),
                    data_hash=data_hash,
                    payload=rows_dicts,
                )

            # Update run with exchange + currency + data_hash now that we know them.
            db._get_client().table("forecast_runs").update(
                {
                    "exchange": info.exchange,
                    "currency": info.currency,
                    "data_hash": data_hash,
                }
            ).eq("id", run_id).execute()

        # ── Stage 2: Validating (part of training stage for UX) ───────────────
        db.update_run_status(run_id, "training", "training")
        log.info('"pipeline stage=training run_id=%s ticker=%s"', run_id, ticker)

        cleaned = validate(ticker, raw_rows)

        # Build feature matrix. Exclude split suspects from training.
        split_suspect_set = set(cleaned.split_suspect_dates)
        fm = build_features(cleaned.rows, exclude_dates=split_suspect_set)

        # ── Stage 3: Evaluating ───────────────────────────────────────────────
        db.update_run_status(run_id, "evaluating", "evaluating")
        log.info('"pipeline stage=evaluating run_id=%s ticker=%s"', run_id, ticker)

        # Determine next trading date.
        next_td = _next_trading_date(exchange, fm.last_date)

        # Run walk-forward training + evaluation.
        train_result = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: train_and_evaluate(fm, next_trading_date=next_td),
        )

        # Build train-window prev_closes for the directional baseline.
        # The feature matrix covers rows from _MAX_LOOKBACK onwards.
        # We need actuals and prev_closes for the training portion.
        from pipeline.features import _MAX_LOOKBACK  # type: ignore[attr-defined]
        split_idx = int(len(fm.dates) * 0.80)
        if split_idx < 2:
            split_idx = 2

        # Reconstruct all closes from log_returns + last_close.
        from pipeline.train import _reconstruct_closes_from_log_returns
        all_closes = _reconstruct_closes_from_log_returns(fm.y, fm.last_close, len(fm.y))
        train_actuals = all_closes[:split_idx]
        train_prev_closes = [all_closes[i - 1] if i > 0 else all_closes[0]
                             for i in range(split_idx)]

        metrics = compute_metrics(
            test_dates=train_result.test_dates,
            test_actuals=train_result.test_actuals,
            test_predictions=train_result.test_predictions,
            test_prev_closes=train_result.test_prev_closes,
            train_actuals=train_actuals,
            train_prev_closes=train_prev_closes,
        )

        # ── Stage 4: Write results ────────────────────────────────────────────
        db.complete_run(
            run_id=run_id,
            payload={
                "data_hash": data_hash,
                "model_version": train_result.model_version,
                "train_start": train_result.train_start.isoformat(),
                "train_end": train_result.train_end.isoformat(),
                "test_start": train_result.test_start.isoformat(),
                "test_end": train_result.test_end.isoformat(),
                "n_test_days": train_result.n_test_days,
                "last_close": train_result.last_close,
                "predicted_close": train_result.predicted_close,
                "interval_low": train_result.interval_low,
                "interval_high": train_result.interval_high,
                "interval_coverage": train_result.interval_coverage,
                "directional_accuracy": metrics.directional_accuracy,
                "mape": metrics.mape,
                "rmse": metrics.rmse,
                "baseline_directional": metrics.baseline_directional,
                "baseline_mape": metrics.baseline_mape,
                "baseline_rmse": metrics.baseline_rmse,
            },
        )

        log.info('"pipeline done run_id=%s ticker=%s"', run_id, ticker)

    except TickerNotFoundError as exc:
        log.warning('"pipeline ticker_not_found run_id=%s ticker=%s: %s"', run_id, ticker, exc)
        db.fail_run(run_id, str(exc))

    except InsufficientHistoryError as exc:
        log.warning('"pipeline insufficient_history run_id=%s ticker=%s: %s"', run_id, ticker, exc)
        db.fail_run(run_id, str(exc))

    except ValueError as exc:
        log.warning('"pipeline user_error run_id=%s ticker=%s: %s"', run_id, ticker, exc)
        db.fail_run(run_id, str(exc))

    except Exception as exc:
        log.exception('"pipeline unexpected_error run_id=%s ticker=%s"', run_id, ticker)
        db.fail_run(
            run_id,
            "An unexpected error occurred. Please try again.",
        )


# ─── API routes ───────────────────────────────────────────────────────────────

@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.get("/search")
async def search_proxy(
    q: str,
    _: None = Depends(_verify_api_key),
) -> list[dict]:
    """
    Proxy Yahoo Finance search. Called by the Next.js /api/search handler.
    Caching and ranking are applied by the Next.js layer.
    """
    if not q or not q.strip():
        return []

    q = q.strip()[:50]

    try:
        results = await asyncio.get_event_loop().run_in_executor(
            None, lambda: _provider.search(q)
        )
        return [
            {
                "symbol": r.symbol,
                "name": r.name,
                "exchange": r.exchange,
                "type": r.quote_type,
            }
            for r in results
        ]
    except DataFetchError as exc:
        log.warning('"search_proxy failed q=%s: %s"', q, exc)
        raise HTTPException(status_code=502, detail={"code": "UPSTREAM_ERROR", "message": "Search temporarily unavailable."})


@app.post("/jobs", status_code=202)
async def create_job(
    req: CreateJobRequest,
    background_tasks: BackgroundTasks,
    _: None = Depends(_verify_api_key),
) -> dict:
    """
    Create a new forecast job, or return an existing one for today.

    Returns 202 with {run_id, status} for new/in-progress jobs.
    Returns 200 with the completed result if a done run exists for today.
    """
    ticker = _validate_ticker(req.ticker)
    trading_day = _current_trading_day()

    # Single-flight: check for an existing run for this ticker + trading day.
    existing = db.find_existing_run(ticker, trading_day)
    if existing:
        log.info('"create_job: reusing run_id=%s status=%s"', existing["id"], existing["status"])
        return {"run_id": existing["id"], "status": existing["status"]}

    # Fetch ticker info quickly to verify the ticker and get exchange/currency.
    # This also catches invalid tickers before we create a DB row.
    try:
        info_result = await asyncio.get_event_loop().run_in_executor(
            None, lambda: _provider._fetch_info(ticker)
        )
    except Exception:
        # If info fetch fails, proceed anyway; the pipeline will fail gracefully.
        info_result = None

    exchange = info_result.exchange if info_result else "Unknown"
    currency = info_result.currency if info_result else "USD"

    # Create the run row.
    run_id = db.create_run(ticker=ticker, exchange=exchange, currency=currency)

    # Kick off the pipeline asynchronously.
    background_tasks.add_task(_run_pipeline, run_id, ticker)

    log.info('"create_job: new run_id=%s ticker=%s"', run_id, ticker)
    return {"run_id": run_id, "status": "queued"}


@app.get("/jobs/{run_id}")
async def get_job(
    run_id: str,
    _: None = Depends(_verify_api_key),
) -> dict:
    """Return the current state of a forecast job."""
    row = db.get_run(run_id)
    if row is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": "Run not found."},
        )

    result: dict | None = None
    if row.get("status") == "done":
        result = {
            "last_close": row.get("last_close"),
            "predicted_close": row.get("predicted_close"),
            "interval_low": row.get("interval_low"),
            "interval_high": row.get("interval_high"),
            "interval_coverage": row.get("interval_coverage"),
            "metrics": {
                "directional_accuracy": row.get("directional_accuracy"),
                "mape": row.get("mape"),
                "rmse": row.get("rmse"),
            },
            "baselines": {
                "directional": row.get("baseline_directional"),
                "mape": row.get("baseline_mape"),
                "rmse": row.get("baseline_rmse"),
            },
            "data_range": {
                "train_start": row.get("train_start"),
                "train_end": row.get("train_end"),
            },
            "test_range": {
                "start": row.get("test_start"),
                "end": row.get("test_end"),
            },
            "n_test_days": row.get("n_test_days"),
            "currency": row.get("currency"),
            "model_version": row.get("model_version"),
        }

    return {
        "run_id": run_id,
        "status": row.get("status"),
        "stage": row.get("stage"),
        "error": row.get("error_message"),
        "result": result,
    }
