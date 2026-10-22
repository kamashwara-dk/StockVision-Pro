#!/usr/bin/env python3
"""
benchmark/run_benchmark.py — Run the full pipeline on a fixed 20-ticker
universe and write one row per ticker to model_benchmarks.

Usage (from model-service/):
    python -m benchmark.run_benchmark [--no-db]

Flags:
    --no-db   Print the table to stdout but do not write to Supabase.
              Useful for local testing without Supabase credentials.

The universe is fixed so results across runs are comparable.
10 NSE tickers (large + mid cap) and 10 US tickers (large + mid cap).

Output columns:
    ticker | exchange | n_test | chosen_model
    | model_DA% | model_MAPE% | model_RMSE
    | naive_MAPE% | naive_RMSE | beats
"""

from __future__ import annotations

import argparse
import logging
import math
import os
import sys

# Allow running as `python -m benchmark.run_benchmark` from model-service/
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pipeline.features import MarketContext, build_features
from pipeline.metrics import compute_metrics
from pipeline.train import _reconstruct_closes, train_and_evaluate
from pipeline.validate import InsufficientHistoryError, validate
from provider import YahooProvider

logging.basicConfig(
    level=logging.WARNING,  # suppress INFO noise during benchmark
    format="%(levelname)s %(name)s: %(message)s",
    stream=sys.stderr,
)
log = logging.getLogger("benchmark")

# ─── Fixed universe ───────────────────────────────────────────────────────────

UNIVERSE: list[tuple[str, str]] = [
    # (ticker, exchange)
    # NSE large cap
    ("RELIANCE.NS",   "NSE"),
    ("TCS.NS",        "NSE"),
    ("HDFCBANK.NS",   "NSE"),
    ("INFY.NS",       "NSE"),
    ("ICICIBANK.NS",  "NSE"),
    # NSE mid cap
    ("PERSISTENT.NS", "NSE"),
    ("KPITTECH.NS",   "NSE"),
    ("APOLLOHOSP.NS", "NSE"),
    ("TATAPOWER.NS",  "NSE"),
    ("CAMS.NS",       "NSE"),
    # US large cap
    ("AAPL",   "NASDAQ"),
    ("MSFT",   "NASDAQ"),
    ("GOOGL",  "NASDAQ"),
    ("AMZN",   "NASDAQ"),
    ("JPM",    "NYSE"),
    # US mid cap
    ("ETSY",   "NASDAQ"),
    ("BILL",   "NYSE"),
    ("RKT",    "NYSE"),
    ("GTLB",   "NASDAQ"),
    ("DDOG",   "NASDAQ"),
]


# ─── Context tickers ──────────────────────────────────────────────────────────

def _fetch_context(provider: YahooProvider, exchange: str) -> MarketContext | None:
    is_indian = exchange.upper() in ("NSE", "BSE")
    tickers = (
        ["^NSEI", "^INDIAVIX", "^GSPC"] if is_indian
        else ["^GSPC", "^VIX"]
    )
    ctx_data: dict[str, dict] = {}
    for sym in tickers:
        try:
            result = provider.get_history(sym, years=2)
            rows = result.rows
            log_rets = {}
            for i in range(1, len(rows)):
                pc, cc = rows[i - 1].close, rows[i].close
                if pc > 0 and cc > 0:
                    log_rets[rows[i].date] = math.log(cc / pc)
            ctx_data[sym] = log_rets
        except Exception as exc:
            log.warning("context %s: %s", sym, exc)
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


# ─── Per-ticker run ───────────────────────────────────────────────────────────

def run_one(
    provider: YahooProvider,
    ticker: str,
    exchange: str,
) -> dict | None:
    """
    Run the full pipeline for one ticker.
    Returns a result dict, or None on failure (with a warning printed).
    """
    try:
        result = provider.get_history(ticker, years=10)
        raw_rows = list(result.rows)
        currency = result.info.currency
    except Exception as exc:
        print(f"  SKIP {ticker}: fetch failed — {exc}", file=sys.stderr)
        return None

    try:
        cleaned = validate(ticker, raw_rows)
    except InsufficientHistoryError as exc:
        print(f"  SKIP {ticker}: {exc}", file=sys.stderr)
        return None
    except Exception as exc:
        print(f"  SKIP {ticker}: validation error — {exc}", file=sys.stderr)
        return None

    try:
        ctx = _fetch_context(provider, exchange)
    except Exception:
        ctx = None

    split_suspects = set(cleaned.split_suspect_dates)
    try:
        fm = build_features(cleaned.rows, exclude_dates=split_suspects,
                            context=ctx, exchange=exchange)
        tr = train_and_evaluate(fm)
    except Exception as exc:
        print(f"  SKIP {ticker}: training error — {exc}", file=sys.stderr)
        return None

    # Reconstruct closes for train-window baseline
    all_closes = _reconstruct_closes(fm.y, fm.last_close, len(fm.y))
    train_end_idx = max(5, int(math.floor(len(fm.y) * 0.70)))
    train_actuals     = all_closes[:train_end_idx]
    train_prev_closes = [
        all_closes[i - 1] if i > 0 else all_closes[0]
        for i in range(train_end_idx)
    ]

    try:
        m = compute_metrics(
            test_dates=tr.test_dates,
            test_actuals=tr.test_actuals,
            test_predictions=tr.test_predictions,
            test_prev_closes=tr.test_prev_closes,
            train_actuals=train_actuals,
            train_prev_closes=train_prev_closes,
        )
    except Exception as exc:
        print(f"  SKIP {ticker}: metrics error — {exc}", file=sys.stderr)
        return None

    return {
        "ticker":              ticker,
        "exchange":            exchange,
        "currency":            currency,
        "n_test_days":         m.n_test_days,
        "chosen_model":        tr.chosen_model,
        "model_version":       tr.model_version,
        "model_directional":   m.directional_accuracy,
        "model_mape":          m.mape,
        "model_rmse":          m.rmse,
        "naive_mape":          m.baseline_mape,
        "naive_rmse":          m.baseline_rmse,
        "baseline_directional": m.baseline_directional,
        "beats_baseline":      m.beats_baseline,
    }


# ─── Table printer ────────────────────────────────────────────────────────────

def _print_table(rows: list[dict]) -> None:
    hdr = (
        f"{'Ticker':<18} {'Exch':<7} {'N':>5} {'Model':<10} "
        f"{'DA%':>6} {'MAPE%':>7} {'RMSE':>12} "
        f"{'nMAPE%':>7} {'nRMSE':>12} {'Beats':>5}"
    )
    sep = "─" * len(hdr)
    print(sep)
    print(hdr)
    print(sep)
    for r in rows:
        # Format RMSE in currency-appropriate locale.
        def fmt_rmse(v: float) -> str:
            return f"{v:>12,.2f}" if r["currency"] == "INR" else f"{v:>12.4f}"

        beats = "✓" if r["beats_baseline"] else "✗"
        print(
            f"{r['ticker']:<18} {r['exchange']:<7} {r['n_test_days']:>5} "
            f"{r['chosen_model']:<10} "
            f"{r['model_directional']:>6.1f} {r['model_mape']:>7.4f} "
            f"{fmt_rmse(r['model_rmse'])} "
            f"{r['naive_mape']:>7.4f} {fmt_rmse(r['naive_rmse'])} "
            f"{beats:>5}"
        )
    print(sep)

    # Summary
    beats_count = sum(1 for r in rows if r["beats_baseline"])
    total = len(rows)
    avg_da  = sum(r["model_directional"] for r in rows) / total if total else 0
    avg_mape = sum(r["model_mape"] for r in rows) / total if total else 0
    print(f"\nSummary: {beats_count}/{total} tickers beat the naive baseline.")
    print(f"Mean directional accuracy: {avg_da:.1f}%")
    print(f"Mean MAPE: {avg_mape:.4f}%")


# ─── Main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="StockVision Pro benchmark harness")
    parser.add_argument(
        "--no-db", action="store_true",
        help="Print results without writing to Supabase.",
    )
    args = parser.parse_args()

    if not args.no_db:
        # Fail early if Supabase env vars are missing.
        if not os.environ.get("SUPABASE_URL") or not os.environ.get("SUPABASE_SERVICE_ROLE_KEY"):
            print(
                "ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.\n"
                "       Run with --no-db to skip database writes.",
                file=sys.stderr,
            )
            sys.exit(1)
        import db as db_module

    provider = YahooProvider()
    results: list[dict] = []

    total = len(UNIVERSE)
    for idx, (ticker, exchange) in enumerate(UNIVERSE, 1):
        print(f"[{idx:02d}/{total}] {ticker} ({exchange}) ...", end="  ", flush=True)
        row = run_one(provider, ticker, exchange)
        if row is None:
            print("SKIPPED")
            continue
        results.append(row)
        beats = "✓ beats naive" if row["beats_baseline"] else "✗ does not beat"
        print(
            f"DA={row['model_directional']:.1f}%  "
            f"MAPE={row['model_mape']:.4f}%  "
            f"RMSE={row['model_rmse']:.4f}  "
            f"chosen={row['chosen_model']}  {beats}"
        )

        if not args.no_db:
            try:
                db_module.insert_benchmark(
                    model_version=row["model_version"],
                    ticker=row["ticker"],
                    exchange=row["exchange"],
                    currency=row["currency"],
                    n_test_days=row["n_test_days"],
                    model_directional=row["model_directional"],
                    model_mape=row["model_mape"],
                    model_rmse=row["model_rmse"],
                    naive_mape=row["naive_mape"],
                    naive_rmse=row["naive_rmse"],
                    baseline_directional=row["baseline_directional"],
                    chosen_model=row["chosen_model"],
                )
            except Exception as exc:
                print(f"  WARNING: DB write failed for {ticker}: {exc}", file=sys.stderr)

    print()
    if results:
        _print_table(results)
    else:
        print("No tickers completed successfully.")


if __name__ == "__main__":
    main()
