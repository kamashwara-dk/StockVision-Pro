"""
pipeline/metrics.py — Accuracy metric computation (spec R4).

All metrics are computed on the test window only.
No figures are estimated, rounded up, or hardcoded. Every value
returned here ends up in the forecast_runs database row and is the
sole source of numbers displayed on screen.

Metric definitions (from spec R4):
─────────────────────────────────────────────────────────────────────

Directional accuracy:
  DA = 100 × (count of days where sign(P_t - A_{t-1}) == sign(A_t - A_{t-1}))
             / (count of days where A_t ≠ A_{t-1})
  Days where A_t == A_{t-1} are excluded and the exclusion is documented.

MAPE:
  MAPE = 100 × mean(|A_t - P_t| / A_t)

RMSE:
  RMSE = sqrt(mean((A_t - P_t)²))
  Reported in the listing currency (INR or USD).

Baselines:
  Naive MAPE/RMSE: P_t = A_{t-1}  (tomorrow equals today)
  Naive directional: predict the majority direction observed in the
                     training window only.

Verdict:
  If model RMSE < naive RMSE AND model MAPE < naive MAPE:
    show the relative improvement.
  Else:
    show the "does not beat the naive baseline" sentence.
  Never claim statistical significance.
"""

from __future__ import annotations

import dataclasses
import math
import logging
from datetime import date

log = logging.getLogger(__name__)


@dataclasses.dataclass
class MetricsResult:
    """All computed metrics for one forecast run."""

    # Model metrics on test window.
    directional_accuracy: float       # percent, 0–100
    mape: float                        # percent
    rmse: float                        # in listing currency

    # Naive baseline metrics on the same test window.
    baseline_directional: float        # percent
    baseline_mape: float               # percent
    baseline_rmse: float               # in listing currency

    # Metadata.
    n_test_days: int
    n_zero_change_days: int            # excluded from directional accuracy
    test_start: date
    test_end: date

    # Verdict for display.
    beats_baseline: bool
    rmse_improvement_pct: float | None    # None when model loses
    mape_improvement_pct: float | None    # None when model loses


def compute_metrics(
    test_dates: list[date],
    test_actuals: list[float],
    test_predictions: list[float],
    test_prev_closes: list[float],
    train_actuals: list[float],       # used for majority-direction baseline
    train_prev_closes: list[float],   # used for majority-direction baseline
) -> MetricsResult:
    """
    Compute all accuracy metrics and baselines.

    Args:
        test_dates:        Date of each test day.
        test_actuals:      A_t — actual close price for each test day.
        test_predictions:  P_t — model's predicted close for each test day.
        test_prev_closes:  A_{t-1} — actual close on the day before each test day.
        train_actuals:     Actual close prices in the training window (for baseline).
        train_prev_closes: Previous closes in the training window (for baseline).

    Returns:
        MetricsResult with all fields populated.
    """
    n = len(test_dates)
    if n == 0:
        raise ValueError("compute_metrics: test window is empty")
    if not (len(test_actuals) == len(test_predictions) == len(test_prev_closes) == n):
        raise ValueError(
            f"compute_metrics: mismatched lengths — "
            f"dates={n}, actuals={len(test_actuals)}, "
            f"preds={len(test_predictions)}, prev={len(test_prev_closes)}"
        )

    A = test_actuals
    P = test_predictions
    A_prev = test_prev_closes

    # ── MAPE ─────────────────────────────────────────────────────────────────
    mape_terms = [abs(A[i] - P[i]) / A[i] for i in range(n) if A[i] > 0]
    mape = 100.0 * (sum(mape_terms) / len(mape_terms)) if mape_terms else 0.0

    # ── RMSE ──────────────────────────────────────────────────────────────────
    rmse = math.sqrt(sum((A[i] - P[i]) ** 2 for i in range(n)) / n)

    # ── Directional accuracy ──────────────────────────────────────────────────
    # Exclude zero-change days (A_t == A_{t-1}).
    directional_days = [(i, A[i], A_prev[i], P[i]) for i in range(n) if A[i] != A_prev[i]]
    n_zero_change = n - len(directional_days)

    if directional_days:
        correct = sum(
            1
            for _, a, a_prev, p in directional_days
            if _sign(p - a_prev) == _sign(a - a_prev)
        )
        directional_accuracy = 100.0 * correct / len(directional_days)
    else:
        directional_accuracy = 50.0  # undefined; use neutral

    if n_zero_change:
        log.info(
            "compute_metrics: %d zero-change days excluded from directional accuracy",
            n_zero_change,
        )

    # ── Naive baseline ────────────────────────────────────────────────────────
    # Naive MAPE/RMSE: predict A_{t-1} for each test day.
    naive_mape_terms = [
        abs(A[i] - A_prev[i]) / A[i] for i in range(n) if A[i] > 0
    ]
    baseline_mape = (
        100.0 * sum(naive_mape_terms) / len(naive_mape_terms)
        if naive_mape_terms
        else 0.0
    )
    baseline_rmse = math.sqrt(
        sum((A[i] - A_prev[i]) ** 2 for i in range(n)) / n
    )

    # Naive directional: predict the majority direction from training window.
    # Majority direction = sign of (close - prev_close) most often in train.
    n_train = len(train_actuals)
    if n_train >= 2 and len(train_prev_closes) == n_train:
        train_ups = sum(
            1
            for i in range(n_train)
            if train_actuals[i] != train_prev_closes[i]
            and train_actuals[i] > train_prev_closes[i]
        )
        train_non_zero = sum(
            1
            for i in range(n_train)
            if train_actuals[i] != train_prev_closes[i]
        )
        if train_non_zero > 0:
            majority_up = (train_ups / train_non_zero) >= 0.5
        else:
            majority_up = True  # default: up
    else:
        majority_up = True  # default: up

    if directional_days:
        baseline_correct = sum(
            1
            for _, a, a_prev, _ in directional_days
            if (majority_up and a > a_prev) or (not majority_up and a < a_prev)
        )
        baseline_directional = 100.0 * baseline_correct / len(directional_days)
    else:
        baseline_directional = 50.0

    # ── Verdict ───────────────────────────────────────────────────────────────
    beats_baseline = rmse < baseline_rmse and mape < baseline_mape
    rmse_improvement_pct: float | None = None
    mape_improvement_pct: float | None = None
    if beats_baseline:
        if baseline_rmse > 0:
            rmse_improvement_pct = 100.0 * (baseline_rmse - rmse) / baseline_rmse
        if baseline_mape > 0:
            mape_improvement_pct = 100.0 * (baseline_mape - mape) / baseline_mape

    log.info(
        "compute_metrics: mape=%.4f rmse=%.4f da=%.2f "
        "baseline_mape=%.4f baseline_rmse=%.4f baseline_da=%.2f "
        "beats=%s",
        mape, rmse, directional_accuracy,
        baseline_mape, baseline_rmse, baseline_directional,
        beats_baseline,
    )

    return MetricsResult(
        directional_accuracy=directional_accuracy,
        mape=mape,
        rmse=rmse,
        baseline_directional=baseline_directional,
        baseline_mape=baseline_mape,
        baseline_rmse=baseline_rmse,
        n_test_days=n,
        n_zero_change_days=n_zero_change,
        test_start=test_dates[0],
        test_end=test_dates[-1],
        beats_baseline=beats_baseline,
        rmse_improvement_pct=rmse_improvement_pct,
        mape_improvement_pct=mape_improvement_pct,
    )


# ─── Internal helpers ──────────────────────────────────────────────────────────

def _sign(x: float) -> int:
    """Return -1, 0, or 1."""
    if x > 0:
        return 1
    if x < 0:
        return -1
    return 0
