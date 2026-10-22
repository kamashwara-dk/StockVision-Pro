"""
pipeline/train.py — Training, walk-forward evaluation, and final forecast (spec R3).

Design:
  1. Chronological split: first 80% of feature rows → train, last 20% → test.
     No shuffling anywhere. Every test date is strictly after every train date.

  2. Walk-forward evaluation on the test window:
     - Expanding window: model refit every REFIT_EVERY trading days.
     - Each test-day prediction uses only the latest model fitted on data
       strictly before that day.
     - Hyperparameter selection: small fixed grid with TimeSeriesSplit CV
       inside the training window only. The test window is never touched.
     - Scaler (StandardScaler) is fit on the current training window only,
       inside each refit. Never fit on test data.

  3. Final forecast: refit on ALL available rows, predict the next trading day.

  4. Uncertainty: 80% interval from 10th and 90th percentiles of walk-forward
     residuals (actual_close - predicted_close). Coverage = fraction of test
     days where actual fell inside the interval.

  5. Reproducibility: RANDOM_STATE fixed. model_version = git_sha + param_hash.

  6. Target runtime: under 60 seconds per ticker.

The module returns a TrainingResult dataclass consumed by metrics.py and
then written to Supabase by db.py.
"""

from __future__ import annotations

import dataclasses
import hashlib
import json
import logging
import math
import os
import subprocess
from datetime import date

import numpy as np
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.model_selection import GridSearchCV, TimeSeriesSplit
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from pipeline.features import FeatureMatrix

log = logging.getLogger(__name__)

# ─── Configuration ────────────────────────────────────────────────────────────

RANDOM_STATE = 42
TRAIN_FRACTION = 0.80
REFIT_EVERY = 20          # retrain every N test days

# Small hyperparameter grid; kept deliberately small to stay under 60 s.
PARAM_GRID = {
    "regressor__max_iter": [200, 400],
    "regressor__max_depth": [3, 5],
    "regressor__learning_rate": [0.05, 0.1],
    "regressor__min_samples_leaf": [20],
    "regressor__l2_regularization": [0.0, 1.0],
}

# TimeSeriesSplit folds used only inside the training window.
CV_FOLDS = 5


# ─── Result dataclass ─────────────────────────────────────────────────────────

@dataclasses.dataclass
class TrainingResult:
    """Complete output of one training + evaluation + forecast run."""

    # Date ranges
    train_start: date
    train_end: date
    test_start: date
    test_end: date
    n_test_days: int

    # Last known close and predicted next-day close (in listing currency).
    last_close: float
    predicted_close: float

    # 80% prediction interval (in listing currency).
    interval_low: float
    interval_high: float
    # Fraction of test days where actual fell inside the interval.
    interval_coverage: float

    # Walk-forward test predictions aligned with actuals.
    test_dates: list[date]
    test_actuals: list[float]       # actual close prices
    test_predictions: list[float]   # predicted close prices (from log-return)
    test_prev_closes: list[float]   # close price on the day before each test day

    # Model version string for the forecast_runs table.
    model_version: str

    # Best hyperparameters found (for logging).
    best_params: dict

    # Next trading date (for labelling the forecast point on the chart).
    next_trading_date: date | None = None


# ─── Public entry point ───────────────────────────────────────────────────────

def train_and_evaluate(
    fm: FeatureMatrix,
    next_trading_date: date | None = None,
    refit_every: int = REFIT_EVERY,
) -> TrainingResult:
    """
    Run the full training + walk-forward evaluation pipeline.

    Args:
        fm:                 FeatureMatrix from features.build_features().
        next_trading_date:  The trading date being forecast (for labelling).
        refit_every:        Refit frequency in trading days (default 20).

    Returns:
        TrainingResult with all fields populated.
    """
    X, y, dates = fm.X, fm.y, fm.dates
    n = len(X)

    if n < 2:
        raise ValueError(
            "Insufficient feature rows to split into train/test. "
            "This should have been caught by validate.py."
        )

    split_idx = int(math.floor(n * TRAIN_FRACTION))
    if split_idx < CV_FOLDS + 1:
        # Not enough training rows for CV; clamp to ensure at least
        # CV_FOLDS + 1 training rows.
        split_idx = CV_FOLDS + 1
    if split_idx >= n:
        split_idx = n - 1

    X_train_full = X[:split_idx]
    y_train_full = y[:split_idx]
    X_test = X[split_idx:]
    y_test = y[split_idx:]
    dates_train = dates[:split_idx]
    dates_test = dates[split_idx:]

    log.info(
        "train_and_evaluate: n_total=%d n_train=%d n_test=%d",
        n,
        split_idx,
        len(X_test),
    )

    # ── Step 1: Hyperparameter selection on training window only ──────────────
    best_params = _select_hyperparams(X_train_full, y_train_full)
    model_version = _compute_model_version(best_params)
    log.info("train_and_evaluate: best_params=%s model_version=%s", best_params, model_version)

    # ── Step 2: Walk-forward evaluation on test window ────────────────────────
    test_log_return_preds: list[float] = []
    current_train_end = split_idx  # exclusive upper bound into X/y

    # Fit the initial model on the full training window.
    current_model = _fit_model(X[:current_train_end], y[:current_train_end], best_params)
    refit_counter = 0

    for i in range(len(X_test)):
        # Predict using the model fitted on data BEFORE this test row.
        pred_log_ret = float(current_model.predict(X_test[i: i + 1])[0])
        test_log_return_preds.append(pred_log_ret)

        refit_counter += 1
        # Expanding window: add this test row to the training set and refit
        # every REFIT_EVERY steps.
        if refit_counter >= refit_every:
            current_train_end = split_idx + i + 1
            current_model = _fit_model(
                X[:current_train_end], y[:current_train_end], best_params
            )
            refit_counter = 0

    # ── Step 3: Convert log-return predictions to close prices ────────────────
    # To convert prediction for test day i:
    #   predicted_close[i] = prev_close[i] * exp(pred_log_ret[i])
    # prev_close[i] is the actual close on the day before test day i.
    # That's the last entry of the training-window closes OR the previous
    # test-day actual (we use actuals, not recursive predictions, for each
    # test day — each model only predicts one step ahead from actual data).

    # Reconstruct actual close prices from log_returns and the known initial
    # close. We need the close price just before the test window starts.
    # The last training row's close = fm.last_close only if split_idx == n-1.
    # We must reconstruct from the full close series.
    # fm.y[i] = log(close[i] / close[i-1]) in feature-row space.
    # Reconstruct close prices for all feature rows.
    all_closes = _reconstruct_closes_from_log_returns(y, fm.last_close, n)

    # all_closes[i] is the actual close for feature-row i.
    # For test row i (global index split_idx + i):
    #   prev_close = all_closes[split_idx + i - 1]
    test_prev_closes: list[float] = []
    test_actual_closes: list[float] = []
    for i in range(len(X_test)):
        global_i = split_idx + i
        test_prev_closes.append(all_closes[global_i - 1])
        test_actual_closes.append(all_closes[global_i])

    test_predicted_closes: list[float] = [
        prev * math.exp(log_ret)
        for prev, log_ret in zip(test_prev_closes, test_log_return_preds)
    ]

    # ── Step 4: Prediction interval from walk-forward residuals ───────────────
    # Residuals are in price space: actual - predicted.
    residuals = [
        a - p for a, p in zip(test_actual_closes, test_predicted_closes)
    ]
    p10 = float(np.percentile(residuals, 10))
    p90 = float(np.percentile(residuals, 90))

    # The interval for the final forecast point.
    # Final forecast uses the model fit on all data (step 5 below);
    # the interval is the last_close +/- percentile bounds.
    # (We compute it here to populate interval_low/high consistently.)
    # It will be recomputed relative to predicted_close after step 5.

    # ── Step 5: Final forecast — fit on ALL available data ────────────────────
    final_model = _fit_model(X, y, best_params)
    # Predict log-return for the next trading day using the last feature row.
    next_log_ret = float(final_model.predict(X[-1:, :])[0])
    predicted_close = fm.last_close * math.exp(next_log_ret)

    interval_low = predicted_close + p10
    interval_high = predicted_close + p90

    # ── Step 6: Measured interval coverage on test window ─────────────────────
    in_interval = sum(
        1
        for actual, pred in zip(test_actual_closes, test_predicted_closes)
        if (pred + p10) <= actual <= (pred + p90)
    )
    interval_coverage = in_interval / len(test_actual_closes) if test_actual_closes else 0.0

    return TrainingResult(
        train_start=dates_train[0],
        train_end=dates_train[-1],
        test_start=dates_test[0],
        test_end=dates_test[-1],
        n_test_days=len(dates_test),
        last_close=fm.last_close,
        predicted_close=predicted_close,
        interval_low=interval_low,
        interval_high=interval_high,
        interval_coverage=interval_coverage,
        test_dates=list(dates_test),
        test_actuals=test_actual_closes,
        test_predictions=test_predicted_closes,
        test_prev_closes=test_prev_closes,
        model_version=model_version,
        best_params=best_params,
        next_trading_date=next_trading_date,
    )


# ─── Internal helpers ──────────────────────────────────────────────────────────

def _make_pipeline(params: dict) -> Pipeline:
    """Build a sklearn Pipeline with StandardScaler + HistGradientBoostingRegressor."""
    return Pipeline([
        ("scaler", StandardScaler()),
        ("regressor", HistGradientBoostingRegressor(
            random_state=RANDOM_STATE,
            **{k.replace("regressor__", ""): v for k, v in params.items()},
        )),
    ])


def _select_hyperparams(X_train: np.ndarray, y_train: np.ndarray) -> dict:
    """
    Run GridSearchCV with TimeSeriesSplit on the training window only.
    Returns the best parameter dict (including 'regressor__' prefixes).
    Falls back to default params if the grid search fails.
    """
    if len(X_train) < CV_FOLDS * 2:
        log.warning(
            "_select_hyperparams: not enough data for CV (%d rows), "
            "using default params",
            len(X_train),
        )
        return _default_params()

    tscv = TimeSeriesSplit(n_splits=CV_FOLDS)
    base_pipeline = Pipeline([
        ("scaler", StandardScaler()),
        ("regressor", HistGradientBoostingRegressor(random_state=RANDOM_STATE)),
    ])

    try:
        gs = GridSearchCV(
            estimator=base_pipeline,
            param_grid=PARAM_GRID,
            cv=tscv,
            scoring="neg_root_mean_squared_error",
            refit=False,
            n_jobs=-1,
        )
        gs.fit(X_train, y_train)
        return dict(gs.best_params_)
    except Exception as exc:
        log.warning("_select_hyperparams: GridSearchCV failed (%s), using defaults", exc)
        return _default_params()


def _default_params() -> dict:
    return {
        "regressor__max_iter": 200,
        "regressor__max_depth": 3,
        "regressor__learning_rate": 0.1,
        "regressor__min_samples_leaf": 20,
        "regressor__l2_regularization": 0.0,
    }


def _fit_model(X: np.ndarray, y: np.ndarray, params: dict) -> Pipeline:
    """Fit a StandardScaler + HistGradientBoostingRegressor pipeline."""
    pipeline = _make_pipeline(params)
    pipeline.fit(X, y)
    return pipeline


def _compute_model_version(params: dict) -> str:
    """
    Compute model_version = <git_sha>-<param_hash>.

    Falls back to 'unknown' for git sha if not in a git repo.
    """
    # Git commit hash.
    try:
        git_sha = subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"],
            stderr=subprocess.DEVNULL,
        ).decode().strip()
    except Exception:
        git_sha = "unknown"

    # Hash of the hyperparameter dict for reproducibility.
    param_str = json.dumps(params, sort_keys=True)
    param_hash = hashlib.sha256(param_str.encode()).hexdigest()[:8]

    return f"{git_sha}-{param_hash}"


def _reconstruct_closes_from_log_returns(
    log_rets: np.ndarray,
    last_close: float,
    n: int,
) -> list[float]:
    """
    Reconstruct the full close-price series from log-returns.

    log_rets[i] = log(close[i] / close[i-1]) for i >= 1.
    log_rets[0] = 0 (no prior close in the feature window).

    We know the final close (last_close = close[n-1]). Reconstruct backwards.
    """
    closes = [0.0] * n
    closes[-1] = last_close
    for i in range(n - 2, -1, -1):
        if log_rets[i + 1] != 0.0:
            closes[i] = closes[i + 1] / math.exp(log_rets[i + 1])
        else:
            closes[i] = closes[i + 1]
    return closes
