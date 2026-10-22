"""
pipeline/validate.py — Data validation rules (spec R2).

Takes a raw list of OHLCVRow objects from the provider and returns a
cleaned list suitable for feature engineering, plus a ValidationReport.

Validation rules applied (each logs a counter):
  V1  Dates are unique and sorted ascending.
  V2  Non-positive close prices are removed.
  V3  No forward-filling; missing sessions are simply absent.
  V4  Gaps longer than 5 consecutive trading days are flagged (not removed).
  V5  Absolute daily log-returns above 40% are flagged as possible split
      artefacts. Those rows are excluded from the training set only if the
      data is unadjusted (we assume auto_adjust=True from yfinance, so we
      log them but do NOT exclude them — the caller may override this).
  V6  Minimum history: 750 trading days.

The returned CleanedData.rows list is the canonical input to features.py.
Rows flagged by V5 are listed in CleanedData.split_suspect_dates; the
training pipeline excludes them.
"""

from __future__ import annotations

import dataclasses
import logging
import math
from datetime import date
from typing import Sequence

from provider.base import OHLCVRow

log = logging.getLogger(__name__)

MIN_TRADING_DAYS = 750
# Gap longer than this many calendar days between consecutive bars is flagged.
GAP_THRESHOLD_TRADING_DAYS = 5
# Absolute log-return above this threshold is flagged as a split suspect.
SPLIT_LOG_RETURN_THRESHOLD = math.log(1.40)  # log(1 + 40%)


class InsufficientHistoryError(Exception):
    """
    Raised when the ticker has fewer than MIN_TRADING_DAYS of clean data.

    The message is shown directly to the user; keep it plain.
    """


@dataclasses.dataclass
class ValidationReport:
    """
    Counts and details from one validation pass. Written to structured logs.
    """

    ticker: str
    input_row_count: int = 0
    duplicate_dates_removed: int = 0
    nonpositive_prices_removed: int = 0
    out_of_order_dates_fixed: int = 0
    gap_count: int = 0          # number of gaps > GAP_THRESHOLD_TRADING_DAYS
    split_suspect_count: int = 0
    final_row_count: int = 0
    data_start: date | None = None
    data_end: date | None = None

    def as_dict(self) -> dict:
        return dataclasses.asdict(self)


@dataclasses.dataclass
class CleanedData:
    rows: list[OHLCVRow]                    # sorted, deduplicated, positive-price
    split_suspect_dates: list[date]         # rows flagged by V5 (not excluded by default)
    report: ValidationReport


def validate(ticker: str, rows: Sequence[OHLCVRow]) -> CleanedData:
    """
    Run all validation rules on *rows* and return CleanedData.

    Raises InsufficientHistoryError if fewer than MIN_TRADING_DAYS clean
    rows remain after validation.

    Args:
        ticker: Symbol string, used only for logging.
        rows:   Raw rows from the provider (may be unsorted or contain duplicates).

    Returns:
        CleanedData with cleaned rows and a ValidationReport.
    """
    report = ValidationReport(ticker=ticker, input_row_count=len(rows))

    # ── V2: Remove non-positive closes ────────────────────────────────────────
    before = len(rows)
    rows = [r for r in rows if r.close > 0.0]
    report.nonpositive_prices_removed = before - len(rows)
    if report.nonpositive_prices_removed:
        log.warning(
            "validate[%s]: removed %d rows with non-positive close",
            ticker,
            report.nonpositive_prices_removed,
        )

    # ── V1: Sort by date, remove duplicates ───────────────────────────────────
    # Sort ascending.
    rows_sorted = sorted(rows, key=lambda r: r.date)
    report.out_of_order_dates_fixed = sum(
        1 for a, b in zip(rows, rows_sorted) if a.date != b.date
    )
    rows = rows_sorted

    # Deduplicate by date: keep the last occurrence (latest data wins).
    seen: dict[date, OHLCVRow] = {}
    for r in rows:
        if r.date in seen:
            report.duplicate_dates_removed += 1
        seen[r.date] = r
    rows = list(seen.values())
    if report.duplicate_dates_removed:
        log.warning(
            "validate[%s]: removed %d duplicate date(s)",
            ticker,
            report.duplicate_dates_removed,
        )

    # ── V4: Flag gaps longer than GAP_THRESHOLD_TRADING_DAYS ─────────────────
    # We count calendar-day gaps that are unusually long. A "normal" weekend
    # is 3 calendar days (Fri → Mon). A gap of >5 calendar days on its own
    # might include a holiday; we look for stretches that skip more than
    # GAP_THRESHOLD_TRADING_DAYS consecutive trading sessions by counting
    # the number of missing bars between consecutive dates.
    # Since we don't have a full exchange calendar here (that's used in
    # main.py for next-trading-day calculation), we approximate by flagging
    # calendar-day gaps > 7 days (5 trading days + weekend buffer).
    CALENDAR_GAP_FLAG = 7  # calendar days
    for i in range(1, len(rows)):
        delta = (rows[i].date - rows[i - 1].date).days
        if delta > CALENDAR_GAP_FLAG:
            report.gap_count += 1
            log.warning(
                "validate[%s]: gap of %d calendar days between %s and %s",
                ticker,
                delta,
                rows[i - 1].date,
                rows[i].date,
            )

    # ── V5: Flag split suspects (absolute log-return > 40%) ───────────────────
    split_suspect_dates: list[date] = []
    for i in range(1, len(rows)):
        prev_close = rows[i - 1].close
        curr_close = rows[i].close
        if prev_close > 0 and curr_close > 0:
            log_ret = abs(math.log(curr_close / prev_close))
            if log_ret > SPLIT_LOG_RETURN_THRESHOLD:
                split_suspect_dates.append(rows[i].date)
                log.warning(
                    "validate[%s]: split suspect on %s "
                    "(log-return=%.4f, prev=%.4f, curr=%.4f)",
                    ticker,
                    rows[i].date,
                    log_ret,
                    prev_close,
                    curr_close,
                )

    report.split_suspect_count = len(split_suspect_dates)

    # ── V6: Minimum history check ─────────────────────────────────────────────
    report.final_row_count = len(rows)
    if rows:
        report.data_start = rows[0].date
        report.data_end = rows[-1].date

    log.info("validate[%s]: report=%s", ticker, report.as_dict())

    if len(rows) < MIN_TRADING_DAYS:
        raise InsufficientHistoryError(
            "This stock does not have enough trading history for a reliable evaluation."
        )

    return CleanedData(
        rows=rows,
        split_suspect_dates=split_suspect_dates,
        report=report,
    )
