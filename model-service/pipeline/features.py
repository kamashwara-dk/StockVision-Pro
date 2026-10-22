"""
pipeline/features.py — Feature engineering (spec R3).

All features for predicting day t are constructed using only data
available through day t-1. There is no look-ahead anywhere in this module.

Features produced (per row, where row i predicts close[i]):
  - log_ret_lag_{1,2,3,5,10,20}   : log-return lags
  - rolling_vol_{5,10,20}          : rolling std of log-returns (volatility)
  - rsi_14                         : RSI(14), Wilder's smoothed version
  - sma_ratio_5_20                 : SMA(5) / SMA(20)
  - sma_ratio_10_50                : SMA(10) / SMA(50)
  - vol_zscore_20                  : rolling volume z-score (mean+std from past data)
  - day_of_week                    : 0=Monday … 4=Friday (integer)

Target:
  - log_return                     : log(close[i] / close[i-1])
    The model predicts this; convert back to price via:
      predicted_price = last_actual_close * exp(predicted_log_return)

Rows at the start of the series that cannot have all features computed
(due to the longest lag/window) are dropped from the feature matrix but
the underlying price series is kept intact for computing lagged features
correctly.
"""

from __future__ import annotations

import math
from datetime import date
from typing import NamedTuple, Sequence

import numpy as np

from provider.base import OHLCVRow

# ─── Configuration ────────────────────────────────────────────────────────────

LAG_PERIODS = (1, 2, 3, 5, 10, 20)
VOL_WINDOWS = (5, 10, 20)
RSI_PERIOD = 14
SMA_PAIRS = ((5, 20), (10, 50))
VOL_ZSCORE_WINDOW = 20

FEATURE_NAMES: list[str] = (
    [f"log_ret_lag_{k}" for k in LAG_PERIODS]
    + [f"rolling_vol_{w}" for w in VOL_WINDOWS]
    + ["rsi_14"]
    + [f"sma_ratio_{s}_{l}" for s, l in SMA_PAIRS]
    + ["vol_zscore_20"]
    + ["day_of_week"]
)

# The minimum number of preceding rows needed to compute all features
# for row i. Determined by the longest window/lag used.
_MAX_LOOKBACK = max(
    max(LAG_PERIODS),    # 20 for log-return lags and rolling vol
    max(w for w in VOL_WINDOWS),  # 20
    RSI_PERIOD,          # 14 — RSI needs 14 periods + 1 initial
    max(l for _, l in SMA_PAIRS),  # 50 — SMA(50)
    VOL_ZSCORE_WINDOW,   # 20
)

# We need at least _MAX_LOOKBACK + 1 rows to produce one feature row.
MIN_ROWS_FOR_FEATURES = _MAX_LOOKBACK + 1


class FeatureMatrix(NamedTuple):
    """Output of build_features()."""

    X: np.ndarray           # shape (n_samples, n_features), dtype float64
    y: np.ndarray           # shape (n_samples,), log-returns (targets)
    dates: list[date]       # date of each sample (the day being predicted)
    feature_names: list[str]
    last_close: float       # close price of the last row in *rows*
    last_date: date         # date of the last row in *rows*


def build_features(
    rows: Sequence[OHLCVRow],
    exclude_dates: set[date] | None = None,
) -> FeatureMatrix:
    """
    Build the feature matrix from cleaned OHLCV rows.

    Args:
        rows:           Cleaned, sorted OHLCV rows (from validate.py).
        exclude_dates:  Dates to drop from the output matrix (e.g. split
                        suspects). The underlying series is kept intact so
                        that lags and rolling windows remain accurate; these
                        rows are simply not included in X/y/dates.

    Returns:
        FeatureMatrix ready for chronological train/test splitting.
    """
    if exclude_dates is None:
        exclude_dates = set()

    n = len(rows)
    closes = np.array([r.close for r in rows], dtype=np.float64)
    volumes = np.array([r.volume for r in rows], dtype=np.float64)
    dates = [r.date for r in rows]

    # ── Log returns ───────────────────────────────────────────────────────────
    # log_ret[i] = log(close[i] / close[i-1]);  log_ret[0] = 0.0 (no prior)
    log_ret = np.zeros(n, dtype=np.float64)
    for i in range(1, n):
        if closes[i - 1] > 0 and closes[i] > 0:
            log_ret[i] = math.log(closes[i] / closes[i - 1])

    # ── RSI(14) using Wilder's smoothing ──────────────────────────────────────
    # Computed from log_ret to stay scale-invariant.
    rsi = _compute_rsi(log_ret, RSI_PERIOD)

    # ── SMAs ─────────────────────────────────────────────────────────────────
    # Each sma[i] uses only close[0..i].
    smas: dict[int, np.ndarray] = {}
    for window in {s for pair in SMA_PAIRS for s in pair}:
        smas[window] = _rolling_mean(closes, window)

    # ── Rolling volatility (std of log_ret) ──────────────────────────────────
    # vol[i] uses log_ret[i-window+1 .. i-1] (past window, NOT including i).
    vols: dict[int, np.ndarray] = {}
    for w in VOL_WINDOWS:
        vols[w] = _rolling_std_past(log_ret, w)

    # ── Volume z-score ────────────────────────────────────────────────────────
    # z[i] = (vol[i] - mean(vol[i-W..i-1])) / std(vol[i-W..i-1])
    # Uses only past W observations, computed at the start of each bar.
    vol_zscore = _rolling_zscore_past(volumes, VOL_ZSCORE_WINDOW)

    # ── Assemble feature rows ─────────────────────────────────────────────────
    # We can only produce a feature row for index i if all lookback windows
    # are valid — i.e. i >= _MAX_LOOKBACK.
    # The target for row i is log_ret[i] (today's log return).
    # All features for row i use only indices 0 .. i-1.

    X_list: list[list[float]] = []
    y_list: list[float] = []
    dates_out: list[date] = []

    for i in range(_MAX_LOOKBACK, n):
        # Skip rows that are excluded (split suspects).
        if dates[i] in exclude_dates:
            continue

        # Log-return lags: lag_k means the return k days ago relative to i.
        # lag_1 = log_ret[i-1], lag_2 = log_ret[i-2], ...
        lag_features = [log_ret[i - k] for k in LAG_PERIODS]

        # Rolling volatility: std of log_ret over past w days (not incl. i).
        vol_features = [vols[w][i] for w in VOL_WINDOWS]

        # RSI at i-1 (last completed bar before the prediction day).
        rsi_feature = rsi[i - 1]

        # SMA ratios at i-1.
        sma_features = [
            (smas[s][i - 1] / smas[l][i - 1])
            if smas[l][i - 1] > 0
            else 1.0
            for s, l in SMA_PAIRS
        ]

        # Volume z-score at i (uses only past volumes).
        vol_z = vol_zscore[i]

        # Day of week (0=Mon … 4=Fri).
        dow = dates[i].weekday()

        row_features = (
            lag_features
            + vol_features
            + [rsi_feature]
            + sma_features
            + [vol_z, dow]
        )

        X_list.append(row_features)
        y_list.append(log_ret[i])
        dates_out.append(dates[i])

    X = np.array(X_list, dtype=np.float64)
    y = np.array(y_list, dtype=np.float64)

    # Replace any NaN / Inf that crept in (e.g. zero-volume days in z-score).
    X = np.nan_to_num(X, nan=0.0, posinf=0.0, neginf=0.0)

    return FeatureMatrix(
        X=X,
        y=y,
        dates=dates_out,
        feature_names=FEATURE_NAMES,
        last_close=float(closes[-1]),
        last_date=dates[-1],
    )


# ─── Internal helpers ──────────────────────────────────────────────────────────

def _rolling_mean(arr: np.ndarray, window: int) -> np.ndarray:
    """
    Rolling mean over the past *window* values including the current value.
    arr[i] uses arr[max(0,i-window+1) .. i].
    Result is 0.0 where fewer than *window* values are available.
    """
    out = np.zeros_like(arr)
    for i in range(len(arr)):
        sl = arr[max(0, i - window + 1): i + 1]
        out[i] = sl.mean() if len(sl) == window else 0.0
    return out


def _rolling_std_past(arr: np.ndarray, window: int) -> np.ndarray:
    """
    Rolling std of *arr* over the past *window* values, NOT including
    the current index. arr[i] uses arr[max(0,i-window) .. i-1].
    Returns 0.0 where fewer than *window* values are available.
    """
    out = np.zeros_like(arr)
    for i in range(window, len(arr)):
        sl = arr[i - window: i]  # exactly *window* past values
        out[i] = float(np.std(sl, ddof=1)) if len(sl) >= 2 else 0.0
    return out


def _rolling_zscore_past(arr: np.ndarray, window: int) -> np.ndarray:
    """
    Rolling z-score of arr[i] relative to the past *window* values
    (arr[i-window .. i-1]).
    Returns 0.0 where insufficient history or zero std.
    """
    out = np.zeros_like(arr, dtype=np.float64)
    for i in range(window, len(arr)):
        past = arr[i - window: i]
        mu = past.mean()
        sigma = past.std(ddof=1)
        if sigma > 0:
            out[i] = (arr[i] - mu) / sigma
    return out


def _compute_rsi(log_ret: np.ndarray, period: int) -> np.ndarray:
    """
    RSI using Wilder's smoothing (exponential moving average).

    rsi[i] is computed from log_ret[1..i] and uses only past data.
    Returns 50.0 as the neutral value for the first *period* rows.
    """
    n = len(log_ret)
    rsi = np.full(n, 50.0, dtype=np.float64)

    if n <= period:
        return rsi

    # Seed: simple average of first *period* gains/losses.
    gains = np.where(log_ret > 0, log_ret, 0.0)
    losses = np.where(log_ret < 0, -log_ret, 0.0)

    avg_gain = gains[1: period + 1].mean()
    avg_loss = losses[1: period + 1].mean()

    if avg_loss == 0:
        rsi[period] = 100.0
    else:
        rs = avg_gain / avg_loss
        rsi[period] = 100.0 - 100.0 / (1.0 + rs)

    # Wilder's smoothing for subsequent values.
    alpha = 1.0 / period
    for i in range(period + 1, n):
        avg_gain = avg_gain * (1 - alpha) + gains[i] * alpha
        avg_loss = avg_loss * (1 - alpha) + losses[i] * alpha
        if avg_loss == 0:
            rsi[i] = 100.0
        else:
            rs = avg_gain / avg_loss
            rsi[i] = 100.0 - 100.0 / (1.0 + rs)

    return rsi
