"""
pipeline/features.py — Feature engineering (spec §5.3).

All features for predicting day t use ONLY data through day t-1.
There is no look-ahead anywhere in this module.

Features produced (per row i, predicting close[i]):
  Price-based
  ──────────
  log_ret_lag_{1,2,3,5,10,20}   log-return lags
  rolling_vol_{5,10,20}          rolling std of log-returns (past window)
  atr_14                         Average True Range / close (past 14 bars)
  rsi_14                         RSI(14), Wilder smoothing, computed at i-1
  macd_signal                    MACD histogram (12-26 EMA diff - 9-EMA signal) at i-1
  bb_position                    (close[i-1] - lower[i-1]) / (upper[i-1] - lower[i-1])
  sma_ratio_5_20                 SMA(5) / SMA(20) at i-1
  sma_ratio_10_50                SMA(10) / SMA(50) at i-1
  vol_zscore_20                  volume z-score vs past 20 sessions
  day_of_week                    integer 0=Mon … 4=Fri

  Market context (pre-aligned — spec §5.3)
  ──────────────────────────────────────────
  For NSE/BSE tickers the market context series are:
    ctx_nsei_ret     previous-day log-return of ^NSEI (Nifty 50)
    ctx_indiavix_ret previous-day ^INDIAVIX return (volatility proxy)
    ctx_spx_ret      previous-day ^GSPC (S&P 500) return — available before
                     Indian market open
  For US tickers:
    ctx_spx_ret      previous-day ^GSPC return
    ctx_vix_ret      previous-day ^VIX return
    ctx_nsei_ret     0.0 (filler so feature count stays constant)
    ctx_indiavix_ret 0.0

  All context features use data at i-1 (the previous bar), so they are
  available before the close at bar i.  The no-future-leakage test in
  tests/test_split.py asserts that every feature row's timestamp ≤ t-1.

Target
──────
  log_return  = log(close[i] / close[i-1])
  Convert to price:  predicted_price = prev_close * exp(predicted_log_return)

Rows at the start of the series where lookback windows cannot be filled are
dropped from the matrix.  The underlying price series is kept intact so
that lags and rolling windows are computed correctly.
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
ATR_PERIOD = 14
MACD_FAST, MACD_SLOW, MACD_SIGNAL = 12, 26, 9
BB_WINDOW = 20
SMA_PAIRS = ((5, 20), (10, 50))
VOL_ZSCORE_WINDOW = 20

FEATURE_NAMES: list[str] = (
    [f"log_ret_lag_{k}" for k in LAG_PERIODS]        # 6
    + [f"rolling_vol_{w}" for w in VOL_WINDOWS]      # 3
    + ["atr_14"]                                      # 1
    + ["rsi_14"]                                      # 1
    + ["macd_signal"]                                 # 1
    + ["bb_position"]                                 # 1
    + [f"sma_ratio_{s}_{l}" for s, l in SMA_PAIRS]   # 2
    + ["vol_zscore_20"]                               # 1
    + ["day_of_week"]                                 # 1
    + ["ctx_nsei_ret"]                                # 1
    + ["ctx_indiavix_ret"]                            # 1
    + ["ctx_spx_ret"]                                 # 1
    + ["ctx_vix_ret"]                                 # 1  (US only; 0.0 for Indian)
)                                                     # = 21 features

# Minimum rows before row i needed to fill the longest window (SMA 50).
# Market context adds no extra lookback (it's a 1-lag shift of external data).
_MAX_LOOKBACK = max(
    max(LAG_PERIODS),                       # 20
    max(VOL_WINDOWS),                       # 20
    RSI_PERIOD,                             # 14
    ATR_PERIOD,                             # 14
    MACD_SLOW + MACD_SIGNAL,               # 35
    BB_WINDOW,                              # 20
    max(l for _, l in SMA_PAIRS),           # 50
    VOL_ZSCORE_WINDOW,                      # 20
)  # = 50

MIN_ROWS_FOR_FEATURES = _MAX_LOOKBACK + 1


class FeatureMatrix(NamedTuple):
    """Output of build_features()."""

    X: np.ndarray           # shape (n_samples, n_features), dtype float64
    y: np.ndarray           # shape (n_samples,), log-returns (targets)
    dates: list[date]       # date of each sample (the prediction day)
    feature_names: list[str]
    last_close: float       # close of the last bar in *rows*
    last_date: date         # date of the last bar in *rows*


def build_features(
    rows: Sequence[OHLCVRow],
    exclude_dates: set[date] | None = None,
    context: "MarketContext | None" = None,
    exchange: str = "US",
) -> FeatureMatrix:
    """
    Build the feature matrix from cleaned OHLCV rows.

    Args:
        rows:           Cleaned, sorted OHLCV rows (from validate.py).
        exclude_dates:  Dates to exclude from X/y/dates output (e.g. split
                        suspects). The underlying series is kept intact so
                        lags and windows remain correct.
        context:        MarketContext object with pre-aligned external series.
                        Pass None to use zeros for all context features.
        exchange:       "NSE", "BSE", or anything else (treated as US).

    Returns:
        FeatureMatrix ready for chronological splitting.
    """
    if exclude_dates is None:
        exclude_dates = set()

    n = len(rows)
    closes = np.array([r.close for r in rows], dtype=np.float64)
    highs  = np.array([r.high  for r in rows], dtype=np.float64)
    lows   = np.array([r.low   for r in rows], dtype=np.float64)
    volumes = np.array([r.volume for r in rows], dtype=np.float64)
    dates_list = [r.date for r in rows]

    # ── Log returns ───────────────────────────────────────────────────────────
    log_ret = np.zeros(n, dtype=np.float64)
    for i in range(1, n):
        if closes[i - 1] > 0 and closes[i] > 0:
            log_ret[i] = math.log(closes[i] / closes[i - 1])

    # ── RSI(14) ───────────────────────────────────────────────────────────────
    rsi = _compute_rsi(log_ret, RSI_PERIOD)

    # ── ATR(14) / close ───────────────────────────────────────────────────────
    atr = _compute_atr_ratio(highs, lows, closes, ATR_PERIOD)

    # ── MACD histogram ────────────────────────────────────────────────────────
    macd_hist = _compute_macd_hist(closes, MACD_FAST, MACD_SLOW, MACD_SIGNAL)

    # ── Bollinger band position ───────────────────────────────────────────────
    bb_pos = _compute_bb_position(closes, BB_WINDOW)

    # ── SMAs ─────────────────────────────────────────────────────────────────
    smas: dict[int, np.ndarray] = {}
    for window in {s for pair in SMA_PAIRS for s in pair}:
        smas[window] = _rolling_mean(closes, window)

    # ── Rolling volatility ────────────────────────────────────────────────────
    vols: dict[int, np.ndarray] = {}
    for w in VOL_WINDOWS:
        vols[w] = _rolling_std_past(log_ret, w)

    # ── Volume z-score ────────────────────────────────────────────────────────
    vol_zscore = _rolling_zscore_past(volumes, VOL_ZSCORE_WINDOW)

    # ── Market context ────────────────────────────────────────────────────────
    is_indian = exchange.upper() in ("NSE", "BSE")

    ctx_nsei    = np.zeros(n, dtype=np.float64)
    ctx_indiavix = np.zeros(n, dtype=np.float64)
    ctx_spx     = np.zeros(n, dtype=np.float64)
    ctx_vix     = np.zeros(n, dtype=np.float64)

    if context is not None:
        date_to_idx: dict[date, int] = {d: i for i, d in enumerate(dates_list)}
        for i, d in enumerate(dates_list):
            if i == 0:
                continue
            prev_d = dates_list[i - 1]
            if is_indian:
                ctx_nsei[i]    = context.nsei_ret.get(prev_d, 0.0)
                ctx_indiavix[i] = context.indiavix_ret.get(prev_d, 0.0)
                ctx_spx[i]     = context.spx_ret.get(prev_d, 0.0)
                # ctx_vix stays 0 for Indian
            else:
                ctx_spx[i]  = context.spx_ret.get(prev_d, 0.0)
                ctx_vix[i]  = context.vix_ret.get(prev_d, 0.0)
                # ctx_nsei / ctx_indiavix stay 0 for US

    # ── Assemble feature rows ─────────────────────────────────────────────────
    X_list: list[list[float]] = []
    y_list: list[float] = []
    dates_out: list[date] = []

    for i in range(_MAX_LOOKBACK, n):
        if dates_list[i] in exclude_dates:
            continue

        # All features use indices 0 .. i-1 (past data only).
        lag_features = [log_ret[i - k] for k in LAG_PERIODS]
        vol_features = [vols[w][i] for w in VOL_WINDOWS]
        atr_feature  = atr[i]          # ATR[i] uses bars i-ATR_PERIOD .. i-1
        rsi_feature  = rsi[i - 1]      # RSI at the last completed bar
        macd_feature = macd_hist[i - 1]
        bb_feature   = bb_pos[i - 1]
        sma_features = [
            (smas[s][i - 1] / smas[l][i - 1]) if smas[l][i - 1] > 0 else 1.0
            for s, l in SMA_PAIRS
        ]
        vol_z   = vol_zscore[i]
        dow     = float(dates_list[i].weekday())

        row_features = (
            lag_features
            + vol_features
            + [atr_feature, rsi_feature, macd_feature, bb_feature]
            + sma_features
            + [vol_z, dow]
            + [ctx_nsei[i], ctx_indiavix[i], ctx_spx[i], ctx_vix[i]]
        )

        X_list.append(row_features)
        y_list.append(log_ret[i])
        dates_out.append(dates_list[i])

    X = np.array(X_list, dtype=np.float64)
    y = np.array(y_list, dtype=np.float64)
    X = np.nan_to_num(X, nan=0.0, posinf=0.0, neginf=0.0)

    return FeatureMatrix(
        X=X,
        y=y,
        dates=dates_out,
        feature_names=FEATURE_NAMES,
        last_close=float(closes[-1]),
        last_date=dates_list[-1],
    )


# ─── MarketContext ─────────────────────────────────────────────────────────────

class MarketContext:
    """
    Pre-aligned external log-return series, keyed by calendar date.

    Each dict maps date → log-return for that date's close.
    When used in build_features(), feature row i reads the value for
    dates_list[i-1] (the previous bar's date), ensuring no look-ahead.
    """

    def __init__(
        self,
        nsei_ret: dict[date, float] | None = None,
        indiavix_ret: dict[date, float] | None = None,
        spx_ret: dict[date, float] | None = None,
        vix_ret: dict[date, float] | None = None,
    ) -> None:
        self.nsei_ret    = nsei_ret    or {}
        self.indiavix_ret = indiavix_ret or {}
        self.spx_ret     = spx_ret     or {}
        self.vix_ret     = vix_ret     or {}


# ─── Internal helpers ──────────────────────────────────────────────────────────

def _rolling_mean(arr: np.ndarray, window: int) -> np.ndarray:
    """Rolling mean using the current and past window-1 values (includes i)."""
    out = np.zeros_like(arr)
    for i in range(len(arr)):
        sl = arr[max(0, i - window + 1): i + 1]
        out[i] = sl.mean() if len(sl) == window else 0.0
    return out


def _rolling_std_past(arr: np.ndarray, window: int) -> np.ndarray:
    """Std of arr[i-window .. i-1] (does NOT include arr[i])."""
    out = np.zeros_like(arr)
    for i in range(window, len(arr)):
        sl = arr[i - window: i]
        out[i] = float(np.std(sl, ddof=1)) if len(sl) >= 2 else 0.0
    return out


def _rolling_zscore_past(arr: np.ndarray, window: int) -> np.ndarray:
    """Z-score of arr[i] relative to arr[i-window .. i-1]."""
    out = np.zeros_like(arr, dtype=np.float64)
    for i in range(window, len(arr)):
        past = arr[i - window: i]
        mu, sigma = past.mean(), past.std(ddof=1)
        if sigma > 0:
            out[i] = (arr[i] - mu) / sigma
    return out


def _compute_rsi(log_ret: np.ndarray, period: int) -> np.ndarray:
    """RSI using Wilder's EMA. rsi[i] uses log_ret[1..i] (past only)."""
    n = len(log_ret)
    rsi = np.full(n, 50.0, dtype=np.float64)
    if n <= period:
        return rsi
    gains  = np.where(log_ret > 0,  log_ret, 0.0)
    losses = np.where(log_ret < 0, -log_ret, 0.0)
    avg_gain = gains[1: period + 1].mean()
    avg_loss = losses[1: period + 1].mean()
    rsi[period] = 100.0 if avg_loss == 0 else 100.0 - 100.0 / (1.0 + avg_gain / avg_loss)
    alpha = 1.0 / period
    for i in range(period + 1, n):
        avg_gain = avg_gain * (1 - alpha) + gains[i] * alpha
        avg_loss = avg_loss * (1 - alpha) + losses[i] * alpha
        rsi[i] = 100.0 if avg_loss == 0 else 100.0 - 100.0 / (1.0 + avg_gain / avg_loss)
    return rsi


def _compute_atr_ratio(
    highs: np.ndarray,
    lows: np.ndarray,
    closes: np.ndarray,
    period: int,
) -> np.ndarray:
    """
    ATR(period) normalised by close: atr[i] uses bars i-period .. i-1.

    True range = max(high-low, |high-prev_close|, |low-prev_close|).
    Returns 0.0 for the first period+1 rows.
    """
    n = len(closes)
    tr = np.zeros(n, dtype=np.float64)
    for i in range(1, n):
        tr[i] = max(
            highs[i] - lows[i],
            abs(highs[i] - closes[i - 1]),
            abs(lows[i] - closes[i - 1]),
        )
    # Rolling mean of TR over past *period* bars (not including current bar).
    out = np.zeros(n, dtype=np.float64)
    for i in range(period + 1, n):
        avg_tr = tr[i - period: i].mean()
        out[i] = avg_tr / closes[i - 1] if closes[i - 1] > 0 else 0.0
    return out


def _ema(arr: np.ndarray, span: int) -> np.ndarray:
    """Exponential moving average with span *span* (multiplier = 2/(span+1))."""
    out = np.zeros_like(arr, dtype=np.float64)
    alpha = 2.0 / (span + 1)
    for i in range(len(arr)):
        if i == 0:
            out[i] = arr[i]
        else:
            out[i] = alpha * arr[i] + (1 - alpha) * out[i - 1]
    return out


def _compute_macd_hist(
    closes: np.ndarray,
    fast: int,
    slow: int,
    signal: int,
) -> np.ndarray:
    """
    MACD histogram = (fast_ema - slow_ema) - signal_ema(fast_ema - slow_ema).

    Returns the histogram series; index i uses only closes[0..i].
    Values before `slow + signal` bars are 0.0.
    """
    fast_ema  = _ema(closes, fast)
    slow_ema  = _ema(closes, slow)
    macd_line = fast_ema - slow_ema
    signal_line = _ema(macd_line, signal)
    hist = macd_line - signal_line
    # Zero out the warm-up period where the EMA is unreliable.
    hist[: slow + signal] = 0.0
    return hist


def _compute_bb_position(closes: np.ndarray, window: int) -> np.ndarray:
    """
    Bollinger Band position: (close - lower) / (upper - lower).

    Uses a rolling window ending at i (inclusive).
    Returns 0.5 (neutral) where the band width is zero.
    """
    out = np.full(len(closes), 0.5, dtype=np.float64)
    for i in range(window - 1, len(closes)):
        sl = closes[i - window + 1: i + 1]
        mu = sl.mean()
        sigma = sl.std(ddof=0)
        if sigma > 0:
            upper = mu + 2 * sigma
            lower = mu - 2 * sigma
            out[i] = (closes[i] - lower) / (upper - lower)
    return out
