"""
main.py — FastAPI entry point for the StockVision Pro model service.

Endpoints:
  POST /jobs          Create or retrieve a forecast job for today.
  GET  /jobs/{run_id} Poll job status and results.
  GET  /search        Proxy Yahoo Finance search.
  GET  /health        Liveness probe.

Environment variables: see .env.example
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import math
import os
import re
import sys
from contextlib import asynccontextmanager
from datetime import date, datetime, timezone
from typing import Any

import exchange_calendars as xcals
from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

import db
from pipeline.features import MarketContext, build_features
from pipeline.metrics import compute_metrics
from pipeline.train import _reconstruct_closes, train_and_evaluate
from pipeline.validate import InsufficientHistoryError, validate
from provider import DataFetchError, TickerNotFoundError, YahooProvider

# ─── Logging ──────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO").upper(),
    format='{"time":"%(asctime)s","level":"%(levelname)s","logger":"%(name)s","msg":"%(message)s"}',
    stream=sys.stdout,
)
log = logging.getLogger("model-service")

# ─── Provider ─────────────────────────────────────────────────────────────────

_provider = YahooProvider()

# ─── Exchange calendars ───────────────────────────────────────────────────────

_CALENDARS: dict[str, Any] = {}
_CAL_MAP = {
    "NSE": "XNSE", "BSE": "XBOM",
    "NYSE": "XNYS", "NASDAQ": "XNAS",
    "NYSE Arca": "XNYS", "NYSE American": "XNYS",
}


def _get_calendar(exchange: str) -> Any | None:
    key = _CAL_MAP.get(exchange)
    if not key:
        return None
    if key not in _CALENDARS:
        try:
            _CALENDARS[key] = xcals.get_calendar(key)
        except Exception as exc:
            log.warning("calendar load failed exchange=%s: %s", exchange, exc)
            return None
    return _CALENDARS[key]


def _next_trading_date(exchange: str, after: date) -> date | None:
    cal = _get_calendar(exchange)
    if cal is None:
        return None
    try:
        sessions = cal.sessions_in_range(
            str(after),
            str(date(after.year + 1, after.month, after.day)),
        )
        for s in sessions:
            d = s.date()
            if d > after:
                return d
    except Exception as exc:
        log.warning("_next_trading_date failed exchange=%s: %s", exchange, exc)
    return None


def _current_trading_day() -> date:
    return datetime.now(timezone.utc).date()


# ─── Auth ─────────────────────────────────────────────────────────────────────

_API_KEY = os.environ.get("MODEL_SERVICE_API_KEY", "")


def _verify_api_key(authorization: str = Header(...)) -> None:
    if not _API_KEY:
        return  # dev mode
    if authorization != f"Bearer {_API_KEY}":
        raise HTTPException(status_code=401, detail="Unauthorized")


# ─── Input validation ─────────────────────────────────────────────────────────

TICKER_RE = re.compile(r"^[A-Z0-9.\-^]{1,15}$")


def _validate_ticker(ticker: str) -> str:
    t = ticker.strip().upper()
    if not TICKER_RE.match(t):
        raise HTTPException(
            status_code=422,
            detail={"code": "INVALID_TICKER",
                    "message": "Ticker must be 1–15 chars: letters, digits, dot, hyphen, caret."},
        )
    return t


# ─── App ──────────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("model-service started")
    yield
    log.info("model-service shutting down")


app = FastAPI(title="StockVision Pro Model Service", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("ALLOWED_ORIGINS", "*").split(","),
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)


class CreateJobRequest(BaseModel):
    ticker: str = Field(..., min_length=1, max_length=15)

    @field_validator("ticker")
    @classmethod
    def upper(cls, v: str) -> str:
        return v.strip().upper()


# ─── Market context helper ────────────────────────────────────────────────────

_INDIAN_EXCHANGES = {"NSE", "BSE"}
_CONTEXT_TICKERS_INDIAN = ["^NSEI", "^INDIAVIX", "^GSPC"]
_CONTEXT_TICKERS_US     = ["^GSPC", "^VIX"]


def _build_context(exchange: str) -> MarketContext | None:
    """
    Fetch context tickers from Yahoo and build a MarketContext.

    Uses 2 years of daily data for the context series (fast, consistent).
    Failures are non-fatal: the pipeline continues with zero context features.

    Timing rule: for NSE/BSE the previous S&P 500 close (^GSPC) is
    available before the Indian market opens, so it is safe to use it as
    a feature for day t using the value from day t-1.
    """
    is_indian = exchange.upper() in _INDIAN_EXCHANGES
    tickers = _CONTEXT_TICKERS_INDIAN if is_indian else _CONTEXT_TICKERS_US

    ctx_data: dict[str, dict[date, float]] = {}
    for sym in tickers:
        try:
            result = _provider.get_history(sym, years=2)
            rows = result.rows
            log_rets: dict[date, float] = {}
            for i in range(1, len(rows)):
                pc, cc = rows[i - 1].close, rows[i].close
                if pc > 0 and cc > 0:
                    import math as _math
                    log_rets[rows[i].date] = _math.log(cc / pc)
            ctx_data[sym] = log_rets
        except Exception as exc:
            log.warning("context fetch failed sym=%s: %s", sym, exc)
            ctx_data[sym] = {}

    if is_indian:
        return MarketContext(
            nsei_ret=ctx_data.get("^NSEI", {}),
            indiavix_ret=ctx_data.get("^INDIAVIX", {}),
            spx_ret=ctx_data.get("^GSPC", {}),
            vix_ret={},
        )
    else:
        return MarketContext(
            nsei_ret={},
            indiavix_ret={},
            spx_ret=ctx_data.get("^GSPC", {}),
            vix_ret=ctx_data.get("^VIX", {}),
        )


# ─── Background pipeline ──────────────────────────────────────────────────────

async def _run_pipeline(run_id: str, ticker: str) -> None:
    """
    Full pipeline: fetch → validate → features → train → metrics → write.

    All errors are caught; stack traces go to logs only; the DB stores
    a plain-English message for the user.
    """
    trading_day = _current_trading_day()

    try:
        # ── Stage 1: Fetching ────────────────────────────────────────────────
        db.update_run_status(run_id, "fetching", "Fetching price history")

        cached = db.get_cached_history(ticker, trading_day)
        if cached:
            history_rows_dicts = json.loads(cached["payload"])
            exchange = cached["exchange"]
            data_hash = cached["data_hash"]
            from provider.base import OHLCVRow, TickerInfo
            raw_rows = [
                OHLCVRow(
                    date=date.fromisoformat(r["date"]),
                    open=r["open"], high=r["high"],
                    low=r["low"],   close=r["close"],
                    volume=r["volume"],
                )
                for r in history_rows_dicts
            ]
            info = TickerInfo(
                symbol=ticker,
                name=ticker,
                exchange=exchange,
                currency=cached.get("currency", "USD"),
                quote_type="Equity",
            )
        else:
            result = await asyncio.get_event_loop().run_in_executor(
                None, lambda: _provider.get_history(ticker, years=10)
            )
            raw_rows = list(result.rows)
            info     = result.info
            exchange = info.exchange

            rows_dicts = [
                {
                    "date": r.date.isoformat(),
                    "open": r.open, "high": r.high,
                    "low": r.low,   "close": r.close,
                    "volume": r.volume,
                }
                for r in raw_rows
            ]
            payload_str = json.dumps(rows_dicts, sort_keys=True)
            data_hash   = hashlib.sha256(payload_str.encode()).hexdigest()

            if raw_rows:
                db.upsert_history_cache(
                    ticker=ticker, exchange=exchange,
                    trading_day=trading_day,
                    range_start=raw_rows[0].date,
                    range_end=raw_rows[-1].date,
                    row_count=len(raw_rows),
                    data_hash=data_hash,
                    payload=rows_dicts,
                )

            db.update_run_meta(run_id, {
                "exchange": info.exchange,
                "currency": info.currency,
                "data_hash": data_hash,
            })

        # ── Stage 2: Training ─────────────────────────────────────────────────
        db.update_run_status(run_id, "training", "Training model")

        cleaned = validate(ticker, raw_rows)
        split_suspect_set = set(cleaned.split_suspect_dates)

        # Fetch market context asynchronously (non-fatal on failure).
        try:
            ctx = await asyncio.get_event_loop().run_in_executor(
                None, lambda: _build_context(exchange)
            )
        except Exception:
            ctx = None

        fm = build_features(
            cleaned.rows,
            exclude_dates=split_suspect_set,
            context=ctx,
            exchange=exchange,
        )

        # ── Stage 3: Evaluating ───────────────────────────────────────────────
        db.update_run_status(run_id, "evaluating", "Evaluating on held-out data")

        next_td = _next_trading_date(exchange, fm.last_date)

        train_result = await asyncio.get_event_loop().run_in_executor(
            None, lambda: train_and_evaluate(fm, next_trading_date=next_td),
        )

        # Reconstruct closes for the training window baseline.
        all_closes  = _reconstruct_closes(fm.y, fm.last_close, len(fm.y))
        # train_end_idx is derived the same way as in train.py
        train_end_idx = max(5, int(math.floor(len(fm.y) * 0.70)))
        train_actuals     = all_closes[:train_end_idx]
        train_prev_closes = [
            all_closes[i - 1] if i > 0 else all_closes[0]
            for i in range(train_end_idx)
        ]

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
                "data_hash":          data_hash,
                "model_version":      train_result.model_version,
                "chosen_model":       train_result.chosen_model,
                "train_start":        train_result.train_start.isoformat(),
                "train_end":          train_result.train_end.isoformat(),
                "val_start":          train_result.val_start.isoformat(),
                "val_end":            train_result.val_end.isoformat(),
                "test_start":         train_result.test_start.isoformat(),
                "test_end":           train_result.test_end.isoformat(),
                "n_test_days":        train_result.n_test_days,
                "last_close":         train_result.last_close,
                "predicted_close":    train_result.predicted_close,
                "interval_low":       train_result.interval_low,
                "interval_high":      train_result.interval_high,
                "interval_coverage":  train_result.interval_coverage,
                "directional_accuracy": metrics.directional_accuracy,
                "mape":               metrics.mape,
                "rmse":               metrics.rmse,
                "baseline_directional": metrics.baseline_directional,
                "baseline_mape":      metrics.baseline_mape,
                "baseline_rmse":      metrics.baseline_rmse,
            },
        )

        log.info("pipeline done run_id=%s ticker=%s chosen=%s",
                 run_id, ticker, train_result.chosen_model)

    except TickerNotFoundError as exc:
        log.warning("ticker_not_found run_id=%s: %s", run_id, exc)
        db.fail_run(run_id, str(exc))

    except InsufficientHistoryError as exc:
        log.warning("insufficient_history run_id=%s: %s", run_id, exc)
        db.fail_run(run_id, str(exc))

    except ValueError as exc:
        log.warning("user_error run_id=%s: %s", run_id, exc)
        db.fail_run(run_id, str(exc))

    except Exception:
        log.exception("unexpected_error run_id=%s ticker=%s", run_id, ticker)
        db.fail_run(run_id, "An unexpected error occurred. Please try again.")


# ─── API routes ───────────────────────────────────────────────────────────────

@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.get("/search")
async def search_proxy(
    q: str,
    _: None = Depends(_verify_api_key),
) -> list[dict]:
    if not q or not q.strip():
        return []
    q = q.strip()[:50]
    try:
        results = await asyncio.get_event_loop().run_in_executor(
            None, lambda: _provider.search(q)
        )
        return [
            {"symbol": r.symbol, "name": r.name,
             "exchange": r.exchange, "type": r.quote_type}
            for r in results
        ]
    except DataFetchError as exc:
        log.warning("search_proxy failed q=%s: %s", q, exc)
        raise HTTPException(
            status_code=502,
            detail={"code": "UPSTREAM_ERROR",
                    "message": "Search temporarily unavailable."},
        )


@app.post("/jobs", status_code=202)
async def create_job(
    req: CreateJobRequest,
    background_tasks: BackgroundTasks,
    _: None = Depends(_verify_api_key),
) -> dict:
    ticker      = _validate_ticker(req.ticker)
    trading_day = _current_trading_day()

    # Single-flight
    existing = db.find_existing_run(ticker, trading_day)
    if existing:
        return {"run_id": existing["id"], "status": existing["status"]}

    try:
        info_result = await asyncio.get_event_loop().run_in_executor(
            None, lambda: _provider._fetch_info(ticker)
        )
    except Exception:
        info_result = None

    exchange = info_result.exchange if info_result else "Unknown"
    currency = info_result.currency if info_result else "USD"

    run_id = db.create_run(ticker=ticker, exchange=exchange, currency=currency)
    background_tasks.add_task(_run_pipeline, run_id, ticker)

    log.info("create_job: new run_id=%s ticker=%s", run_id, ticker)
    return {"run_id": run_id, "status": "queued"}


@app.get("/jobs/{run_id}")
async def get_job(
    run_id: str,
    _: None = Depends(_verify_api_key),
) -> dict:
    row = db.get_run(run_id)
    if row is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": "Run not found."},
        )

    result: dict | None = None
    if row.get("status") == "done":
        result = {
            "last_close":         row.get("last_close"),
            "predicted_close":    row.get("predicted_close"),
            "interval_low":       row.get("interval_low"),
            "interval_high":      row.get("interval_high"),
            "interval_coverage":  row.get("interval_coverage"),
            "metrics": {
                "directional_accuracy": row.get("directional_accuracy"),
                "mape":  row.get("mape"),
                "rmse":  row.get("rmse"),
            },
            "baselines": {
                "directional": row.get("baseline_directional"),
                "mape":        row.get("baseline_mape"),
                "rmse":        row.get("baseline_rmse"),
            },
            "data_range": {
                "train_start": row.get("train_start"),
                "train_end":   row.get("train_end"),
            },
            "val_range": {
                "start": row.get("val_start"),
                "end":   row.get("val_end"),
            },
            "test_range": {
                "start": row.get("test_start"),
                "end":   row.get("test_end"),
            },
            "n_test_days":   row.get("n_test_days"),
            "currency":      row.get("currency"),
            "model_version": row.get("model_version"),
            "chosen_model":  row.get("chosen_model"),
        }

    return {
        "run_id": run_id,
        "status": row.get("status"),
        "stage":  row.get("stage"),
        "error":  row.get("error_message"),
        "result": result,
    }


@app.get("/quote/{ticker}")
async def quote(
    ticker: str,
    _: None = Depends(_verify_api_key),
) -> dict:
    """
    Return the latest delayed quote for a single ticker.
    Called by the Next.js /api/quote route handler (Phase 2).
    """
    t = _validate_ticker(ticker)
    try:
        result = await asyncio.get_event_loop().run_in_executor(
            None, lambda: _provider.get_quote(t)
        )
        return result
    except TickerNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except DataFetchError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
