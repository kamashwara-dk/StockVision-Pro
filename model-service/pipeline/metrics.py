"""
pipeline/metrics.py — Accuracy metrics for a walk-forward evaluation run.

Definitions (spec §4):
  For test day t: A_t = actual close, A_{t-1} = previous actual close,
  P_t = prediction made from data through t-1, n = number of test days.

  Directional accuracy:
    DA = 100 × #{sign(P_t - A_{t-1}) == sign(A_t - A_{t-1})} / #{A_t ≠ A_{t-1}}
    Zero-change days are excluded from the denominator.

  MAPE = 100 × mean(|A_t - P_t| / A_t)

  RMSE = sqrt(mean((A_t - P_t)²))  — in listing currency

  Baseline (naive: P_t = A_{t-1}):
    baseline MAPE, baseline RMSE on the same days.

  Baseline directional: majority direction from the TRAINING window.
    If naive beats the model on both MAPE and RMSE, chosen_model is
    already set to 'naive' by train.py; this module just computes the numbers.

All values come from walk-forward predictions stored in TrainingResult.
No figures are hardcoded; everything returned ends up in forecast_runs.
"""

from __future__ import annotations

import dataclasses
import math
import logging
from datetime import date

log = logging.getLogger(__name__)


@dataclasses.dataclass
class MetricsResult:
    directional_accuracy: float   # percent 0–100
    mape: float                    # percent
    rmse: float                    # listing currency

    baseline_directional: float
    baseline_mape: float
    baseline_rmse: float

    n_test_days: int
    n_zero_change_days: int
    test_start: date
    test_end: date

    beats_baseline: bool
    rmse_improvement_pct: float | None
    mape_improvement_pct: float | None


def compute_metrics(
    test_dates: list[date],
    test_actuals: list[float],
    test_predictions: list[float],
    test_prev_closes: list[float],
    train_actuals: list[float],
    train_prev_closes: list[float],
) -> MetricsResult:
    """
    Compute all accuracy metrics and baselines from walk-forward predictions.

    Args:
        test_dates:       Date of each test day.
        test_actuals:     A_t — actual close for each test day.
        test_predictions: P_t — model's predicted close for each test day.
        test_prev_closes: A_{t-1} — actual close on the day before each test day.
        train_actuals:    Actual closes in the training window (for baseline).
        train_prev_closes: Previous closes in the training window (for baseline).
    """
    n = len(test_dates)
    if n == 0:
        raise ValueError("compute_metrics: empty test window")
    if not (len(test_actuals) == len(test_predictions) == len(test_prev_closes) == n):
        raise ValueError("compute_metrics: mismatched array lengths")

    A   = test_actuals
    P   = test_predictions
    Ap  = test_prev_closes

    # MAPE
    mape_terms = [abs(A[i] - P[i]) / A[i] for i in range(n) if A[i] > 0]
    mape = 100.0 * (sum(mape_terms) / len(mape_terms)) if mape_terms else 0.0

    # RMSE
    rmse = math.sqrt(sum((A[i] - P[i]) ** 2 for i in range(n)) / n)

    # Directional accuracy — exclude zero-change days
    nonzero = [(i, A[i], Ap[i], P[i]) for i in range(n) if A[i] != Ap[i]]
    n_zero = n - len(nonzero)
    if nonzero:
        correct = sum(
            1 for _, a, ap, p in nonzero
            if _sign(p - ap) == _sign(a - ap)
        )
        da = 100.0 * correct / len(nonzero)
    else:
        da = 50.0  # undefined; neutral
    if n_zero:
        log.info("compute_metrics: %d zero-change days excluded from DA", n_zero)

    # Naive baseline
    naive_mape_terms = [abs(A[i] - Ap[i]) / A[i] for i in range(n) if A[i] > 0]
    baseline_mape = (
        100.0 * sum(naive_mape_terms) / len(naive_mape_terms)
        if naive_mape_terms else 0.0
    )
    baseline_rmse = math.sqrt(sum((A[i] - Ap[i]) ** 2 for i in range(n)) / n)

    # Majority-direction baseline (from training window)
    n_tr = len(train_actuals)
    if n_tr >= 2 and len(train_prev_closes) == n_tr:
        ups = sum(1 for i in range(n_tr)
                  if train_actuals[i] != train_prev_closes[i]
                  and train_actuals[i] > train_prev_closes[i])
        nz_tr = sum(1 for i in range(n_tr)
                    if train_actuals[i] != train_prev_closes[i])
        majority_up = (ups / nz_tr >= 0.5) if nz_tr > 0 else True
    else:
        majority_up = True

    if nonzero:
        b_correct = sum(
            1 for _, a, ap, _ in nonzero
            if (majority_up and a > ap) or (not majority_up and a < ap)
        )
        baseline_da = 100.0 * b_correct / len(nonzero)
    else:
        baseline_da = 50.0

    # Verdict
    beats = rmse < baseline_rmse and mape < baseline_mape
    rmse_imp = ((baseline_rmse - rmse) / baseline_rmse * 100) if beats and baseline_rmse > 0 else None
    mape_imp = ((baseline_mape - mape) / baseline_mape * 100) if beats and baseline_mape > 0 else None

    log.info(
        "metrics: da=%.2f mape=%.4f rmse=%.4f "
        "b_da=%.2f b_mape=%.4f b_rmse=%.4f beats=%s",
        da, mape, rmse, baseline_da, baseline_mape, baseline_rmse, beats,
    )

    return MetricsResult(
        directional_accuracy=da,
        mape=mape,
        rmse=rmse,
        baseline_directional=baseline_da,
        baseline_mape=baseline_mape,
        baseline_rmse=baseline_rmse,
        n_test_days=n,
        n_zero_change_days=n_zero,
        test_start=test_dates[0],
        test_end=test_dates[-1],
        beats_baseline=beats,
        rmse_improvement_pct=rmse_imp,
        mape_improvement_pct=mape_imp,
    )


def _sign(x: float) -> int:
    return 1 if x > 0 else (-1 if x < 0 else 0)
