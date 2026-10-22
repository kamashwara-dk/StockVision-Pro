"""
pipeline/train.py — Three-way split, candidate selection, walk-forward evaluation.

Design (spec §5):
  Split   first 70% rows → train, next 10% → validation, last 20% → test.
          Strictly chronological; no shuffling anywhere.

  Candidates evaluated on the VALIDATION window only:
    - naive (P = prev_close)
    - ridge / elastic net
    - HistGradientBoostingRegressor
    - RandomForestRegressor
    - simple average ensemble of the best two

  Selection: lowest validation RMSE wins.
             If no candidate beats naive on val, the naive fallback is used
             and the run is flagged with chosen_model='naive'.

  Shrinkage: after candidate selection, fit one scalar α on validation that
             shrinks predicted log-returns toward zero:
               adjusted_pred = α × model_pred + (1 - α) × 0
             Apply only if it lowers val RMSE.

  Evaluation: expanding-window walk-forward over the TEST window, refitting
              every REFIT_EVERY trading days with the chosen configuration.

  Final forecast: refit on ALL data; predict next trading day.

  Interval: 80% interval from 10th/90th percentiles of test-window residuals.
            Measured coverage on the test window is stored.

  model_version = git_sha + param_hash.
"""

from __future__ import annotations

import dataclasses
import hashlib
import json
import logging
import math
import subprocess
from datetime import date

import numpy as np
from sklearn.ensemble import HistGradientBoostingRegressor, RandomForestRegressor
from sklearn.linear_model import ElasticNetCV, RidgeCV
from sklearn.model_selection import TimeSeriesSplit
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from pipeline.features import FeatureMatrix

log = logging.getLogger(__name__)

# ─── Configuration ────────────────────────────────────────────────────────────

RANDOM_STATE   = 42
TRAIN_FRAC     = 0.70   # first 70%  → train
VAL_FRAC       = 0.10   # next  10%  → validation (candidate selection)
# last 20% → test (evaluation only; never used for any choice)

REFIT_EVERY    = 20     # retrain every N test-window days (configurable)
CV_FOLDS       = 5      # TimeSeriesSplit folds inside train block

# HistGradientBoosting parameter grid (evaluated with TimeSeriesSplit on train).
HGB_PARAM_GRID: dict = {
    "max_iter":         [200, 400],
    "max_depth":        [3, 5],
    "learning_rate":    [0.05, 0.1],
    "min_samples_leaf": [10, 20],
    "l2_regularization": [0.0, 1.0],
}

# RandomForest parameter grid.
RF_PARAM_GRID: dict = {
    "n_estimators": [200, 400],
    "max_depth":    [5, 8, None],
    "min_samples_leaf": [10, 20],
}

# ─── Result dataclass ─────────────────────────────────────────────────────────

@dataclasses.dataclass
class TrainingResult:
    """Complete output of one run."""

    train_start:   date
    train_end:     date
    val_start:     date
    val_end:       date
    test_start:    date
    test_end:      date
    n_test_days:   int

    last_close:    float
    predicted_close: float

    interval_low:      float
    interval_high:     float
    interval_coverage: float

    test_dates:         list[date]
    test_actuals:       list[float]
    test_predictions:   list[float]
    test_prev_closes:   list[float]

    model_version: str
    chosen_model:  str            # 'hgb', 'ridge', 'rf', 'ensemble', 'naive'
    best_params:   dict

    next_trading_date: date | None = None


# ─── Public entry point ───────────────────────────────────────────────────────

def train_and_evaluate(
    fm: FeatureMatrix,
    next_trading_date: date | None = None,
    refit_every: int = REFIT_EVERY,
) -> TrainingResult:
    """
    Run the full pipeline:
      1. Three-way chronological split.
      2. Candidate selection on validation window.
      3. Shrinkage scalar on validation.
      4. Walk-forward evaluation on test window.
      5. Final forecast on all data.

    Args:
        fm:                 FeatureMatrix from features.build_features().
        next_trading_date:  The date being forecast (for labelling).
        refit_every:        Walk-forward refit frequency (trading days).

    Returns:
        TrainingResult with all fields populated.
    """
    X, y, dates = fm.X, fm.y, fm.dates
    n = len(X)

    if n < 10:
        raise ValueError("Insufficient feature rows for a meaningful evaluation.")

    # ── Step 1: Chronological three-way split ─────────────────────────────────
    train_end_idx = max(CV_FOLDS + 2, int(math.floor(n * TRAIN_FRAC)))
    val_end_idx   = max(train_end_idx + 2, int(math.floor(n * (TRAIN_FRAC + VAL_FRAC))))
    if val_end_idx >= n:
        val_end_idx = n - 1
    if train_end_idx >= val_end_idx:
        train_end_idx = val_end_idx - 1

    X_train = X[:train_end_idx]
    y_train = y[:train_end_idx]
    X_val   = X[train_end_idx:val_end_idx]
    y_val   = y[train_end_idx:val_end_idx]
    X_test  = X[val_end_idx:]
    y_test  = y[val_end_idx:]

    dates_train = dates[:train_end_idx]
    dates_val   = dates[train_end_idx:val_end_idx]
    dates_test  = dates[val_end_idx:]

    log.info(
        "split: n_total=%d n_train=%d n_val=%d n_test=%d",
        n, train_end_idx, val_end_idx - train_end_idx, len(X_test),
    )

    # ── Step 2: Reconstruct all close prices ──────────────────────────────────
    all_closes = _reconstruct_closes(y, fm.last_close, n)

    # Prev closes for val and test.
    val_prev   = [all_closes[train_end_idx + i - 1] for i in range(len(X_val))]
    val_actual = [all_closes[train_end_idx + i]     for i in range(len(X_val))]
    test_prev  = [all_closes[val_end_idx + i - 1]   for i in range(len(X_test))]
    test_actual = [all_closes[val_end_idx + i]      for i in range(len(X_test))]

    # ── Step 3: Candidate selection on VALIDATION window ──────────────────────
    candidates = _evaluate_candidates(
        X_train, y_train,
        X_val, val_prev, val_actual,
    )

    # Pick candidate with lowest val RMSE.
    best_name, best_rmse = min(candidates.items(), key=lambda kv: kv[1]["val_rmse"])
    chosen_model = best_name
    best_params  = candidates[best_name]["params"]

    log.info(
        "candidate selection: best=%s val_rmse=%.6f", best_name, best_rmse
    )

    # ── Step 4: Shrinkage scalar on validation ────────────────────────────────
    alpha = _fit_shrinkage(
        X_train, y_train, X_val, val_prev, val_actual,
        best_name, best_params,
    )
    log.info("shrinkage alpha=%.4f", alpha)

    # ── Step 5: Walk-forward evaluation on TEST window ────────────────────────
    test_preds_log: list[float] = []
    current_end = val_end_idx
    current_model = _fit_candidate(best_name, best_params,
                                   X[:current_end], y[:current_end])
    refit_counter = 0

    for i in range(len(X_test)):
        raw_lr = float(current_model.predict(X_test[i: i + 1])[0])
        # Apply shrinkage.
        shrunk_lr = alpha * raw_lr
        test_preds_log.append(shrunk_lr)

        refit_counter += 1
        if refit_counter >= refit_every:
            current_end = val_end_idx + i + 1
            current_model = _fit_candidate(
                best_name, best_params, X[:current_end], y[:current_end]
            )
            refit_counter = 0

    test_predicted_closes = [
        prev * math.exp(lr)
        for prev, lr in zip(test_prev, test_preds_log)
    ]

    # ── Step 6: Prediction interval ───────────────────────────────────────────
    residuals = [a - p for a, p in zip(test_actual, test_predicted_closes)]
    p10 = float(np.percentile(residuals, 10))
    p90 = float(np.percentile(residuals, 90))

    # ── Step 7: Final forecast (refit on ALL data) ────────────────────────────
    final_model = _fit_candidate(best_name, best_params, X, y)
    next_lr     = float(final_model.predict(X[-1:, :])[0])
    next_lr_shrunk = alpha * next_lr
    predicted_close = fm.last_close * math.exp(next_lr_shrunk)

    interval_low  = predicted_close + p10
    interval_high = predicted_close + p90

    # Measured coverage on test window.
    in_interval = sum(
        1 for act, pred in zip(test_actual, test_predicted_closes)
        if (pred + p10) <= act <= (pred + p90)
    )
    coverage = in_interval / len(test_actual) if test_actual else 0.0

    model_version = _compute_model_version(best_name, best_params, alpha)

    return TrainingResult(
        train_start=dates_train[0],
        train_end=dates_train[-1],
        val_start=dates_val[0],
        val_end=dates_val[-1],
        test_start=dates_test[0],
        test_end=dates_test[-1],
        n_test_days=len(dates_test),
        last_close=fm.last_close,
        predicted_close=predicted_close,
        interval_low=interval_low,
        interval_high=interval_high,
        interval_coverage=coverage,
        test_dates=list(dates_test),
        test_actuals=test_actual,
        test_predictions=test_predicted_closes,
        test_prev_closes=test_prev,
        model_version=model_version,
        chosen_model=chosen_model,
        best_params=best_params,
        next_trading_date=next_trading_date,
    )


# ─── Candidate definitions ────────────────────────────────────────────────────

def _evaluate_candidates(
    X_train: np.ndarray,
    y_train: np.ndarray,
    X_val: np.ndarray,
    val_prev: list[float],
    val_actual: list[float],
) -> dict[str, dict]:
    """
    Evaluate each candidate on the validation window.
    Returns a dict: candidate_name → {'val_rmse': float, 'params': dict}.
    """
    results: dict[str, dict] = {}

    # ── Naive baseline (P = prev_close, log_return = 0) ───────────────────────
    naive_preds = [p for p in val_prev]
    results["naive"] = {
        "val_rmse": _rmse(val_actual, naive_preds),
        "params": {},
    }

    # ── Ridge / ElasticNet ────────────────────────────────────────────────────
    try:
        ridge_model, ridge_params = _fit_ridge(X_train, y_train)
        ridge_log_preds = ridge_model.predict(X_val).tolist()
        ridge_price_preds = [
            p * math.exp(lr) for p, lr in zip(val_prev, ridge_log_preds)
        ]
        results["ridge"] = {
            "val_rmse": _rmse(val_actual, ridge_price_preds),
            "params": ridge_params,
        }
    except Exception as exc:
        log.warning("ridge candidate failed: %s", exc)

    # ── HistGradientBoosting ──────────────────────────────────────────────────
    try:
        hgb_model, hgb_params = _fit_hgb(X_train, y_train)
        hgb_log_preds = hgb_model.predict(X_val).tolist()
        hgb_price_preds = [
            p * math.exp(lr) for p, lr in zip(val_prev, hgb_log_preds)
        ]
        results["hgb"] = {
            "val_rmse": _rmse(val_actual, hgb_price_preds),
            "params": hgb_params,
        }
    except Exception as exc:
        log.warning("hgb candidate failed: %s", exc)

    # ── Random Forest ─────────────────────────────────────────────────────────
    try:
        rf_model, rf_params = _fit_rf(X_train, y_train)
        rf_log_preds = rf_model.predict(X_val).tolist()
        rf_price_preds = [
            p * math.exp(lr) for p, lr in zip(val_prev, rf_log_preds)
        ]
        results["rf"] = {
            "val_rmse": _rmse(val_actual, rf_price_preds),
            "params": rf_params,
        }
    except Exception as exc:
        log.warning("rf candidate failed: %s", exc)

    # ── Ensemble: average of the best two non-naive candidates ────────────────
    try:
        non_naive = {k: v for k, v in results.items() if k != "naive"}
        if len(non_naive) >= 2:
            sorted_cands = sorted(non_naive.items(), key=lambda kv: kv[1]["val_rmse"])
            top2 = [sorted_cands[0][0], sorted_cands[1][0]]
            ensemble_preds_log: dict[str, list[float]] = {}
            for name in top2:
                m, p = _fit_for_name(name, results[name]["params"], X_train, y_train)
                ensemble_preds_log[name] = m.predict(X_val).tolist()
            avg_log = [
                (ensemble_preds_log[top2[0]][i] + ensemble_preds_log[top2[1]][i]) / 2
                for i in range(len(X_val))
            ]
            ens_price = [
                p * math.exp(lr) for p, lr in zip(val_prev, avg_log)
            ]
            results["ensemble"] = {
                "val_rmse": _rmse(val_actual, ens_price),
                "params": {"members": top2,
                           top2[0]: results[top2[0]]["params"],
                           top2[1]: results[top2[1]]["params"]},
            }
    except Exception as exc:
        log.warning("ensemble candidate failed: %s", exc)

    log.info(
        "candidate_rmse: %s",
        {k: round(v["val_rmse"], 6) for k, v in results.items()},
    )
    return results


def _fit_for_name(
    name: str,
    params: dict,
    X: np.ndarray,
    y: np.ndarray,
) -> tuple:
    """Dispatch to the correct fit function by name."""
    if name == "ridge":
        return _fit_ridge(X, y)
    if name == "hgb":
        return _fit_hgb(X, y, params)
    if name == "rf":
        return _fit_rf(X, y, params)
    raise ValueError(f"Unknown candidate: {name}")


def _fit_candidate(
    name: str,
    params: dict,
    X: np.ndarray,
    y: np.ndarray,
) -> "EnsemblePredictor | Pipeline":
    """Return a fitted model (or ensemble) ready for .predict()."""
    if name == "ensemble":
        members = params.get("members", [])
        models = []
        for m_name in members:
            m_params = params.get(m_name, {})
            fitted, _ = _fit_for_name(m_name, m_params, X, y)
            models.append(fitted)
        return EnsemblePredictor(models)
    elif name == "naive":
        return NaivePredictor()
    else:
        fitted, _ = _fit_for_name(name, params, X, y)
        return fitted


# ─── Shrinkage ────────────────────────────────────────────────────────────────

def _fit_shrinkage(
    X_train: np.ndarray,
    y_train: np.ndarray,
    X_val: np.ndarray,
    val_prev: list[float],
    val_actual: list[float],
    name: str,
    params: dict,
) -> float:
    """
    Find a shrinkage scalar alpha in [0, 1] that minimises val RMSE for:
        adjusted_log_return = alpha * model_log_return
    Returns 1.0 (no shrinkage) if shrinking does not help.
    """
    try:
        model = _fit_candidate(name, params, X_train, y_train)
        raw_log_preds = np.array(model.predict(X_val))

        best_alpha = 1.0
        best_rmse_val = _rmse(
            val_actual,
            [p * math.exp(lr) for p, lr in zip(val_prev, raw_log_preds.tolist())],
        )

        for alpha in np.linspace(0.3, 1.0, 15):
            shrunk = raw_log_preds * alpha
            preds = [p * math.exp(lr) for p, lr in zip(val_prev, shrunk.tolist())]
            rmse_val = _rmse(val_actual, preds)
            if rmse_val < best_rmse_val:
                best_rmse_val = rmse_val
                best_alpha = float(alpha)

        return best_alpha
    except Exception as exc:
        log.warning("shrinkage fitting failed (%s), using alpha=1.0", exc)
        return 1.0


# ─── Candidate fit functions ──────────────────────────────────────────────────

def _fit_ridge(
    X: np.ndarray,
    y: np.ndarray,
    params: dict | None = None,
) -> tuple["Pipeline", dict]:
    """RidgeCV with a log-spaced alpha grid. StandardScaler included."""
    alphas = np.logspace(-3, 3, 20)
    model = Pipeline([
        ("scaler", StandardScaler()),
        ("regressor", RidgeCV(alphas=alphas, cv=TimeSeriesSplit(n_splits=CV_FOLDS))),
    ])
    model.fit(X, y)
    best_alpha = float(model.named_steps["regressor"].alpha_)
    return model, {"type": "ridge", "alpha": best_alpha}


def _fit_hgb(
    X: np.ndarray,
    y: np.ndarray,
    params: dict | None = None,
) -> tuple["Pipeline", dict]:
    """HistGradientBoostingRegressor with TimeSeriesSplit grid search on train."""
    from sklearn.model_selection import GridSearchCV

    if len(X) < CV_FOLDS * 3:
        # Not enough data for CV; use defaults.
        best = {
            "max_iter": 200, "max_depth": 3,
            "learning_rate": 0.05, "min_samples_leaf": 20,
            "l2_regularization": 0.0,
        }
    elif params and "max_iter" in params:
        best = params
    else:
        tscv = TimeSeriesSplit(n_splits=CV_FOLDS)
        base = Pipeline([
            ("scaler", StandardScaler()),
            ("regressor", HistGradientBoostingRegressor(random_state=RANDOM_STATE)),
        ])
        grid = {f"regressor__{k}": v for k, v in HGB_PARAM_GRID.items()}
        gs = GridSearchCV(
            base, grid, cv=tscv,
            scoring="neg_root_mean_squared_error",
            refit=False, n_jobs=-1,
        )
        gs.fit(X, y)
        best_prefixed = dict(gs.best_params_)
        best = {k.replace("regressor__", ""): v for k, v in best_prefixed.items()}

    model = Pipeline([
        ("scaler", StandardScaler()),
        ("regressor", HistGradientBoostingRegressor(
            random_state=RANDOM_STATE, **best
        )),
    ])
    model.fit(X, y)
    return model, {"type": "hgb", **best}


def _fit_rf(
    X: np.ndarray,
    y: np.ndarray,
    params: dict | None = None,
) -> tuple["Pipeline", dict]:
    """RandomForestRegressor with TimeSeriesSplit grid search."""
    from sklearn.model_selection import GridSearchCV

    if len(X) < CV_FOLDS * 3:
        best = {"n_estimators": 200, "max_depth": 5, "min_samples_leaf": 20}
    elif params and "n_estimators" in params:
        best = params
    else:
        tscv = TimeSeriesSplit(n_splits=CV_FOLDS)
        base = Pipeline([
            ("scaler", StandardScaler()),
            ("regressor", RandomForestRegressor(random_state=RANDOM_STATE, n_jobs=-1)),
        ])
        grid = {f"regressor__{k}": v for k, v in RF_PARAM_GRID.items()}
        gs = GridSearchCV(
            base, grid, cv=tscv,
            scoring="neg_root_mean_squared_error",
            refit=False, n_jobs=-1,
        )
        gs.fit(X, y)
        best_prefixed = dict(gs.best_params_)
        best = {k.replace("regressor__", ""): v for k, v in best_prefixed.items()}

    # Ensure max_depth is handled correctly (may be None from grid).
    model = Pipeline([
        ("scaler", StandardScaler()),
        ("regressor", RandomForestRegressor(
            random_state=RANDOM_STATE, n_jobs=-1, **best
        )),
    ])
    model.fit(X, y)
    return model, {"type": "rf", **best}


# ─── Simple predictor wrappers ────────────────────────────────────────────────

class NaivePredictor:
    """Predicts log-return = 0 (tomorrow = today)."""
    def predict(self, X: np.ndarray) -> np.ndarray:
        return np.zeros(len(X), dtype=np.float64)


class EnsemblePredictor:
    """Averages predictions from a list of fitted models."""
    def __init__(self, models: list) -> None:
        self.models = models

    def predict(self, X: np.ndarray) -> np.ndarray:
        preds = np.array([m.predict(X) for m in self.models], dtype=np.float64)
        return preds.mean(axis=0)


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _rmse(actual: list[float], predicted: list[float]) -> float:
    """Root mean squared error in price space."""
    if not actual:
        return float("inf")
    n = len(actual)
    return math.sqrt(sum((a - p) ** 2 for a, p in zip(actual, predicted)) / n)


def _reconstruct_closes(
    log_rets: np.ndarray,
    last_close: float,
    n: int,
) -> list[float]:
    """
    Reconstruct the full close-price series from log-returns.
    Works backwards from the known last_close.
    """
    closes = [0.0] * n
    closes[-1] = last_close
    for i in range(n - 2, -1, -1):
        lr = log_rets[i + 1]
        closes[i] = closes[i + 1] / math.exp(lr) if lr != 0.0 else closes[i + 1]
    return closes


def _compute_model_version(name: str, params: dict, alpha: float) -> str:
    """model_version = <git_sha>-<hash(name+params+alpha)>."""
    try:
        git_sha = subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"],
            stderr=subprocess.DEVNULL,
        ).decode().strip()
    except Exception:
        git_sha = "unknown"
    payload = json.dumps(
        {"model": name, "params": params, "alpha": round(alpha, 4)},
        sort_keys=True,
    )
    param_hash = hashlib.sha256(payload.encode()).hexdigest()[:8]
    return f"{git_sha}-{param_hash}"
